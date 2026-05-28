"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, Headphones, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomMusic } from "@/lib/use-room-music";
import { loadYouTubeApi, parseYouTubeId, type YTPlayer } from "@/lib/youtube";

const TUNED_KEY = "study-with-me:tuned-in";

export function RoomMusic({ roomId }: { roomId: string }) {
  const { state, setTrack, togglePlayback } = useRoomMusic(roomId);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [tunedIn, setTunedIn] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTunedIn(sessionStorage.getItem(TUNED_KEY) === "1");
  }, []);

  // build the player once
  useEffect(() => {
    let alive = true;
    let player: YTPlayer | null = null;

    loadYouTubeApi().then((YT) => {
      if (!alive || !containerRef.current) return;
      player = new YT.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: 0, controls: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: () => {
            const t = player?.getVideoData().title;
            if (t) setTitle(t);
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      alive = false;
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, []);

  // reflect remote state into the player
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready || !state.videoId) return;

    const offsetSec =
      !state.paused && state.startedAt
        ? Math.max(0, (Date.now() - state.startedAt) / 1000)
        : 0;

    const current = p.getVideoData().video_id;
    const newTrack = current !== state.videoId;

    if (newTrack) {
      if (state.paused || !tunedIn) p.cueVideoById(state.videoId, offsetSec);
      else p.loadVideoById(state.videoId, offsetSec);
    } else if (state.paused) {
      p.pauseVideo();
    } else if (tunedIn) {
      p.seekTo(offsetSec, true);
      p.playVideo();
    }
  }, [ready, tunedIn, state.videoId, state.paused, state.startedAt]);

  function handleSet(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = parseYouTubeId(input);
    if (!id) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    setInput("");
    void setTrack(id);
  }

  function tuneIn() {
    sessionStorage.setItem(TUNED_KEY, "1");
    setTunedIn(true);
    // user gesture: unblock audio + start if a track is loaded and playing
    if (playerRef.current && state.videoId && !state.paused) {
      const offset = state.startedAt ? Math.max(0, (Date.now() - state.startedAt) / 1000) : 0;
      playerRef.current.seekTo(offset, true);
      playerRef.current.playVideo();
    }
  }

  const hasTrack = !!state.videoId;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Music className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Room music</h3>
        {hasTrack && (
          <span className="ml-auto text-xs text-muted-foreground">
            {state.paused ? "Paused" : "Playing"}
          </span>
        )}
      </div>

      <div className="relative aspect-video w-full bg-black/40">
        <div ref={containerRef} className="absolute inset-0" />
        {hasTrack && !tunedIn && (
          <button
            onClick={tuneIn}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm font-medium text-white transition-colors hover:bg-black/60"
          >
            <Headphones className="size-6" />
            Tune in
            <span className="text-xs text-white/70">click once to enable audio</span>
          </button>
        )}
        {!hasTrack && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
            No track yet — paste a YouTube link below.
          </div>
        )}
      </div>

      {hasTrack && (
        <div className="flex items-center gap-2 border-t px-4 py-2.5">
          <Button
            size="sm"
            variant={state.paused ? "default" : "secondary"}
            onClick={togglePlayback}
          >
            {state.paused ? <Play className="fill-current" /> : <Pause />}
            {state.paused ? "Play" : "Pause"}
          </Button>
          <p className="ml-1 line-clamp-1 flex-1 text-xs text-muted-foreground" title={title}>
            {title || "Loading…"}
          </p>
        </div>
      )}

      <form onSubmit={handleSet} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a YouTube link…"
        />
        <Button type="submit" size="sm" disabled={!input.trim()}>
          Set
        </Button>
      </form>
      {error && (
        <p className="flex items-center gap-1.5 border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </Card>
  );
}
