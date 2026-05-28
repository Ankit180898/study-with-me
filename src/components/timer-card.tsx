"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/time";
import { useNow, useHasMounted } from "@/lib/hooks";
import {
  useFocusStore,
  elapsedMs,
  targetMsFor,
  MODE_LABEL,
  type TimerMode,
} from "@/store/focus-store";

const MODES: TimerMode[] = ["focus", "short", "long", "free"];
const FREE_BLOCK = 25 * 60_000; // visual ring cycle length for free mode

function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio not available — ignore */
  }
}

function ProgressRing({ progress, children }: { progress: number; children: React.ReactNode }) {
  const size = 280;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function TimerCard() {
  const mounted = useHasMounted();
  const mode = useFocusStore((s) => s.mode);
  const status = useFocusStore((s) => s.status);
  const startedAt = useFocusStore((s) => s.startedAt);
  const accumulatedMs = useFocusStore((s) => s.accumulatedMs);
  const setMode = useFocusStore((s) => s.setMode);
  const start = useFocusStore((s) => s.start);
  const pause = useFocusStore((s) => s.pause);
  const resume = useFocusStore((s) => s.resume);
  const reset = useFocusStore((s) => s.reset);
  const complete = useFocusStore((s) => s.complete);

  const now = useNow(250, status === "running");
  const elapsed = elapsedMs({ status, startedAt, accumulatedMs }, now);
  const target = targetMsFor(mode);
  const isCountdown = mode !== "free";

  const remaining = isCountdown ? Math.max(0, target - elapsed) : 0;
  const progress = isCountdown
    ? target === 0
      ? 0
      : elapsed / target
    : (elapsed % FREE_BLOCK) / FREE_BLOCK;
  const display = isCountdown ? formatClock(remaining) : formatClock(elapsed);

  // auto-complete countdown when it hits zero
  const firedRef = useRef(false);
  useEffect(() => {
    if (status !== "running") {
      firedRef.current = false;
      return;
    }
    if (isCountdown && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      chime();
      complete({ completed: true });
    }
  }, [status, isCountdown, remaining, complete]);

  const running = status === "running";
  const idle = status === "idle";

  return (
    <Card className="relative flex min-h-[520px] items-center justify-center overflow-hidden p-6 sm:p-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "radial-gradient(40rem 12rem at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-col items-center gap-6">
        {/* mode selector */}
        <div className="inline-flex rounded-full bg-secondary p-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <ProgressRing progress={mounted ? progress : 0}>
          <span className="font-mono text-6xl font-semibold tabular-nums tracking-tight">
            {mounted ? display : isCountdown ? formatClock(target) : "00:00"}
          </span>
          <span className="mt-2 text-sm font-medium text-muted-foreground">
            {idle
              ? isCountdown
                ? "Ready to focus"
                : "Open-ended session"
              : running
                ? mode === "focus" || mode === "free"
                  ? "Stay with it"
                  : "On a break"
                : "Paused"}
          </span>
        </ProgressRing>

        {/* controls */}
        <div className="flex items-center gap-3">
          {idle ? (
            <Button size="lg" className="px-8" onClick={start}>
              <Play className="fill-current" /> Start
            </Button>
          ) : running ? (
            <Button size="lg" variant="secondary" className="px-8" onClick={pause}>
              <Pause /> Pause
            </Button>
          ) : (
            <Button size="lg" className="px-8" onClick={resume}>
              <Play className="fill-current" /> Resume
            </Button>
          )}

          {!idle && (
            <>
              <Button size="lg" variant="outline" onClick={() => complete()} title="Finish & log">
                <Check /> Done
              </Button>
              <Button size="icon-lg" variant="ghost" onClick={reset} title="Reset">
                <RotateCcw />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
