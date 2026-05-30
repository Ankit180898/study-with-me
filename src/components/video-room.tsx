"use client";

import "@livekit/components-styles";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  AlertCircle,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/lib/supabase/provider";
import { useProfile } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; token: string; url: string }
  | { kind: "not-configured" }
  | { kind: "error"; message: string };

function ControlBar({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant();
  const btn =
    "flex size-11 items-center justify-center rounded-full transition-colors";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-5">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900/85 px-3 py-2 shadow-lg ring-1 ring-white/5 backdrop-blur">
        <button
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
          className={cn(
            btn,
            isCameraEnabled
              ? "bg-zinc-700/70 text-white hover:bg-zinc-700"
              : "bg-red-500/90 text-white hover:bg-red-500",
          )}
        >
          {isCameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </button>
        <button
          onClick={() =>
            localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
          }
          title={isMicrophoneEnabled ? "Mute" : "Unmute"}
          className={cn(
            btn,
            isMicrophoneEnabled
              ? "bg-zinc-700/70 text-white hover:bg-zinc-700"
              : "bg-red-500/90 text-white hover:bg-red-500",
          )}
        >
          {isMicrophoneEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        <button
          onClick={onLeave}
          title="Leave"
          className={cn(btn, "bg-red-600 text-white hover:bg-red-500")}
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Meet/Zoom-style layout: each tile is 16:9, the grid picks rows×cols
 * that maximize tile size for the container's current shape, then centers.
 */
const TILE_AR = 16 / 9;
const GAP = 14;
const PAD = 24;

function useOptimalTileLayout(count: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ cols: 1, w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || count === 0) return;

    const recalc = () => {
      const W = el.clientWidth - PAD * 2;
      const H = el.clientHeight - PAD * 2;
      if (W <= 0 || H <= 0) return;

      let best = { cols: 1, w: 0, h: 0 };
      for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const maxTileW = (W - (cols - 1) * GAP) / cols;
        const maxTileH = (H - (rows - 1) * GAP) / rows;
        // fit 16:9 inside the (maxTileW, maxTileH) cell
        const w = Math.min(maxTileW, maxTileH * TILE_AR);
        const h = w / TILE_AR;
        if (w > best.w) best = { cols, w, h };
      }
      setLayout(best);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return { containerRef, ...layout };
}

function Tiles() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const { containerRef, cols, w, h } = useOptimalTileLayout(tracks.length);

  if (tracks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-sm text-muted-foreground">
        Waiting for participants…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center bg-black"
      style={{ padding: PAD }}
    >
      <div
        className="grid"
        style={{
          gap: GAP,
          gridTemplateColumns: `repeat(${cols}, ${w}px)`,
          gridAutoRows: `${h}px`,
        }}
      >
        {tracks.map((trackRef) => (
          <div
            key={`${trackRef.publication?.trackSid ?? "ph"}-${trackRef.participant.identity}`}
            className="relative overflow-hidden rounded-xl bg-zinc-900"
            style={{ width: w, height: h }}
          >
            <ParticipantTile
              trackRef={trackRef}
              className="absolute inset-0 !h-full !w-full"
              style={{ aspectRatio: "auto" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden bg-black",
        className,
      )}
    >
      {children}
    </div>
  );
}

function IdleCTA({
  onJoin,
  busy,
  errorMsg,
}: {
  onJoin: () => void;
  busy: boolean;
  errorMsg?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-2xl"
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--primary) 18%, transparent)",
        }}
      >
        <Video className="size-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        Body-double on video
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Turn your camera on and study alongside others. Mics start muted — focus
        first, chat in the sidebar.
      </p>
      <Button onClick={onJoin} disabled={busy} size="lg">
        {busy ? (
          <>
            <Loader2 className="animate-spin" /> Connecting…
          </>
        ) : (
          <>
            <Video /> Join video
          </>
        )}
      </Button>
      {errorMsg && <p className="mt-1 text-xs text-destructive">{errorMsg}</p>}
    </div>
  );
}

export function VideoRoom({
  roomId,
  className,
}: {
  roomId: string;
  className?: string;
}) {
  const { supabase } = useSupabase();
  const { displayName } = useProfile();
  const [state, setState] = useState<State>({ kind: "idle" });

  const join = useCallback(async () => {
    if (!supabase) {
      setState({ kind: "error", message: "Sign in first." });
      return;
    }
    setState({ kind: "connecting" });
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setState({ kind: "error", message: "Not authenticated." });
      return;
    }
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId, name: displayName }),
      });
      if (res.status === 503) {
        setState({ kind: "not-configured" });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Failed" }))) as {
          error?: string;
        };
        setState({
          kind: "error",
          message: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const json = (await res.json()) as { token: string; url: string };
      setState({ kind: "connected", token: json.token, url: json.url });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, [supabase, roomId, displayName]);

  const leave = useCallback(() => setState({ kind: "idle" }), []);

  if (state.kind === "connected") {
    return (
      <StageShell className={className}>
        <LiveKitRoom
          token={state.token}
          serverUrl={state.url}
          connect
          video={true}
          audio={false}
          data-lk-theme="default"
          onDisconnected={leave}
          className="flex h-full min-h-0 flex-col !bg-transparent"
        >
          <RoomAudioRenderer />
          <div className="flex-1 min-h-0">
            <Tiles />
          </div>
          <ControlBar onLeave={leave} />
        </LiveKitRoom>
      </StageShell>
    );
  }

  if (state.kind === "not-configured") {
    return (
      <StageShell className={className}>
        <div className="flex flex-1 flex-col items-center pt-24 gap-3 text-center">
          {" "}
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15">
            <AlertCircle className="size-6 text-amber-500" />
          </div>
          <h2 className="text-base font-semibold">Video not set up yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add{" "}
            <code className="rounded bg-secondary px-1">LIVEKIT_API_KEY</code>,{" "}
            <code className="rounded bg-secondary px-1">
              LIVEKIT_API_SECRET
            </code>
            , and{" "}
            <code className="rounded bg-secondary px-1">
              NEXT_PUBLIC_LIVEKIT_URL
            </code>{" "}
            to your env and restart the server.
          </p>
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell className={className}>
      <IdleCTA
        onJoin={join}
        busy={state.kind === "connecting"}
        errorMsg={state.kind === "error" ? state.message : undefined}
      />
    </StageShell>
  );
}
