"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";
import { useLiveCount } from "@/lib/use-live-count";
import { subscribePresence } from "@/lib/supabase/presence";

/**
 * Live count of people present on a channel via Supabase Realtime Presence.
 * Falls back to a drifting mock when Supabase isn't configured/authed.
 *
 * @param key      presence topic, e.g. "global" or "room:deep-work"
 * @param mockBase base value used for the mock fallback
 */
export function usePresenceCount(
  key: string,
  mockBase = 128,
  opts: { track?: boolean; enabled?: boolean } = {},
): number {
  const { supabase, userId } = useSupabase();
  const mock = useLiveCount(mockBase);
  const [count, setCount] = useState<number | null>(null);
  const track = opts.track ?? true;
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!enabled || !supabase || !userId) return;
    return subscribePresence(supabase, userId, key, setCount, { track });
  }, [supabase, userId, key, track, enabled]);

  // when disabled the caller is responsible for sourcing the count elsewhere
  if (!enabled) return 0;
  if (supabase && userId) return count ?? 0;
  return mock;
}
