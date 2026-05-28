"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useHasMounted } from "@/lib/hooks";
import { useFocusStore, lastNDays } from "@/store/focus-store";

interface Datum {
  label: string;
  minutes: number;
  isToday: boolean;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">{d.minutes} min focused</p>
    </div>
  );
}

export function WeeklyChart() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);

  const days = mounted ? lastNDays(sessions, 7) : [];
  const data: Datum[] = days.map((d, i) => ({
    label: d.label,
    minutes: Math.round(d.ms / 60000),
    isToday: i === days.length - 1,
  }));
  const total = data.reduce((s, d) => s + d.minutes, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="font-semibold">This week</h3>
          <p className="text-sm text-muted-foreground">Focus minutes per day</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">{total} min total</p>
      </div>
      <div className="h-44">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.4 }} content={<ChartTooltip />} />
              <Bar
                dataKey="minutes"
                radius={[6, 6, 6, 6]}
                maxBarSize={40}
                minPointSize={3}
                background={{ fill: "var(--secondary)", radius: 6, opacity: 0.5 }}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.isToday ? "var(--primary)" : "var(--chart-2)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
