-- Study with me — schema
-- Run this in Supabase → SQL Editor (or via the CLI).

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('focus', 'short', 'long', 'free')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_ms bigint not null check (duration_ms >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_ended_idx
  on public.sessions (user_id, ended_at desc);

-- Row Level Security: a user can only see and write their own rows.
alter table public.sessions enable row level security;

-- Scoped to the `authenticated` role (anonymous sign-in users belong to it),
-- so the truly-public `anon` role is never considered.
drop policy if exists "own sessions: select" on public.sessions;
create policy "own sessions: select"
  on public.sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own sessions: insert" on public.sessions;
create policy "own sessions: insert"
  on public.sessions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own sessions: delete" on public.sessions;
create policy "own sessions: delete"
  on public.sessions for delete to authenticated
  using (auth.uid() = user_id);

-- ── Room chat messages ────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  text text not null check (char_length(text) between 1 and 400),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

alter table public.messages enable row level security;

-- room chat is shared: any signed-in user can read messages
drop policy if exists "messages: read" on public.messages;
create policy "messages: read"
  on public.messages for select to authenticated
  using (true);

-- but you can only post as yourself
drop policy if exists "messages: insert own" on public.messages;
create policy "messages: insert own"
  on public.messages for insert to authenticated
  with check (auth.uid() = user_id);

-- broadcast inserts to subscribers via Realtime (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ── Room music (shared "DJ" state per room) ───────────────────────────
create table if not exists public.room_music (
  room_id text primary key,
  video_id text,
  paused boolean not null default true,
  -- wall-clock time the current track started (for late-join sync)
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.room_music enable row level security;

drop policy if exists "room_music: read" on public.room_music;
create policy "room_music: read"
  on public.room_music for select to authenticated
  using (true);

-- anyone in the room can DJ (set/change track, play/pause)
drop policy if exists "room_music: upsert" on public.room_music;
create policy "room_music: upsert"
  on public.room_music for insert to authenticated
  with check (auth.uid() = updated_by);

drop policy if exists "room_music: update" on public.room_music;
create policy "room_music: update"
  on public.room_music for update to authenticated
  using (true)
  with check (auth.uid() = updated_by);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_music'
  ) then
    alter publication supabase_realtime add table public.room_music;
  end if;
end $$;
