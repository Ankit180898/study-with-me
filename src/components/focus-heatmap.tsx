"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useHasMounted } from "@/lib/hooks";
import { useFocusStore, focusSessions } from "@/store/focus-store";
import { dayKey, formatMinutes, startOfDay } from "@/lib/time";

interface Cell {
  key: string;
  date: Date;
  ms: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

const WEEKS = 26; // ~6 months
const ONE_DAY = 86_400_000;

function intensityFor(ms: number, max: number): Cell["intensity"] {
  if (ms === 0) return 0;
  const ratio = max === 0 ? 0 : ms / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const SHADES: Record<Cell["intensity"], string> = {
  0: "color-mix(in oklch, var(--foreground) 6%, transparent)",
  1: "color-mix(in oklch, var(--primary) 28%, transparent)",
  2: "color-mix(in oklch, var(--primary) 52%, transparent)",
  3: "color-mix(in oklch, var(--primary) 78%, transparent)",
  4: "var(--primary)",
};

const CELL = 14; // px square
const GAP = 3;
const STRIDE = CELL + GAP;

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: "short" });
const FULL_DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function FocusHeatmap() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);

  const { weeks, monthLabels, totalMs, activeDays } = useMemo(() => {
    if (!mounted) return { weeks: [], monthLabels: [], totalMs: 0, activeDays: 0 };
    const today = startOfDay(Date.now());
    // align grid so the rightmost column ends on today (Sun..Sat rows)
    const todayDow = new Date(today).getDay();
    const lastColumnStart = today - todayDow * ONE_DAY;
    const firstColumnStart = lastColumnStart - (WEEKS - 1) * 7 * ONE_DAY;

    // bucket ms per day
    const bucket = new Map<string, number>();
    focusSessions(sessions).forEach((s) => {
      const k = dayKey(s.endedAt);
      bucket.set(k, (bucket.get(k) ?? 0) + s.durationMs);
    });
    const max = Math.max(0, ...bucket.values());

    const grid: Cell[][] = [];
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    let totalMs = 0;
    let activeDays = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const ts = firstColumnStart + w * 7 * ONE_DAY + d * ONE_DAY;
        const date = new Date(ts);
        const key = dayKey(ts);
        const ms = ts > today ? 0 : (bucket.get(key) ?? 0);
        if (ms > 0) {
          totalMs += ms;
          activeDays += 1;
        }
        week.push({ key, date, ms, intensity: intensityFor(ms, max) });
      }
      const colMonth = new Date(firstColumnStart + w * 7 * ONE_DAY).getMonth();
      if (colMonth !== lastMonth) {
        labels.push({ col: w, label: MONTH_FMT.format(new Date(firstColumnStart + w * 7 * ONE_DAY)) });
        lastMonth = colMonth;
      }
      grid.push(week);
    }
    return { weeks: grid, monthLabels: labels, totalMs, activeDays };
  }, [mounted, sessions]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold">Focus heatmap</h3>
          <p className="text-sm text-muted-foreground">Past {WEEKS} weeks</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {activeDays} active {activeDays === 1 ? "day" : "days"} · {formatMinutes(totalMs)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* month labels — skip any label within 3 cols of the previous so they don't overlap */}
          <div
            className="relative mb-2 ml-8 h-3 text-[11px] font-medium tracking-wide text-muted-foreground/80"
            style={{ width: WEEKS * STRIDE }}
          >
            {monthLabels
              .filter((m, i, arr) => i === 0 || m.col - arr[i - 1].col >= 3)
              .map((m) => (
                <span key={`${m.col}-${m.label}`} className="absolute" style={{ left: m.col * STRIDE }}>
                  {m.label}
                </span>
              ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {/* day-of-week labels (Mon, Wed, Fri shown) */}
            <div className="mr-1.5 flex flex-col text-[11px] text-muted-foreground/70" style={{ gap: GAP }}>
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                <div key={i} className="flex items-center" style={{ height: CELL }}>
                  {d}
                </div>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((cell) => (
                    <div
                      key={cell.key}
                      className="rounded-[3px] transition-all hover:scale-125 hover:ring-2 hover:ring-primary/40"
                      style={{
                        width: CELL,
                        height: CELL,
                        backgroundColor: SHADES[cell.intensity],
                        boxShadow:
                          cell.intensity === 4
                            ? "0 0 8px color-mix(in oklch, var(--primary) 60%, transparent)"
                            : undefined,
                      }}
                      title={
                        cell.ms === 0
                          ? `${FULL_DATE_FMT.format(cell.date)} — no focus`
                          : `${FULL_DATE_FMT.format(cell.date)} — ${formatMinutes(cell.ms)}`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="ml-8 mt-4 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <span>Less</span>
            <div className="flex" style={{ gap: GAP }}>
              {([0, 1, 2, 3, 4] as const).map((i) => (
                <div
                  key={i}
                  className="rounded-[3px]"
                  style={{ width: CELL, height: CELL, backgroundColor: SHADES[i] }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
