"use client";

import { Flame, AlertCircle, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMinutes } from "@/lib/time";
import { useHasMounted, useNow } from "@/lib/hooks";
import {
  useFocusStore,
  elapsedMs,
  todayMs,
  currentStreak,
  bestStreak,
  streakInDanger,
} from "@/store/focus-store";

export function StreakHero() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);
  const mode = useFocusStore((s) => s.mode);
  const status = useFocusStore((s) => s.status);
  const startedAt = useFocusStore((s) => s.startedAt);
  const accumulatedMs = useFocusStore((s) => s.accumulatedMs);

  const now = useNow(1000, status === "running");

  const liveExtra =
    status === "running" && (mode === "focus" || mode === "free")
      ? elapsedMs({ status, startedAt, accumulatedMs }, now)
      : 0;
  const today = mounted ? todayMs(sessions, now) + liveExtra : 0;
  const streak = mounted ? currentStreak(sessions, now) : 0;
  const best = mounted ? bestStreak(sessions) : 0;
  const danger = mounted ? streakInDanger(sessions, now) && liveExtra === 0 : false;

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40rem 12rem at 100% 0%, color-mix(in oklch, var(--chart-4) 12%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: streak > 0
                ? "color-mix(in oklch, var(--chart-4) 22%, transparent)"
                : "var(--secondary)",
            }}
          >
            <Flame
              className="size-7"
              style={{ color: streak > 0 ? "var(--chart-4)" : "var(--muted-foreground)" }}
              fill={streak > 0 ? "currentColor" : "none"}
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current streak
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {streak} <span className="text-base font-normal text-muted-foreground">
                {streak === 1 ? "day" : "days"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Stat label="Today" value={formatMinutes(today)} accent="var(--chart-1)" />
          <Stat
            label="Personal best"
            value={`${best} ${best === 1 ? "day" : "days"}`}
            accent="var(--chart-5)"
            icon={<Award className="size-3.5" />}
          />
        </div>
      </div>

      {danger && (
        <div className="relative mt-5 flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span>
            <span className="font-medium">Your {streak}-day streak is at risk.</span>
            <span className="ml-1 text-muted-foreground">
              Start any focus block today to keep it alive.
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
