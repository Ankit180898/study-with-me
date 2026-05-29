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
import { Video, VideoOff, Mic, MicOff, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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

function ControlBar() {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={isCameraEnabled ? "secondary" : "outline"}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
      >
        {isCameraEnabled ? <Video /> : <VideoOff />}
        {isCameraEnabled ? "Camera" : "Off"}
      </Button>
      <Button
        size="sm"
        variant={isMicrophoneEnabled ? "secondary" : "outline"}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        title={isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
      >
        {isMicrophoneEnabled ? <Mic /> : <MicOff />}
        {isMicrophoneEnabled ? "Mic" : "Muted"}
      </Button>
    </div>
  );
}

function Tiles() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  );

  if (tracks.length === 0) {
    return (
      <p className="px-1 py-4 text-center text-xs text-muted-foreground">
        No video yet. Turn your camera on to start.
      </p>
    );
  }

  // 1 → 1 column, 2-4 → 2 columns, 5+ → 2 columns with scroll
  const cols = tracks.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={cn("grid gap-2", cols)}>
      {tracks.map((trackRef) => (
        <ParticipantTile
          key={`${trackRef.publication?.trackSid ?? "ph"}-${trackRef.participant.identity}`}
          trackRef={trackRef}
          className="aspect-video overflow-hidden rounded-lg bg-black/40"
        />
      ))}
    </div>
  );
}

export function VideoRoom({ roomId }: { roomId: string }) {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ roomId, name: displayName }),
      });
      if (res.status === 503) {
        setState({ kind: "not-configured" });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Failed" }))) as { error?: string };
        setState({ kind: "error", message: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const json = (await res.json()) as { token: string; url: string };
      setState({ kind: "connected", token: json.token, url: json.url });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
    }
  }, [supabase, roomId, displayName]);

  const leave = useCallback(() => setState({ kind: "idle" }), []);

  if (state.kind === "connected") {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Video className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Live video</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={leave}>
            Leave
          </Button>
        </div>
        <LiveKitRoom
          token={state.token}
          serverUrl={state.url}
          connect
          video={true}
          audio={false}
          data-lk-theme="default"
          onDisconnected={leave}
          className="!bg-transparent"
        >
          <RoomAudioRenderer />
          <div className="space-y-3 p-3">
            <Tiles />
            <ControlBar />
          </div>
        </LiveKitRoom>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Video className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Live video</h3>
      </div>

      {state.kind === "not-configured" ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            Video isn&apos;t set up yet. Add{" "}
            <code className="rounded bg-secondary px-1">LIVEKIT_*</code> env vars to enable it.
          </span>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Body-doubling on. Cameras on, mics off by default — focus together.
          </p>
          <Button onClick={join} disabled={state.kind === "connecting"} className="w-full">
            {state.kind === "connecting" ? (
              <>
                <Loader2 className="animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <Video /> Join video
              </>
            )}
          </Button>
          {state.kind === "error" && (
            <p className="mt-2 text-xs text-destructive">{state.message}</p>
          )}
        </>
      )}
    </Card>
  );
}
