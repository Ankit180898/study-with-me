"use client";

import { Flame, Clock, Target, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMinutes } from "@/lib/time";
import { useNow, useHasMounted } from "@/lib/hooks";
import {
  useFocusStore,
  elapsedMs,
  todayMs,
  totalSessionsToday,
  currentStreak,
  focusSessions,
} from "@/store/focus-store";

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 18%, transparent)` }}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

export function StatsGrid() {
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
  const sessionsToday = mounted ? totalSessionsToday(sessions, now) : 0;
  const allTime = mounted
    ? focusSessions(sessions).reduce((sum, s) => sum + s.durationMs, 0) + liveExtra
    : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        icon={Clock}
        label="Today's focus"
        value={formatMinutes(today)}
        hint={liveExtra > 0 ? "counting now" : "logged today"}
        accent="var(--chart-1)"
      />
      <Stat
        icon={Flame}
        label="Current streak"
        value={`${streak} ${streak === 1 ? "day" : "days"}`}
        hint={streak > 0 ? "keep it alive" : "start today"}
        accent="var(--chart-4)"
      />
      <Stat
        icon={Target}
        label="Sessions today"
        value={`${sessionsToday}`}
        hint="completed focus blocks"
        accent="var(--chart-3)"
      />
      <Stat
        icon={CalendarCheck}
        label="All-time focus"
        value={formatMinutes(allTime)}
        hint={`${focusSessions(sessions).length} sessions`}
        accent="var(--chart-5)"
      />
    </div>
  );
}
