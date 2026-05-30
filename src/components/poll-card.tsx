"use client";

import { BarChart3, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsFor } from "@/lib/identity";
import type { Poll } from "@/lib/use-polls";

export function PollCard({
  poll,
  counts,
  myVote,
  onVote,
}: {
  poll: Poll;
  counts: number[];
  myVote: number | null;
  onVote: (optionIndex: number) => void;
}) {
  const total = counts.reduce((s, n) => s + n, 0);
  return (
    <div className="w-full max-w-[85%] self-start rounded-2xl border bg-card/60 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: poll.color }}
        >
          {initialsFor(poll.name)}
        </span>
        <span className="font-medium text-foreground/80">{poll.name}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <BarChart3 className="size-3" /> Poll
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{poll.question}</p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const c = counts[i] ?? 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          const mine = myVote === i;
          return (
            <button
              key={i}
              onClick={() => onVote(i)}
              className={cn(
                "group relative overflow-hidden rounded-lg border px-3 py-1.5 text-left text-xs transition-colors",
                mine
                  ? "border-primary/40 bg-primary/10"
                  : "border-border hover:border-primary/30 hover:bg-secondary/40",
              )}
            >
              {/* fill bar */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500",
                  mine ? "bg-primary/20" : "bg-secondary/50",
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-1.5">
                {mine && <Check className="size-3.5 text-primary" />}
                <span className="flex-1 truncate font-medium">{opt}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct}% · {c}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {total === 0 ? "No votes yet" : `${total} vote${total === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
