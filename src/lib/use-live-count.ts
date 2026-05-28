"use client";

import { useEffect, useState } from "react";

/**
 * "People studying now" count.
 * MOCK for the UI-first pass — drifts gently around a base value.
 * Will be replaced by a Supabase Realtime Presence channel.
 */
export function useLiveCount(base = 128): number {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => Math.max(42, c + (Math.floor(Math.random() * 7) - 3)));
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return count;
}
