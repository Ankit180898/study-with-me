"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, RotateCcw, Check, PictureInPicture2 } from "lucide-react";
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
const DEFAULT_TITLE = "Study with me — focus dashboard";

// Document Picture-in-Picture API isn't in lib.dom yet (Chrome 116+, Edge 116+,
// Opera 102+). Safari/Firefox don't support it as of 2026 — we feature-detect.
interface DocumentPiP {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
function getDocumentPiP(): DocumentPiP | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { documentPictureInPicture?: DocumentPiP };
  return w.documentPictureInPicture ?? null;
}

function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    // Three ascending notes (C5, E5, G5 — a major triad) at ~0.5s gain.
    // Loud enough to grab attention without being startling.
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.18;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      o.start(start);
      o.stop(start + 0.45);
    });
    // mobile haptic — silently no-ops on desktop / unsupported browsers.
    navigator.vibrate?.([120, 60, 120, 60, 200]);
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

// Compact UI shown inside the floating Picture-in-Picture window. Re-uses
// the store directly — PiP windows in Chrome share the opener's JS realm, so
// zustand state stays in sync without postMessage.
function PopoutTimer() {
  const mode = useFocusStore((s) => s.mode);
  const status = useFocusStore((s) => s.status);
  const startedAt = useFocusStore((s) => s.startedAt);
  const accumulatedMs = useFocusStore((s) => s.accumulatedMs);
  const pause = useFocusStore((s) => s.pause);
  const resume = useFocusStore((s) => s.resume);
  const complete = useFocusStore((s) => s.complete);

  const now = useNow(250, status === "running");
  const elapsed = elapsedMs({ status, startedAt, accumulatedMs }, now);
  const target = targetMsFor(mode);
  const isCountdown = mode !== "free";
  const remaining = isCountdown ? Math.max(0, target - elapsed) : elapsed;
  const display = formatClock(remaining);
  const progress = isCountdown
    ? target === 0
      ? 0
      : Math.min(1, elapsed / target)
    : (elapsed % FREE_BLOCK) / FREE_BLOCK;

  const size = 96;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "var(--background, #0b0d12)",
        color: "var(--foreground, #f8fafc)",
        padding: 14,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--secondary, #1e293b)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--primary, #6366f1)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.4s linear" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {display}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {MODE_LABEL[mode]} ·{" "}
          {status === "running" ? "running" : status === "paused" ? "paused" : "idle"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {status === "running" ? (
            <button
              onClick={pause}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border, #334155)",
                background: "var(--secondary, #1e293b)",
                color: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Pause
            </button>
          ) : status === "paused" ? (
            <button
              onClick={resume}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary, #6366f1)",
                color: "var(--primary-foreground, #fff)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Resume
            </button>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Timer finished</div>
          )}
          {status !== "idle" && (
            <button
              onClick={() => complete()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border, #334155)",
                background: "transparent",
                color: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
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

  // ── Popout (Document Picture-in-Picture) ──────────────────────────────
  const [popoutWin, setPopoutWin] = useState<Window | null>(null);
  const popoutSupported = mounted && getDocumentPiP() !== null;

  async function openPopout() {
    const pip = getDocumentPiP();
    if (!pip) return;
    if (popoutWin) {
      popoutWin.focus();
      return;
    }
    try {
      const win = await pip.requestWindow({ width: 320, height: 140 });
      // Copy stylesheets so Tailwind classes work inside the popout. We render
      // mostly with inline styles to be safe across browsers, but this catches
      // any CSS variables (--primary, --background) we rely on.
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
        win.document.head.appendChild(el.cloneNode(true));
      });
      win.document.body.style.margin = "0";
      win.document.title = "Timer · Study with me";
      win.addEventListener("pagehide", () => setPopoutWin(null));
      setPopoutWin(win);
    } catch (e) {
      console.warn("[timer] popout failed", e);
    }
  }

  // close the popout if the user navigates away from the timer card
  useEffect(() => {
    return () => {
      popoutWin?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab-title countdown ───────────────────────────────────────────────
  // When the timer is running, show the remaining time in the browser tab
  // title so users glancing at their tabs can see progress without switching
  // back. Restore the default on any non-running state.
  useEffect(() => {
    if (status === "running") {
      document.title = `${display} · ${MODE_LABEL[mode]}`;
    } else {
      document.title = DEFAULT_TITLE;
    }
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [display, status, mode]);

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
      // Auto-close the floating popout after the chime finishes (~1.2s) so
      // the user gets one final visual + audio cue, then it tidies itself up.
      if (popoutWin) {
        setTimeout(() => popoutWin.close(), 1500);
      }
    }
  }, [status, isCountdown, remaining, complete, popoutWin]);

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

      {/* Pop-out button — hidden on browsers that don't support Document PiP */}
      {popoutSupported && !idle && (
        <button
          type="button"
          onClick={openPopout}
          title={popoutWin ? "Popout open" : "Pop out floating timer — stays on top of other apps"}
          className={cn(
            "absolute right-4 top-4 flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors",
            popoutWin
              ? "border-primary/40 text-primary"
              : "text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          <PictureInPicture2 className="size-3.5" />
          {popoutWin ? "Floating" : "Pop out"}
        </button>
      )}

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

      {popoutWin && createPortal(<PopoutTimer />, popoutWin.document.body)}
    </Card>
  );
}
