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

-- ── Room polls (lightweight engagement) ───────────────────────────────
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  question text not null check (char_length(question) between 1 and 140),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  created_at timestamptz not null default now()
);

create index if not exists polls_room_created_idx
  on public.polls (room_id, created_at desc);

alter table public.polls enable row level security;

drop policy if exists "polls: read" on public.polls;
create policy "polls: read"
  on public.polls for select to authenticated using (true);

drop policy if exists "polls: insert own" on public.polls;
create policy "polls: insert own"
  on public.polls for insert to authenticated
  with check (auth.uid() = user_id);

-- one vote per (poll, user); change via upsert
create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option_index int not null check (option_index >= 0 and option_index < 4),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

drop policy if exists "poll_votes: read" on public.poll_votes;
create policy "poll_votes: read"
  on public.poll_votes for select to authenticated using (true);

drop policy if exists "poll_votes: insert own" on public.poll_votes;
create policy "poll_votes: insert own"
  on public.poll_votes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "poll_votes: update own" on public.poll_votes;
create policy "poll_votes: update own"
  on public.poll_votes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "poll_votes: delete own" on public.poll_votes;
create policy "poll_votes: delete own"
  on public.poll_votes for delete to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'polls'
  ) then alter publication supabase_realtime add table public.polls;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then alter publication supabase_realtime add table public.poll_votes;
  end if;
end $$;

-- ── Room music queue (collaborative DJ queue) ─────────────────────────
-- room_music keeps the "now playing" state; this table is the upcoming
-- queue. When current ends or someone skips, the oldest unplayed item
-- gets promoted into room_music and marked played.
create table if not exists public.room_music_queue (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  video_id text not null,
  title text,
  added_by uuid not null references auth.users (id) on delete cascade,
  added_by_name text not null,
  created_at timestamptz not null default now(),
  played_at timestamptz
);

create index if not exists room_music_queue_room_idx
  on public.room_music_queue (room_id, played_at, created_at);

alter table public.room_music_queue enable row level security;

drop policy if exists "queue: read" on public.room_music_queue;
create policy "queue: read"
  on public.room_music_queue for select to authenticated using (true);

drop policy if exists "queue: insert own" on public.room_music_queue;
create policy "queue: insert own"
  on public.room_music_queue for insert to authenticated
  with check (auth.uid() = added_by);

-- anyone in the room can mark items as played (advance the queue) or remove
drop policy if exists "queue: update any" on public.room_music_queue;
create policy "queue: update any"
  on public.room_music_queue for update to authenticated
  using (true) with check (true);

drop policy if exists "queue: delete any" on public.room_music_queue;
create policy "queue: delete any"
  on public.room_music_queue for delete to authenticated using (true);

-- upvote tracking — composite PK enforces one vote per (item, user)
create table if not exists public.queue_votes (
  queue_id uuid not null references public.room_music_queue (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (queue_id, user_id)
);

alter table public.queue_votes enable row level security;

drop policy if exists "queue_votes: read" on public.queue_votes;
create policy "queue_votes: read"
  on public.queue_votes for select to authenticated using (true);

drop policy if exists "queue_votes: write own" on public.queue_votes;
create policy "queue_votes: write own"
  on public.queue_votes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "queue_votes: delete own" on public.queue_votes;
create policy "queue_votes: delete own"
  on public.queue_votes for delete to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_music_queue'
  ) then alter publication supabase_realtime add table public.room_music_queue;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_votes'
  ) then alter publication supabase_realtime add table public.queue_votes;
  end if;
end $$;

-- ── Room tasks (shared checklist per room) ────────────────────────────
-- Lightweight group todo list. Anyone in the room can add, check off, or
-- remove any task — matches the "anyone can DJ" model. Completed tasks
-- stay visible (struck through) so the group sees progress; removing is
-- the explicit purge action.
create table if not exists public.room_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  text text not null check (char_length(text) between 1 and 140),
  done boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  completed_by_name text
);

create index if not exists room_tasks_room_created_idx
  on public.room_tasks (room_id, created_at desc);

alter table public.room_tasks enable row level security;

drop policy if exists "room_tasks: read" on public.room_tasks;
create policy "room_tasks: read"
  on public.room_tasks for select to authenticated using (true);

drop policy if exists "room_tasks: insert own" on public.room_tasks;
create policy "room_tasks: insert own"
  on public.room_tasks for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "room_tasks: update any" on public.room_tasks;
create policy "room_tasks: update any"
  on public.room_tasks for update to authenticated
  using (true) with check (true);

drop policy if exists "room_tasks: delete any" on public.room_tasks;
create policy "room_tasks: delete any"
  on public.room_tasks for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_tasks'
  ) then alter publication supabase_realtime add table public.room_tasks;
  end if;
end $$;
