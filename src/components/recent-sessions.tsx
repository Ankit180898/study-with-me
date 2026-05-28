"use client";

import { Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMinutes } from "@/lib/time";
import { useHasMounted } from "@/lib/hooks";
import { useFocusStore, focusSessions, MODE_LABEL } from "@/store/focus-store";

export function RecentSessions() {
  const mounted = useHasMounted();
  const sessions = useFocusStore((s) => s.sessions);

  const recent = mounted ? [...focusSessions(sessions)].reverse().slice(0, 5) : [];
  const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-semibold">Recent sessions</h3>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <Clock3 className="size-6 opacity-50" />
          <p>No sessions yet. Start the timer to log your first focus block.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {recent.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: "var(--chart-1)" }}
                />
                <div>
                  <p className="text-sm font-medium">{MODE_LABEL[s.mode]}</p>
                  <p className="text-xs text-muted-foreground">{fmtTime.format(s.endedAt)}</p>
                </div>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatMinutes(s.durationMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
