"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dayKey, startOfDay } from "@/lib/time";

export type TimerMode = "focus" | "short" | "long" | "free";
export type TimerStatus = "idle" | "running" | "paused";

export interface Session {
  id: string;
  mode: TimerMode;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  /** true if a countdown ran to completion (not the case for "free" or manual stops) */
  completed: boolean;
}

/** Target lengths per mode, in minutes. `free` counts up (no target). */
export const MODE_MINUTES: Record<Exclude<TimerMode, "free">, number> = {
  focus: 25,
  short: 5,
  long: 15,
};

export const MODE_LABEL: Record<TimerMode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
  free: "Free",
};

interface FocusState {
  mode: TimerMode;
  status: TimerStatus;
  /** epoch ms of the current running segment's start; null when not running */
  startedAt: number | null;
  /** ms accumulated from previous segments of the current run (across pauses) */
  accumulatedMs: number;
  /** epoch ms when the active run was first started (for session logging) */
  runStartedAt: number | null;
  sessions: Session[];

  /** replace the full session list (used when hydrating from Supabase) */
  setSessions: (sessions: Session[]) => void;
  setMode: (mode: TimerMode) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** finalize the current run, logging a session if it earned focus time */
  complete: (opts?: { completed?: boolean }) => void;
}

export function targetMsFor(mode: TimerMode): number {
  if (mode === "free") return 0;
  return MODE_MINUTES[mode] * 60_000;
}

/** elapsed ms of the current run given a `now` timestamp */
export function elapsedMs(s: Pick<FocusState, "status" | "startedAt" | "accumulatedMs">, now: number): number {
  const running = s.status === "running" && s.startedAt != null ? now - s.startedAt : 0;
  return s.accumulatedMs + Math.max(0, running);
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      mode: "focus",
      status: "idle",
      startedAt: null,
      accumulatedMs: 0,
      runStartedAt: null,
      sessions: [],

      setSessions: (sessions) => set({ sessions }),

      setMode: (mode) => {
        // changing mode resets the timer to idle
        set({ mode, status: "idle", startedAt: null, accumulatedMs: 0, runStartedAt: null });
      },

      start: () => {
        const now = Date.now();
        set({ status: "running", startedAt: now, accumulatedMs: 0, runStartedAt: now });
      },

      pause: () => {
        const s = get();
        if (s.status !== "running" || s.startedAt == null) return;
        const acc = s.accumulatedMs + (Date.now() - s.startedAt);
        set({ status: "paused", startedAt: null, accumulatedMs: acc });
      },

      resume: () => {
        const s = get();
        if (s.status !== "paused") return;
        set({ status: "running", startedAt: Date.now() });
      },

      reset: () => {
        set({ status: "idle", startedAt: null, accumulatedMs: 0, runStartedAt: null });
      },

      complete: (opts) => {
        const s = get();
        if (s.status === "idle" || s.runStartedAt == null) {
          set({ status: "idle", startedAt: null, accumulatedMs: 0, runStartedAt: null });
          return;
        }
        const now = Date.now();
        const duration = elapsedMs(s, now);
        // only log focus/free time, and only if at least 60s was earned
        const isFocusKind = s.mode === "focus" || s.mode === "free";
        const sessions =
          isFocusKind && duration >= 60_000
            ? [
                ...s.sessions,
                {
                  id: uid(),
                  mode: s.mode,
                  startedAt: s.runStartedAt,
                  endedAt: now,
                  durationMs: duration,
                  completed: opts?.completed ?? false,
                } satisfies Session,
              ]
            : s.sessions;
        set({ sessions, status: "idle", startedAt: null, accumulatedMs: 0, runStartedAt: null });
      },
    }),
    {
      name: "study-with-me:focus",
      partialize: (s) => ({
        mode: s.mode,
        status: s.status,
        startedAt: s.startedAt,
        accumulatedMs: s.accumulatedMs,
        runStartedAt: s.runStartedAt,
        sessions: s.sessions,
      }),
    },
  ),
);

// ---------- derived stats (pure helpers over sessions) ----------

export interface DayStat {
  key: string;
  label: string;
  ms: number;
}

export function focusSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.mode === "focus" || s.mode === "free");
}

export function todayMs(sessions: Session[], now = Date.now()): number {
  const key = dayKey(now);
  return focusSessions(sessions)
    .filter((s) => dayKey(s.endedAt) === key)
    .reduce((sum, s) => sum + s.durationMs, 0);
}

export function totalSessionsToday(sessions: Session[], now = Date.now()): number {
  const key = dayKey(now);
  return focusSessions(sessions).filter((s) => dayKey(s.endedAt) === key && s.mode === "focus").length;
}

/** Consecutive-day streak ending today (or yesterday if nothing yet today). */
export function currentStreak(sessions: Session[], now = Date.now()): number {
  const days = new Set(focusSessions(sessions).map((s) => dayKey(s.endedAt)));
  if (days.size === 0) return 0;
  const oneDay = 86_400_000;
  let cursor = startOfDay(now);
  // if nothing logged today yet, allow the streak to count up to yesterday
  if (!days.has(dayKey(cursor))) cursor -= oneDay;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= oneDay;
  }
  return streak;
}

/** The longest historical consecutive-day streak ever. */
export function bestStreak(sessions: Session[]): number {
  const days = Array.from(new Set(focusSessions(sessions).map((s) => dayKey(s.endedAt)))).sort();
  if (days.length === 0) return 0;
  const oneDay = 86_400_000;
  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime();
    const cur = new Date(days[i]).getTime();
    if (cur - prev === oneDay) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

/** True if the user has an active streak but hasn't logged any focus today,
 *  and it's evening — i.e. the streak is at risk of breaking. */
export function streakInDanger(sessions: Session[], now = Date.now()): boolean {
  if (currentStreak(sessions, now) === 0) return false;
  if (todayMs(sessions, now) > 0) return false;
  return new Date(now).getHours() >= 18;
}

/** Last `n` days (oldest→newest) of focus minutes for charting. */
export function lastNDays(sessions: Session[], n = 7, now = Date.now()): DayStat[] {
  const oneDay = 86_400_000;
  const fs = focusSessions(sessions);
  const out: DayStat[] = [];
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  for (let i = n - 1; i >= 0; i--) {
    const ts = now - i * oneDay;
    const key = dayKey(ts);
    const ms = fs.filter((s) => dayKey(s.endedAt) === key).reduce((sum, s) => sum + s.durationMs, 0);
    out.push({ key, label: fmt.format(new Date(ts)), ms });
  }
  return out;
}
