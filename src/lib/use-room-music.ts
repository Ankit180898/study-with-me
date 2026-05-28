"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";

export interface RoomMusicState {
  videoId: string | null;
  paused: boolean;
  startedAt: number | null;
  updatedAt: number;
  updatedBy: string | null;
}

interface Row {
  room_id: string;
  video_id: string | null;
  paused: boolean;
  started_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

function rowToState(r: Row): RoomMusicState {
  return {
    videoId: r.video_id,
    paused: r.paused,
    startedAt: r.started_at ? new Date(r.started_at).getTime() : null,
    updatedAt: new Date(r.updated_at).getTime(),
    updatedBy: r.updated_by,
  };
}

const EMPTY: RoomMusicState = {
  videoId: null,
  paused: true,
  startedAt: null,
  updatedAt: 0,
  updatedBy: null,
};

export function useRoomMusic(roomId: string) {
  const { supabase, userId } = useSupabase();
  const [state, setState] = useState<RoomMusicState>(EMPTY);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("room_music")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();
      if (active && data) setState(rowToState(data as Row));
    })();

    const channel = supabase
      .channel(`music:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_music", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setState(EMPTY);
          else setState(rowToState(payload.new as Row));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId]);

  const setTrack = useCallback(
    async (videoId: string) => {
      if (!supabase || !userId) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("room_music").upsert(
        {
          room_id: roomId,
          video_id: videoId,
          paused: false,
          started_at: now,
          updated_at: now,
          updated_by: userId,
        },
        { onConflict: "room_id" },
      );
      if (error) console.warn("[supabase] setTrack failed", error.message);
    },
    [supabase, userId, roomId],
  );

  const togglePlayback = useCallback(async () => {
    if (!supabase || !userId || !state.videoId) return;
    const nowPaused = !state.paused;
    const now = new Date().toISOString();
    // when resuming, reset startedAt so others can sync from "now"
    const startedAt = nowPaused ? state.startedAt : now;
    const { error } = await supabase.from("room_music").upsert(
      {
        room_id: roomId,
        video_id: state.videoId,
        paused: nowPaused,
        started_at: startedAt,
        updated_at: now,
        updated_by: userId,
      },
      { onConflict: "room_id" },
    );
    if (error) console.warn("[supabase] togglePlayback failed", error.message);
  }, [supabase, userId, roomId, state]);

  return { state, setTrack, togglePlayback };
}
