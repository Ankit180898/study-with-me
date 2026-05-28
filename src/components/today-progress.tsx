"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMinutes } from "@/lib/time";
import { useNow, useHasMounted } from "@/lib/hooks";
import { useFocusStore, elapsedMs, todayMs } from "@/store/focus-store";

const DAILY_GOAL_MS = 120 * 60_000; // 2h default goal

export function TodayProgress() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);
  const mode = useFocusStore((s) => s.mode);
  const status = useFocusStore((s) => s.status);
  const startedAt = useFocusStore((s) => s.startedAt);
  const accumulatedMs = useFocusStore((s) => s.accumulatedMs);

  const now = useNow(1000, status === "running");
  const live =
    status === "running" && (mode === "focus" || mode === "free")
      ? elapsedMs({ status, startedAt, accumulatedMs }, now)
      : 0;
  const today = mounted ? todayMs(sessions, now) + live : 0;
  const pct = Math.min(100, Math.round((today / DAILY_GOAL_MS) * 100));

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold">Today&apos;s goal</h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatMinutes(today)} / {formatMinutes(DAILY_GOAL_MS)}
        </span>
      </div>
      <Progress value={pct} className="h-2.5" />
      <p className="mt-3 text-sm text-muted-foreground">
        {pct >= 100
          ? "Goal smashed. Anything more is a bonus. 🎉"
          : today === 0
            ? "Start a focus block to begin your day."
            : `${pct}% there — ${formatMinutes(Math.max(0, DAILY_GOAL_MS - today))} to go.`}
      </p>
    </Card>
  );
}
