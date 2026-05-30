"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fetchSessions, insertSessions } from "@/lib/supabase/sessions";
import { useFocusStore } from "@/store/focus-store";

interface SupabaseCtx {
  supabase: SupabaseClient | null;
  user: User | null;
  userId: string | null;
  /** true once auth + initial sync have settled (or we're in local-only mode) */
  ready: boolean;
  configured: boolean;
}

const Ctx = createContext<SupabaseCtx>({
  supabase: null,
  user: null,
  userId: null,
  ready: false,
  configured: false,
});

export const useSupabase = () => useContext(Ctx);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const userId = user?.id ?? null;
  const [ready, setReady] = useState(!supabase); // local-only is "ready" immediately

  // ids already persisted to Supabase, so the store subscriber doesn't re-insert
  const knownIds = useRef<Set<string>>(new Set());
  const synced = useRef(false);

  // 1) ensure an (anonymous) session
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn(
            "[supabase] anonymous sign-in failed — enable it in Authentication → Providers. Running local-only.",
            error.message,
          );
          if (active) setReady(true);
          return;
        }
      }
      const { data: u } = await supabase.auth.getUser();
      if (active) setUser(u.user ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase emits transient events (TOKEN_REFRESHED retries, INITIAL_SESSION
      // bursts on tab refocus) where `session` is briefly null even though the
      // user IS still signed in. Resetting to null would flicker the UI back to
      // "Guest · tap to sync". Only clear on an explicit sign-out.
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (session?.user) setUser(session.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // 2) once authed, sync: upload local-only sessions, hydrate the rest
  useEffect(() => {
    if (!supabase || !userId || synced.current) return;
    let active = true;

    (async () => {
      try {
        const remote = await fetchSessions(supabase, userId);
        const remoteIds = new Set(remote.map((s) => s.id));
        // Migrate any legacy non-UUID ids (old `uid()` returned random base36)
        // so the Supabase `uuid` column doesn't reject them.
        const UUID_RE =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const localRaw = useFocusStore.getState().sessions;
        const local = localRaw.map((s) =>
          UUID_RE.test(s.id) ? s : { ...s, id: crypto.randomUUID() },
        );
        if (local.some((s, i) => s.id !== localRaw[i].id)) {
          useFocusStore.getState().setSessions(local);
        }
        const localOnly = local.filter((s) => !remoteIds.has(s.id));
        if (localOnly.length) await insertSessions(supabase, userId, localOnly);

        const merged = [...remote, ...localOnly].sort((a, b) => a.endedAt - b.endedAt);
        knownIds.current = new Set(merged.map((s) => s.id));
        if (active) {
          useFocusStore.getState().setSessions(merged);
          synced.current = true;
          setReady(true);
        }
      } catch (e) {
        console.warn("[supabase] session sync failed — running local-only.", e);
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase, userId]);

  // 3) push newly completed sessions to Supabase as they appear
  useEffect(() => {
    if (!supabase) return;
    const unsub = useFocusStore.subscribe((state) => {
      if (!synced.current || !userId) return;
      const fresh = state.sessions.filter((s) => !knownIds.current.has(s.id));
      if (fresh.length === 0) return;
      fresh.forEach((s) => knownIds.current.add(s.id));
      insertSessions(supabase, userId, fresh).catch((e) => {
        fresh.forEach((s) => knownIds.current.delete(s.id)); // allow retry on next change
        console.warn("[supabase] failed to save session(s).", e);
      });
    });
    return unsub;
  }, [supabase, userId]);

  return (
    <Ctx.Provider value={{ supabase, user, userId, ready, configured: Boolean(supabase) }}>
      {children}
    </Ctx.Provider>
  );
}
