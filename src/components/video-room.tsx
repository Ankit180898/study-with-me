"use client";

import "@livekit/components-styles";
import { useCallback, useState } from "react";
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
  return (
    <div className="flex items-center justify-center gap-2 border-t bg-card/80 px-4 py-3 backdrop-blur">
      <Button
        size="sm"
        variant={isCameraEnabled ? "secondary" : "outline"}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
      >
        {isCameraEnabled ? <Video /> : <VideoOff />}
        {isCameraEnabled ? "Camera on" : "Camera off"}
      </Button>
      <Button
        size="sm"
        variant={isMicrophoneEnabled ? "secondary" : "outline"}
        onClick={() =>
          localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        }
        title={isMicrophoneEnabled ? "Mute" : "Unmute"}
      >
        {isMicrophoneEnabled ? <Mic /> : <MicOff />}
        {isMicrophoneEnabled ? "Mic on" : "Muted"}
      </Button>
      <span className="mx-2 h-5 w-px bg-border" aria-hidden />
      <Button size="sm" variant="destructive" onClick={onLeave}>
        <LogOut /> Leave
      </Button>
    </div>
  );
}

/** Adaptive grid that fills the available area. */
function gridClassFor(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-2 grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  if (count <= 9) return "grid-cols-3 grid-rows-3";
  return "grid-cols-4 grid-rows-3";
}

function Tiles() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  if (tracks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-sm text-muted-foreground">
        Waiting for participants…
      </div>
    );
  }

  // Single tile — fill the entire stage (Meet/Zoom 1-person view)
  if (tracks.length === 1) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <ParticipantTile
          key={`${tracks[0].publication?.trackSid ?? "ph"}-${tracks[0].participant.identity}`}
          trackRef={tracks[0]}
          className="absolute inset-0 !h-full !w-full !bg-zinc-900"
          style={{ aspectRatio: "auto" }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-full w-full gap-3 bg-black p-4",
        gridClassFor(tracks.length),
      )}
    >
      {tracks.map((trackRef) => (
        <div
          key={`${trackRef.publication?.trackSid ?? "ph"}-${trackRef.participant.identity}`}
          className="relative h-full w-full overflow-hidden rounded-xl bg-zinc-900"
        >
          {/* absolute positioning ignores LiveKit's default 16:9 aspect-ratio on the tile,
              so each tile fills its grid cell (Meet/Zoom-style cover) */}
          <ParticipantTile
            trackRef={trackRef}
            className="absolute inset-0 !h-full !w-full"
            style={{ aspectRatio: "auto" }}
          />
        </div>
      ))}
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
