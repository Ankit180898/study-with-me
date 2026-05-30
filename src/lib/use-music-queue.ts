"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";
import { useProfile } from "@/lib/use-profile";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface QueueItem {
  id: string;
  roomId: string;
  videoId: string;
  title: string | null;
  addedBy: string;
  addedByName: string;
  createdAt: number;
  playedAt: number | null;
}

interface QueueRow {
  id: string;
  room_id: string;
  video_id: string;
  title: string | null;
  added_by: string;
  added_by_name: string;
  created_at: string;
  played_at: string | null;
}

interface VoteRow {
  queue_id: string;
  user_id: string;
}

function rowToItem(r: QueueRow): QueueItem {
  return {
    id: r.id,
    roomId: r.room_id,
    videoId: r.video_id,
    title: r.title,
    addedBy: r.added_by,
    addedByName: r.added_by_name,
    createdAt: new Date(r.created_at).getTime(),
    playedAt: r.played_at ? new Date(r.played_at).getTime() : null,
  };
}

/**
 * Promote the highest-voted unplayed queue item to the now-playing slot
 * (room_music). Marks it as played so it won't be promoted again.
 * Called by GlobalJukebox when a track ends, and by users hitting Skip.
 */
export async function advanceQueue(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<boolean> {
  // get unplayed items
  const { data: items } = await supabase
    .from("room_music_queue")
    .select("*")
    .eq("room_id", roomId)
    .is("played_at", null)
    .order("created_at", { ascending: true });
  if (!items || items.length === 0) {
    // queue empty — clear now-playing
    await supabase
      .from("room_music")
      .upsert(
        {
          room_id: roomId,
          video_id: null,
          paused: true,
          started_at: null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "room_id" },
      );
    return false;
  }
  // get vote counts for these items
  const ids = items.map((r) => (r as QueueRow).id);
  const { data: votes } = await supabase
    .from("queue_votes")
    .select("queue_id")
    .in("queue_id", ids);
  const tally = new Map<string, number>();
  (votes ?? []).forEach((v) =>
    tally.set((v as VoteRow).queue_id, (tally.get((v as VoteRow).queue_id) ?? 0) + 1),
  );
  // pick highest votes; ties broken by earliest created_at (items already sorted)
  const ranked = (items as QueueRow[])
    .map((r) => ({ row: r, votes: tally.get(r.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes); // stable sort preserves created_at order
  const next = ranked[0].row;
  const nowIso = new Date().toISOString();

  await supabase
    .from("room_music_queue")
    .update({ played_at: nowIso })
    .eq("id", next.id);

  await supabase.from("room_music").upsert(
    {
      room_id: roomId,
      video_id: next.video_id,
      paused: false,
      started_at: nowIso,
      updated_at: nowIso,
      updated_by: userId,
    },
    { onConflict: "room_id" },
  );
  return true;
}

export function useMusicQueue(roomId: string) {
  const { supabase, userId } = useSupabase();
  const { displayName } = useProfile();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [votes, setVotes] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("room_music_queue")
        .select("*")
        .eq("room_id", roomId)
        .is("played_at", null)
        .order("created_at", { ascending: true });
      if (!active) return;
      const list = (data ?? []).map((r) => rowToItem(r as QueueRow));
      setItems(list);

      if (list.length > 0) {
        const ids = list.map((i) => i.id);
        const { data: vrows } = await supabase
          .from("queue_votes")
          .select("*")
          .in("queue_id", ids);
        if (!active) return;
        const next: Record<string, Set<string>> = {};
        (vrows ?? []).forEach((v) => {
          const row = v as VoteRow;
          (next[row.queue_id] ??= new Set()).add(row.user_id);
        });
        setVotes(next);
      }
    })();

    const qCh = supabase
      .channel(`queue:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_music_queue", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as QueueRow;
            setItems((prev) => prev.filter((i) => i.id !== old.id));
            return;
          }
          const row = payload.new as QueueRow;
          const item = rowToItem(row);
          setItems((prev) => {
            const without = prev.filter((i) => i.id !== item.id);
            // only show unplayed items
            return item.playedAt ? without : [...without, item].sort((a, b) => a.createdAt - b.createdAt);
          });
        },
      )
      .subscribe();

    const vCh = supabase
      .channel(`queue_votes:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_votes" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = payload.old as VoteRow;
            setVotes((prev) => {
              const next = { ...prev };
              const s = new Set(next[row.queue_id] ?? []);
              s.delete(row.user_id);
              next[row.queue_id] = s;
              return next;
            });
            return;
          }
          const row = payload.new as VoteRow;
          setVotes((prev) => {
            const next = { ...prev };
            const s = new Set(next[row.queue_id] ?? []);
            s.add(row.user_id);
            next[row.queue_id] = s;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(qCh);
      supabase.removeChannel(vCh);
    };
  }, [supabase, roomId]);

  const addToQueue = useCallback(
    async (videoId: string, title?: string) => {
      if (!supabase || !userId) return;
      const { error } = await supabase.from("room_music_queue").insert({
        room_id: roomId,
        video_id: videoId,
        title: title ?? null,
        added_by: userId,
        added_by_name: displayName,
      });
      if (error) {
        console.warn("[supabase] addToQueue", error.message);
        return;
      }
      // if nothing is currently playing, immediately promote.
      const { data: cur } = await supabase
        .from("room_music")
        .select("video_id")
        .eq("room_id", roomId)
        .maybeSingle();
      if (!cur?.video_id) {
        await advanceQueue(supabase, roomId, userId);
      }
    },
    [supabase, userId, roomId, displayName],
  );

  const toggleVote = useCallback(
    async (queueId: string) => {
      if (!supabase || !userId) return;
      const hasVoted = votes[queueId]?.has(userId) ?? false;
      // optimistic
      setVotes((prev) => {
        const next = { ...prev };
        const s = new Set(next[queueId] ?? []);
        if (hasVoted) s.delete(userId);
        else s.add(userId);
        next[queueId] = s;
        return next;
      });
      if (hasVoted) {
        await supabase
          .from("queue_votes")
          .delete()
          .eq("queue_id", queueId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("queue_votes")
          .insert({ queue_id: queueId, user_id: userId });
      }
    },
    [supabase, userId, votes],
  );

  const remove = useCallback(
    async (queueId: string) => {
      if (!supabase) return;
      await supabase.from("room_music_queue").delete().eq("id", queueId);
    },
    [supabase],
  );

  const advance = useCallback(async () => {
    if (!supabase || !userId) return;
    await advanceQueue(supabase, roomId, userId);
  }, [supabase, userId, roomId]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const id of Object.keys(votes)) out[id] = votes[id].size;
    return out;
  }, [votes]);

  const myVotes = useMemo(() => {
    if (!userId) return new Set<string>();
    const out = new Set<string>();
    for (const [id, s] of Object.entries(votes)) if (s.has(userId)) out.add(id);
    return out;
  }, [votes, userId]);

  // Display order: votes desc, then created_at asc
  const ordered = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ca = counts[a.id] ?? 0;
        const cb = counts[b.id] ?? 0;
        if (ca !== cb) return cb - ca;
        return a.createdAt - b.createdAt;
      }),
    [items, counts],
  );

  return { queue: ordered, counts, myVotes, addToQueue, toggleVote, remove, advance };
}
