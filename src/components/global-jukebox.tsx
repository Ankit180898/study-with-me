"use client";

import { useEffect, useRef, useState } from "react";
import { useJukeboxStore } from "@/lib/jukebox-store";
import { useRoomMusic } from "@/lib/use-room-music";
import { useSupabase } from "@/lib/supabase/provider";
import { advanceQueue } from "@/lib/use-music-queue";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtube";

/**
 * Mounted once at the root. Owns the persistent YouTube iframe so audio
 * survives route changes. Hidden visually; the room rail and floating pill
 * are the user-facing controls.
 */
export function GlobalJukebox() {
  const joinedRoomId = useJukeboxStore((s) => s.joinedRoomId);
  if (!joinedRoomId) return null;
  return <Player roomId={joinedRoomId} key={joinedRoomId} />;
}

function Player({ roomId }: { roomId: string }) {
  const { state } = useRoomMusic(roomId);
  const { supabase, userId } = useSupabase();
  const tunedIn = useJukeboxStore((s) => s.tunedIn);
  const setTitle = useJukeboxStore((s) => s.setTitle);
  const setPlayer = useJukeboxStore((s) => s.setPlayer);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  // keep latest deps for the YT callback, which can't re-bind without a remount.
  const advanceRef = useRef<() => void>(() => {});
  useEffect(() => {
    advanceRef.current = () => {
      if (supabase && userId) void advanceQueue(supabase, roomId, userId);
    };
  }, [supabase, userId, roomId]);

  useEffect(() => {
    let alive = true;
    let player: YTPlayer | null = null;

    loadYouTubeApi().then((YT) => {
      if (!alive || !containerRef.current) return;
      player = new YT.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: 0, controls: 0 },
        events: {
          onReady: () => {
            setReady(true);
            if (player) setPlayer(player);
          },
          onStateChange: (e) => {
            const t = player?.getVideoData?.()?.title;
            if (t) setTitle(t);
            // ENDED = 0 — pop the next queue item into now-playing
            if (e.data === 0) advanceRef.current();
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      alive = false;
      setPlayer(null);
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [setTitle, setPlayer]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready || !state.videoId) return;

    const offsetSec =
      !state.paused && state.startedAt
        ? Math.max(0, (Date.now() - state.startedAt) / 1000)
        : 0;

    // getVideoData can be undefined briefly during init/destroy — guard it.
    const current = p.getVideoData?.()?.video_id ?? null;
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

  // Positioned off-screen at a real size — YouTube pauses audio when the
  // player is hidden via display:none / size:0 / opacity:0, so we use a
  // large left offset instead (still "visible" to the IntersectionObserver).
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: 320,
        height: 180,
        pointerEvents: "none",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
