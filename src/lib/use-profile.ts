"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";

const NAME_KEY = "study-with-me:name";
const ONBOARDED_KEY = "study-with-me:onboarded";

/**
 * Display name + onboarding flag, persisted to localStorage and best-effort
 * mirrored to Supabase user_metadata. Sync status is derived from the user.
 */
export function useProfile() {
  const { user, supabase } = useSupabase();
  const [name, setNameState] = useState("");
  const [onboarded, setOnboarded] = useState(true); // assume true until mounted
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNameState(localStorage.getItem(NAME_KEY) ?? "");
    setOnboarded(localStorage.getItem(ONBOARDED_KEY) === "1");
  }, []);

  const saveName = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      setNameState(trimmed);
      localStorage.setItem(NAME_KEY, trimmed);
      if (supabase && trimmed) {
        await supabase.auth.updateUser({ data: { display_name: trimmed } }).catch(() => {});
      }
    },
    [supabase],
  );

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setOnboarded(true);
  }, []);

  const metaName = (user?.user_metadata?.display_name as string | undefined) ?? "";
  const displayName = name || metaName;
  const email = user?.email ?? null;

  return {
    mounted,
    displayName,
    email,
    isSynced: Boolean(email),
    onboarded,
    saveName,
    completeOnboarding,
  };
}
