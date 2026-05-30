"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Pause, X, Music2, Headphones } from "lucide-react";
import { useJukeboxStore } from "@/lib/jukebox-store";
import { useRoomMusic } from "@/lib/use-room-music";
import { getRoom } from "@/lib/rooms";
import { cn } from "@/lib/utils";

/**
 * Floating top-right pill that surfaces the currently-joined room's audio
 * when the user is NOT on that room's page. Glass aesthetic + soft music bars.
 */
export function JukeboxPill() {
  const joinedRoomId = useJukeboxStore((s) => s.joinedRoomId);
  const inlineMounted = useJukeboxStore((s) => s.inlineMounted);
  const pathname = usePathname();

  if (!joinedRoomId) return null;
  // Show the pill whenever there's no inline RoomMusic on screen — this
  // covers "navigated away" AND "on the room page but in video mode where
  // the rail is hidden". Also belt-and-braces hide on the exact room page
  // while inline is still mounted.
  const onItsPage = pathname === `/rooms/${joinedRoomId}`;
  if (onItsPage && inlineMounted) return null;

  return <PillBody roomId={joinedRoomId} />;
}

function PillBody({ roomId }: { roomId: string }) {
  const room = getRoom(roomId);
  const { state, togglePlayback } = useRoomMusic(roomId);
  const title = useJukeboxStore((s) => s.title);
  const tunedIn = useJukeboxStore((s) => s.tunedIn);
  const setTunedIn = useJukeboxStore((s) => s.setTunedIn);
  const leave = useJukeboxStore((s) => s.leave);

  const hasTrack = !!state.videoId;
  const playing = hasTrack && !state.paused && tunedIn;

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-40 max-w-[20rem]">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2.5 rounded-full border bg-card/70 px-2.5 py-1.5 shadow-lg backdrop-blur-xl",
          "ring-1 ring-white/5",
        )}
      >
        {/* Vibe glyph: animated bars when playing, music icon when not */}
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: room
              ? `color-mix(in oklch, ${room.accent} 28%, transparent)`
              : "color-mix(in oklch, var(--primary) 25%, transparent)",
          }}
        >
          {playing ? <Bars accent={room?.accent ?? "var(--primary)"} /> : <Music2 className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {room?.name ?? "Room"}
          </p>
          <p className="truncate text-[12px] font-medium text-foreground" title={title}>
            {title || (hasTrack ? "Loading…" : "No track yet")}
          </p>
        </div>

        {hasTrack && !tunedIn && (
          <button
            onClick={() => {
              setTunedIn(true);
              const p = useJukeboxStore.getState().player;
              if (p && state.videoId) {
                try {
                  p.loadVideoById(state.videoId, 0);
                } catch {
                  /* ignore */
                }
              }
            }}
            title="Tune in (enable audio)"
            className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90"
          >
            <Headphones className="size-4" />
          </button>
        )}

        {hasTrack && tunedIn && (
          <button
            onClick={() => {
              const p = useJukeboxStore.getState().player;
              if (p) {
                if (state.paused) p.playVideo();
                else p.pauseVideo();
              }
              void togglePlayback();
            }}
            title={state.paused ? "Play" : "Pause"}
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70"
          >
            {state.paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4" />}
          </button>
        )}

        <Link
          href={`/rooms/${roomId}`}
          title="Back to room"
          className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          Open
        </Link>

        <button
          onClick={leave}
          title="Leave room"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Bars({ accent }: { accent: string }) {
  const bar = "w-[3px] rounded-sm";
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      <span className={cn(bar, "animate-[bar1_1s_ease-in-out_infinite]")} style={{ background: accent, height: 6 }} />
      <span className={cn(bar, "animate-[bar2_1.2s_ease-in-out_infinite]")} style={{ background: accent, height: 12 }} />
      <span className={cn(bar, "animate-[bar3_0.9s_ease-in-out_infinite]")} style={{ background: accent, height: 9 }} />
    </span>
  );
}
