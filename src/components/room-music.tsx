"use client";

import { useEffect, useState } from "react";
import {
  Music,
  Play,
  Pause,
  Headphones,
  AlertCircle,
  SkipForward,
  ChevronUp,
  X,
  ListMusic,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomMusic } from "@/lib/use-room-music";
import { useMusicQueue } from "@/lib/use-music-queue";
import { useJukeboxStore } from "@/lib/jukebox-store";
import { useSupabase } from "@/lib/supabase/provider";
import { parseYouTubeId } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export function RoomMusic({ roomId }: { roomId: string }) {
  const { state, togglePlayback } = useRoomMusic(roomId);
  const { queue, counts, myVotes, addToQueue, toggleVote, remove, advance } =
    useMusicQueue(roomId);
  const { userId } = useSupabase();
  const tunedIn = useJukeboxStore((s) => s.tunedIn);
  const setTunedIn = useJukeboxStore((s) => s.setTunedIn);
  const title = useJukeboxStore((s) => s.title);
  const setInlineMounted = useJukeboxStore((s) => s.setInlineMounted);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInlineMounted(true);
    return () => setInlineMounted(false);
  }, [setInlineMounted]);

  function handleTuneIn() {
    setTunedIn(true);
    const p = useJukeboxStore.getState().player;
    if (p && state.videoId) {
      try {
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

  function handleSkip() {
    // Play the locally-known next track INSIDE the click so the browser
    // counts it as a user gesture (autoplay policy). advance() then syncs
    // the canonical state in Supabase.
    const next = queue[0];
    const p = useJukeboxStore.getState().player;
    if (next && p) {
      try {
        p.loadVideoById(next.videoId, 0);
      } catch {
        /* ignore */
      }
    }
    if (!tunedIn) setTunedIn(true);
    void advance();
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = parseYouTubeId(input);
    if (!id) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    setInput("");
    void addToQueue(id);
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
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSkip}
              title="Skip to next queued track"
              disabled={queue.length === 0}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="px-4 py-4 text-center text-xs text-muted-foreground">
          Queue is empty — add a YouTube link below.
        </p>
      )}

      {queue.length > 0 && (
        <div className="border-t bg-muted/20 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 px-1">
            <ListMusic className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Up next · {queue.length}
            </p>
          </div>
          <ul className="space-y-1">
            {queue.map((q) => {
              const votes = counts[q.id] ?? 0;
              const mine = myVotes.has(q.id);
              const mineAdded = q.addedBy === userId;
              return (
                <li
                  key={q.id}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/40"
                >
                  <button
                    onClick={() => toggleVote(q.id)}
                    title={mine ? "Remove vote" : "Upvote"}
                    className={cn(
                      "flex w-9 shrink-0 items-center justify-center gap-0.5 rounded-md border px-1 py-0.5 text-xs transition-colors",
                      mine
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    <ChevronUp className="size-3" />
                    <span className="tabular-nums">{votes}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {q.title || q.videoId}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      added by {mineAdded ? "you" : q.addedByName}
                    </p>
                  </div>
                  {(mineAdded || !q.addedByName) && (
                    <button
                      onClick={() => remove(q.id)}
                      title="Remove from queue"
                      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasTrack ? "Add to queue…" : "Paste a YouTube link…"}
        />
        <Button type="submit" size="sm" disabled={!input.trim()}>
          Add
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
