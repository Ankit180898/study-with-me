"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";
import { useProfile } from "@/lib/use-profile";
import { colorForId } from "@/lib/identity";

export interface Poll {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  color: string;
  question: string;
  options: string[];
  createdAt: number;
}

interface VoteRow {
  poll_id: string;
  user_id: string;
  option_index: number;
}

interface PollRow {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  color: string;
  question: string;
  options: string[];
  created_at: string;
}

function pollFromRow(r: PollRow): Poll {
  return {
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    name: r.name,
    color: r.color,
    question: r.question,
    options: r.options,
    createdAt: new Date(r.created_at).getTime(),
  };
}

/**
 * Per-room polls: fetches recent polls + votes, subscribes to inserts/updates,
 * and exposes actions to create polls and cast votes.
 *
 * Vote storage: `votes[pollId][userId] = optionIndex`.
 */
export function usePolls(roomId: string) {
  const { supabase, userId } = useSupabase();
  const { displayName } = useProfile();
  const color = userId ? colorForId(userId) : "#6366f1";
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const [pollsRes, votesRes] = await Promise.all([
        supabase
          .from("polls")
          .select("*")
          .eq("room_id", roomId)
          .gt("created_at", since)
          .order("created_at", { ascending: true }),
        supabase.from("poll_votes").select("*"),
      ]);
      if (!active) return;
      if (pollsRes.data) {
        const list = (pollsRes.data as PollRow[]).map(pollFromRow);
        setPolls(list);
        const pollIds = new Set(list.map((p) => p.id));
        if (votesRes.data) {
          const next: Record<string, Record<string, number>> = {};
          for (const v of votesRes.data as VoteRow[]) {
            if (!pollIds.has(v.poll_id)) continue;
            (next[v.poll_id] ??= {})[v.user_id] = v.option_index;
          }
          setVotes(next);
        }
      }
    })();

    const pollsCh = supabase
      .channel(`polls:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "polls", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const p = pollFromRow(payload.new as PollRow);
          setPolls((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
        },
      )
      .subscribe();

    const votesCh = supabase
      .channel(`poll_votes:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = payload.old as VoteRow;
            setVotes((prev) => {
              const next = { ...prev };
              const inner = { ...(next[row.poll_id] ?? {}) };
              delete inner[row.user_id];
              next[row.poll_id] = inner;
              return next;
            });
            return;
          }
          const row = payload.new as VoteRow;
          setVotes((prev) => {
            const next = { ...prev };
            next[row.poll_id] = { ...(next[row.poll_id] ?? {}), [row.user_id]: row.option_index };
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(pollsCh);
      supabase.removeChannel(votesCh);
    };
  }, [supabase, roomId]);

  const createPoll = useCallback(
    async (question: string, options: string[]) => {
      if (!supabase || !userId) return;
      const clean = options.map((o) => o.trim()).filter(Boolean).slice(0, 4);
      const q = question.trim();
      if (!q || clean.length < 2) return;
      const { error } = await supabase.from("polls").insert({
        room_id: roomId,
        user_id: userId,
        name: displayName,
        color,
        question: q.slice(0, 140),
        options: clean,
      });
      if (error) console.warn("[supabase] createPoll", error.message);
    },
    [supabase, userId, roomId, displayName, color],
  );

  const vote = useCallback(
    async (pollId: string, optionIndex: number) => {
      if (!supabase || !userId) return;
      // optimistic local update
      setVotes((prev) => {
        const next = { ...prev };
        next[pollId] = { ...(next[pollId] ?? {}), [userId]: optionIndex };
        return next;
      });
      const { error } = await supabase
        .from("poll_votes")
        .upsert(
          { poll_id: pollId, user_id: userId, option_index: optionIndex },
          { onConflict: "poll_id,user_id" },
        );
      if (error) console.warn("[supabase] vote", error.message);
    },
    [supabase, userId],
  );

  const meId = userId ?? null;

  const counts = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const poll of polls) {
      const arr = new Array(poll.options.length).fill(0) as number[];
      const inner = votes[poll.id];
      if (inner) for (const idx of Object.values(inner)) {
        if (idx >= 0 && idx < arr.length) arr[idx] += 1;
      }
      out[poll.id] = arr;
    }
    return out;
  }, [polls, votes]);

  return { polls, votes, counts, meId, createPoll, vote };
}
