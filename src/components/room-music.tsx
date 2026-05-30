"use client";

import { useEffect, useState } from "react";
import { Music, Play, Pause, Headphones, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomMusic } from "@/lib/use-room-music";
import { useJukeboxStore } from "@/lib/jukebox-store";
import { parseYouTubeId } from "@/lib/youtube";

/**
 * Inline room-music panel rendered in the room rail. The actual YouTube
 * iframe lives in <GlobalJukebox /> (root layout), so audio persists when
 * the user navigates away from the room.
 */
export function RoomMusic({ roomId }: { roomId: string }) {
  const { state, setTrack, togglePlayback } = useRoomMusic(roomId);
  const tunedIn = useJukeboxStore((s) => s.tunedIn);
  const setTunedIn = useJukeboxStore((s) => s.setTunedIn);
  const title = useJukeboxStore((s) => s.title);
  const setInlineMounted = useJukeboxStore((s) => s.setInlineMounted);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // tell the global jukebox that the inline music panel is on screen;
  // the floating pill uses this to suppress itself.
  useEffect(() => {
    setInlineMounted(true);
    return () => setInlineMounted(false);
  }, [setInlineMounted]);

  // Synchronous handlers — call playVideo/pauseVideo *inside* the click so
  // browsers count it as user-gesture-driven (autoplay policy).
  function handleTuneIn() {
    setTunedIn(true);
    const p = useJukeboxStore.getState().player;
    if (p && state.videoId) {
      try {
        // loadVideoById(id, 0) — fresh start, ignores stale startedAt
        // so a row from hours ago can't seek past the end of the video.
        p.loadVideoById(state.videoId, 0);
      } catch {
        /* ignore */
      }
    }
  }

  function handleToggle() {
    const p = useJukeboxStore.getState().player;
    if (p) {
      if (state.paused) p.playVideo();
      else p.pauseVideo();
    }
    void togglePlayback();
  }

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

  const hasTrack = !!state.videoId;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Music className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Room music</h3>
        {hasTrack && (
          <span className="ml-auto text-xs text-muted-foreground">
            {state.paused ? "Paused" : tunedIn ? "Playing" : "Cued"}
          </span>
        )}
      </div>

      {hasTrack ? (
        <div className="px-4 py-3">
          <p className="line-clamp-2 text-sm font-medium" title={title}>
            {title || "Loading…"}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            {!tunedIn ? (
              <Button size="sm" onClick={handleTuneIn}>
                <Headphones className="size-4" /> Tune in
              </Button>
            ) : (
              <Button
                size="sm"
                variant={state.paused ? "default" : "secondary"}
                onClick={handleToggle}
              >
                {state.paused ? <Play className="fill-current" /> : <Pause />}
                {state.paused ? "Play" : "Pause"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="px-4 py-4 text-center text-xs text-muted-foreground">
          No track yet — paste a YouTube link below.
        </p>
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
