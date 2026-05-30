"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSupabase } from "@/lib/supabase/provider";
import { useProfile } from "@/lib/use-profile";
import { colorForId, guestName } from "@/lib/identity";
import {
  useFocusStore,
  todayMs as computeTodayMs,
  type TimerMode,
  type TimerStatus,
} from "@/store/focus-store";

export interface RoomMember {
  id: string;
  name: string;
  color: string;
  mode: TimerMode;
  status: TimerStatus;
  startedAt: number | null;
  accumulatedMs: number;
  todayMs: number;
  /** epoch ms of the user's most recent completed session, if any */
  lastCompletedAt: number | null;
  /** duration in ms of that most recent completed session */
  lastCompletedMs: number | null;
  workingOn: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface CelebrateEntry {
  id: string;
  userId: string;
  name: string;
  color: string;
  mode: TimerMode;
  durationMs: number;
  at: number;
}

export type ChatEntry =
  | ({ type: "msg" } & ChatMessage)
  | { type: "system"; id: string; kind: "join" | "leave"; name: string; at: number }
  | ({ type: "celebrate" } & CelebrateEntry);

type ReactionsState = Record<string, Record<string, string[]>>; // messageId -> emoji -> userIds

interface MessageRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  text: string;
  created_at: string;
}

interface PresenceMeta {
  name: string;
  color: string;
  mode: TimerMode;
  status: TimerStatus;
  startedAt: number | null;
  accumulatedMs: number;
  todayMs: number;
  lastCompletedAt: number | null;
  lastCompletedMs: number | null;
  workingOn: string;
}

function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color,
    text: r.text,
    at: new Date(r.created_at).getTime(),
  };
}

const HISTORY_LIMIT = 50;
const INITIAL_QUIET_MS = 1500;
const TYPING_TTL_MS = 3000;

export function useRoom(roomId: string) {
  const { supabase, userId } = useSupabase();
  const { displayName, workingOn } = useProfile();

  const mode = useFocusStore((s) => s.mode);
  const status = useFocusStore((s) => s.status);
  const startedAt = useFocusStore((s) => s.startedAt);
  const accumulatedMs = useFocusStore((s) => s.accumulatedMs);
  const sessions = useFocusStore((s) => s.sessions);
  const myToday = computeTodayMs(sessions);
  const lastSession = sessions.at(-1);
  const myLastCompletedAt = lastSession?.endedAt ?? null;
  const myLastCompletedMs = lastSession?.durationMs ?? null;

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemEntries, setSystemEntries] = useState<
    { id: string; kind: "join" | "leave"; name: string; at: number }[]
  >([]);
  const [celebrateEntries, setCelebrateEntries] = useState<CelebrateEntry[]>([]);
  const seenCompletedAt = useRef<Map<string, number>>(new Map());
  const [reactions, setReactions] = useState<ReactionsState>({});
  const [typing, setTyping] = useState<{ id: string; name: string }[]>([]);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAt = useRef(0);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const name = displayName || (userId ? guestName(userId) : "Guest");
  const color = userId ? colorForId(userId) : "#6366f1";

  const meta = useRef<PresenceMeta>({} as PresenceMeta);
  meta.current = {
    name,
    color,
    mode,
    status,
    startedAt,
    accumulatedMs,
    todayMs: myToday,
    lastCompletedAt: myLastCompletedAt,
    lastCompletedMs: myLastCompletedMs,
    workingOn,
  };

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg].slice(-200)));
  }, []);

  const addSystem = useCallback((kind: "join" | "leave", name: string) => {
    setSystemEntries((prev) =>
      [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, name, at: Date.now() }].slice(
        -50,
      ),
    );
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    joinedAt.current = Date.now();

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (active && data) setMessages((data as MessageRow[]).map(rowToMessage).reverse());
    })();

    const fresh = () => Date.now() - joinedAt.current > INITIAL_QUIET_MS;

    const channel = supabase.channel(`presence:room:${roomId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        setMembers(
          Object.entries(state).map(([key, metas]) => {
            const m = metas[0];
            return {
              id: key,
              name: m?.name ?? "Guest",
              color: m?.color ?? "#6366f1",
              mode: m?.mode ?? "focus",
              status: m?.status ?? "idle",
              startedAt: m?.startedAt ?? null,
              accumulatedMs: m?.accumulatedMs ?? 0,
              lastCompletedAt: m?.lastCompletedAt ?? null,
              lastCompletedMs: m?.lastCompletedMs ?? null,
              workingOn: m?.workingOn ?? "",
              todayMs: m?.todayMs ?? 0,
            };
          }),
        );
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key === userId || !fresh()) return;
        const m = (newPresences[0] as unknown as PresenceMeta) ?? null;
        addSystem("join", m?.name ?? "Someone");
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (key === userId || !fresh()) return;
        const m = (leftPresences[0] as unknown as PresenceMeta) ?? null;
        addSystem("leave", m?.name ?? "Someone");
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { id: string; name: string };
        if (p.id === userId) return;
        setTyping((prev) => (prev.some((t) => t.id === p.id) ? prev : [...prev, p]));
        const timers = typingTimers.current;
        clearTimeout(timers.get(p.id));
        timers.set(
          p.id,
          setTimeout(() => {
            setTyping((prev) => prev.filter((t) => t.id !== p.id));
            timers.delete(p.id);
          }, TYPING_TTL_MS),
        );
      })
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const p = payload as { messageId: string; emoji: string; userId: string; op: "add" | "remove" };
        applyReaction(p.messageId, p.emoji, p.userId, p.op);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => addMessage(rowToMessage(payload.new as MessageRow)),
      )
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          setConnected(true);
          await channel.track(meta.current);
        }
      });

    const timers = typingTimers.current;
    return () => {
      active = false;
      setConnected(false);
      setMembers([]);
      setMessages([]);
      setSystemEntries([]);
      setCelebrateEntries([]);
      seenCompletedAt.current.clear();
      setReactions({});
      setTyping([]);
      timers.forEach(clearTimeout);
      timers.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, userId, roomId, addMessage, addSystem]);

  // re-broadcast presence whenever our identity / focus state changes
  useEffect(() => {
    if (connected) channelRef.current?.track(meta.current).catch(() => {});
  }, [
    connected,
    name,
    color,
    mode,
    status,
    startedAt,
    accumulatedMs,
    myToday,
    myLastCompletedAt,
    myLastCompletedMs,
    workingOn,
  ]);

  function applyReaction(messageId: string, emoji: string, uid: string, op: "add" | "remove") {
    setReactions((prev) => {
      const forMsg = { ...(prev[messageId] ?? {}) };
      const arr = forMsg[emoji] ? [...forMsg[emoji]] : [];
      const idx = arr.indexOf(uid);
      if (op === "add" && idx === -1) arr.push(uid);
      if (op === "remove" && idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) delete forMsg[emoji];
      else forMsg[emoji] = arr;
      return { ...prev, [messageId]: forMsg };
    });
  }

  const sendTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !userId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { id: userId, name: meta.current.name } });
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!supabase || !userId || !trimmed) return;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        userId,
        name: meta.current.name,
        color: meta.current.color,
        text: trimmed,
        at: Date.now(),
      };
      addMessage(msg);
      const { error } = await supabase.from("messages").insert({
        id: msg.id,
        room_id: roomId,
        user_id: userId,
        name: msg.name,
        color: msg.color,
        text: msg.text,
      });
      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        console.warn("[supabase] failed to send message.", error.message);
      }
    },
    [supabase, userId, roomId, addMessage],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const ch = channelRef.current;
      if (!ch || !userId) return;
      const has = reactions[messageId]?.[emoji]?.includes(userId);
      const op: "add" | "remove" = has ? "remove" : "add";
      applyReaction(messageId, emoji, userId, op);
      ch.send({ type: "broadcast", event: "react", payload: { messageId, emoji, userId, op } });
    },
    [userId, reactions],
  );

  // merge messages + system events + celebrations into one chronological stream
  const entries = useMemo<ChatEntry[]>(() => {
    const msgs: ChatEntry[] = messages.map((m) => ({ type: "msg", ...m }));
    const sys: ChatEntry[] = systemEntries.map((s) => ({ type: "system", ...s }));
    const celebs: ChatEntry[] = celebrateEntries.map((c) => ({ type: "celebrate", ...c }));
    return [...msgs, ...sys, ...celebs].sort((a, b) => a.at - b.at);
  }, [messages, systemEntries, celebrateEntries]);

  // Our own row is rendered from local state (instant) rather than the
  // presence echo (round-trip lag) so the user sees their own timer status
  // change the instant they press Start. Peers continue via presence as usual.
  const visibleMembers = useMemo<RoomMember[]>(() => {
    if (!userId) return members;
    const self: RoomMember = {
      id: userId,
      name,
      color,
      mode,
      status,
      startedAt,
      accumulatedMs,
      todayMs: myToday,
      lastCompletedAt: myLastCompletedAt,
      lastCompletedMs: myLastCompletedMs,
      workingOn,
    };
    const has = members.some((m) => m.id === userId);
    return has ? members.map((m) => (m.id === userId ? self : m)) : [self, ...members];
  }, [members, userId, name, color, mode, status, startedAt, accumulatedMs, myToday, myLastCompletedAt, myLastCompletedMs, workingOn]);

  // detect completions across all visible members and emit celebrate entries
  useEffect(() => {
    const seen = seenCompletedAt.current;
    const fresh: CelebrateEntry[] = [];
    visibleMembers.forEach((m) => {
      if (!m.lastCompletedAt) return;
      const prev = seen.get(m.id);
      if (prev === undefined) {
        // first observation — record without emitting (avoid retroactive spam)
        seen.set(m.id, m.lastCompletedAt);
        return;
      }
      if (m.lastCompletedAt > prev) {
        seen.set(m.id, m.lastCompletedAt);
        // only celebrate real focus blocks; skip breaks
        if (m.mode === "short" || m.mode === "long") return;
        fresh.push({
          id: `celebrate-${m.id}-${m.lastCompletedAt}`,
          userId: m.id,
          name: m.name,
          color: m.color,
          mode: m.mode,
          durationMs: m.lastCompletedMs ?? 0,
          at: m.lastCompletedAt,
        });
      }
    });
    if (fresh.length) {
      setCelebrateEntries((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        const additions = fresh.filter((c) => !ids.has(c.id));
        return additions.length ? [...prev, ...additions].slice(-50) : prev;
      });
    }
  }, [visibleMembers]);

  return {
    members: visibleMembers,
    entries,
    reactions,
    typing,
    sendMessage,
    sendTyping,
    toggleReaction,
    connected,
    me: { id: userId, name, color },
  };
}
