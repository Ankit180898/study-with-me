import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session, TimerMode } from "@/store/focus-store";

interface SessionRow {
  id: string;
  user_id: string;
  mode: TimerMode;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  completed: boolean;
}

function rowToSession(r: SessionRow): Session {
  return {
    id: r.id,
    mode: r.mode,
    startedAt: new Date(r.started_at).getTime(),
    endedAt: new Date(r.ended_at).getTime(),
    durationMs: Number(r.duration_ms),
    completed: r.completed,
  };
}

function sessionToRow(s: Session, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    mode: s.mode,
    started_at: new Date(s.startedAt).toISOString(),
    ended_at: new Date(s.endedAt).toISOString(),
    duration_ms: s.durationMs,
    completed: s.completed,
  };
}

export async function fetchSessions(sb: SupabaseClient, userId: string): Promise<Session[]> {
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("ended_at", { ascending: true });
  if (error) throw error;
  return (data as SessionRow[]).map(rowToSession);
}

export async function insertSessions(
  sb: SupabaseClient,
  userId: string,
  sessions: Session[],
): Promise<void> {
  if (sessions.length === 0) return;
  const { error } = await sb.from("sessions").insert(sessions.map((s) => sessionToRow(s, userId)));
  if (error) throw error;
}
