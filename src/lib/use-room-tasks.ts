"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useSupabase } from "@/lib/supabase/provider";
import { useProfile } from "@/lib/use-profile";

export interface RoomTask {
  id: string;
  roomId: string;
  text: string;
  done: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  completedAt: number | null;
  completedBy: string | null;
  completedByName: string | null;
}

interface TaskRow {
  id: string;
  room_id: string;
  text: string;
  done: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
}

function rowToTask(r: TaskRow): RoomTask {
  return {
    id: r.id,
    roomId: r.room_id,
    text: r.text,
    done: r.done,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: new Date(r.created_at).getTime(),
    completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
    completedBy: r.completed_by,
    completedByName: r.completed_by_name,
  };
}

export function useRoomTasks(roomId: string) {
  const { supabase, userId } = useSupabase();
  const { displayName } = useProfile();
  const [tasks, setTasks] = useState<RoomTask[]>([]);
  const instanceId = useId();

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("room_tasks")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setTasks((data ?? []).map((r) => rowToTask(r as TaskRow)));
    })();

    const ch = supabase
      .channel(`tasks:${roomId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_tasks",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as TaskRow;
            setTasks((prev) => prev.filter((t) => t.id !== old.id));
            return;
          }
          const row = payload.new as TaskRow;
          const task = rowToTask(row);
          setTasks((prev) => {
            const without = prev.filter((t) => t.id !== task.id);
            return [...without, task].sort((a, b) => a.createdAt - b.createdAt);
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [supabase, roomId, instanceId]);

  const addTask = useCallback(
    async (text: string) => {
      if (!supabase || !userId) return;
      const trimmed = text.trim().slice(0, 140);
      if (!trimmed) return;
      // Optimistic — show it immediately with a temp id.
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: RoomTask = {
        id: tempId,
        roomId,
        text: trimmed,
        done: false,
        createdBy: userId,
        createdByName: displayName,
        createdAt: Date.now(),
        completedAt: null,
        completedBy: null,
        completedByName: null,
      };
      setTasks((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from("room_tasks")
        .insert({
          room_id: roomId,
          text: trimmed,
          created_by: userId,
          created_by_name: displayName,
        })
        .select("*")
        .single();
      if (error || !data) {
        console.warn("[supabase] addTask", error?.message);
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        return;
      }
      // Swap temp row for the canonical one (realtime will also deliver
      // this insert, but the rowToTask dedupe-by-id keeps it consistent).
      const real = rowToTask(data as TaskRow);
      setTasks((prev) => {
        const without = prev.filter((t) => t.id !== tempId && t.id !== real.id);
        return [...without, real].sort((a, b) => a.createdAt - b.createdAt);
      });
    },
    [supabase, userId, roomId, displayName],
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      if (!supabase || !userId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const nextDone = !task.done;
      const nowIso = new Date().toISOString();
      // Optimistic flip.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                done: nextDone,
                completedAt: nextDone ? Date.now() : null,
                completedBy: nextDone ? userId : null,
                completedByName: nextDone ? displayName : null,
              }
            : t,
        ),
      );
      const { error } = await supabase
        .from("room_tasks")
        .update({
          done: nextDone,
          completed_at: nextDone ? nowIso : null,
          completed_by: nextDone ? userId : null,
          completed_by_name: nextDone ? displayName : null,
        })
        .eq("id", taskId);
      if (error) {
        console.warn("[supabase] toggleTask", error.message);
        // Revert.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  done: task.done,
                  completedAt: task.completedAt,
                  completedBy: task.completedBy,
                  completedByName: task.completedByName,
                }
              : t,
          ),
        );
      }
    },
    [supabase, userId, displayName, tasks],
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!supabase) return;
      const snapshot = tasks;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const { error } = await supabase
        .from("room_tasks")
        .delete()
        .eq("id", taskId);
      if (error) {
        console.warn("[supabase] removeTask", error.message);
        setTasks(snapshot);
      }
    },
    [supabase, tasks],
  );

  const clearCompleted = useCallback(async () => {
    if (!supabase) return;
    const completed = tasks.filter((t) => t.done);
    if (completed.length === 0) return;
    const snapshot = tasks;
    setTasks((prev) => prev.filter((t) => !t.done));
    const { error } = await supabase
      .from("room_tasks")
      .delete()
      .eq("room_id", roomId)
      .eq("done", true);
    if (error) {
      console.warn("[supabase] clearCompleted", error.message);
      setTasks(snapshot);
    }
  }, [supabase, roomId, tasks]);

  return { tasks, addTask, toggleTask, removeTask, clearCompleted };
}
