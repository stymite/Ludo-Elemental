-- V2 migration. Run this in the Supabase SQL editor AFTER supabase-schema.sql.
-- Safe to run more than once: every statement is guarded.
--
-- Adds what online V1 needs beyond Faran's original schema: game modes, a
-- resumable state snapshot, and a matchmaking queue that knows what it is
-- queueing for.
--
-- PREREQUISITE, and it is a dashboard toggle rather than SQL:
--   Authentication -> Sign In / Providers -> enable "Anonymous sign-ins".
-- "Play as guest" signs in anonymously so a guest still gets a real auth.users
-- row. Without it every RLS policy below rejects guests, because they all key
-- off auth.uid(), and guests would be unable to play online at all.

-- ---------------------------------------------------------------- rooms ---

-- Which match type the room is running. Drives how many players are needed
-- before it can start, and whether teams apply.
alter table public.rooms
  add column if not exists mode text not null default 'FFA';

-- The result of buildMatch(): who is on which colour, and the team map. Kept
-- next to the state so a reconnecting player can be handed back their own
-- colour rather than being reseated.
alter table public.rooms
  add column if not exists match jsonb;

-- Set when a room was created by matchmaking rather than by a person sharing a
-- code. Public rooms are the only ones the queue is allowed to hand out.
alter table public.rooms
  add column if not exists is_public boolean not null default false;

alter table public.rooms
  add column if not exists updated_at timestamptz not null default now();

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_open_idx
  on public.rooms (mode, status, is_public, created_at)
  where status = 'waiting';

-- The host snapshots state after every turn, so the row is written constantly.
-- Touch updated_at automatically rather than trusting every writer to do it.
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------- matchmaking queue ---

-- A queue entry has to say what it is waiting for, or 1v1 players get matched
-- into 2v2 games.
alter table public.matchmaking_queue
  add column if not exists mode text not null default 'FFA';

-- Set by whoever forms the match; the waiting client polls its own row and
-- joins this code when it appears.
alter table public.matchmaking_queue
  add column if not exists room_code text;

create index if not exists matchmaking_queue_mode_idx
  on public.matchmaking_queue (mode, joined_at);

-- Waiting players must be able to see each other to pair up at all.
drop policy if exists "Queue is viewable by everyone." on public.matchmaking_queue;
create policy "Queue is viewable by everyone."
  on public.matchmaking_queue for select using ( true );

-- Whoever forms a match writes the room code onto the other waiting rows, so
-- update cannot be restricted to your own row here.
drop policy if exists "Authenticated users can update queue rows." on public.matchmaking_queue;
create policy "Authenticated users can update queue rows."
  on public.matchmaking_queue for update
  using ( (select auth.role()) = 'authenticated' );

-- ----------------------------------------------------------- policy speed ---

-- The same rules supabase-schema.sql creates, with auth.uid() / auth.role()
-- wrapped in a select so Postgres evaluates them once per query instead of once
-- per row (Supabase advisor 0003, auth_rls_initplan). Dropped and recreated, so
-- this stays safe to re-run.
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( (select auth.uid()) = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( (select auth.uid()) = id );

drop policy if exists "Authenticated users can insert rooms." on public.rooms;
create policy "Authenticated users can insert rooms."
  on public.rooms for insert
  with check ( (select auth.role()) = 'authenticated' );

-- ponytail: any signed-in player may update any room — the host snapshots and
-- whoever leaves marks it finished. A hostile client could overwrite another
-- room's state. Upgrade path: restrict to host_id plus the seated players once
-- rooms record their members server-side.
drop policy if exists "Participants can update room." on public.rooms;
create policy "Participants can update room."
  on public.rooms for update
  using ( (select auth.role()) = 'authenticated' );

drop policy if exists "Users can insert themselves into queue." on public.matchmaking_queue;
create policy "Users can insert themselves into queue."
  on public.matchmaking_queue for insert
  with check ( (select auth.uid()) = user_id );

drop policy if exists "Users can delete themselves from queue." on public.matchmaking_queue;
create policy "Users can delete themselves from queue."
  on public.matchmaking_queue for delete
  using ( (select auth.uid()) = user_id );

-- ------------------------------------------------------------- profiles ---

-- Guests are anonymous auth users and still need a profile row, because
-- rooms.host_id references profiles(id).
alter table public.profiles
  add column if not exists is_guest boolean not null default false;

-- ---------------------------------------------------------- table access ---

-- Row-level security decides WHICH rows a player may touch, but only after the
-- role is allowed to touch the table at all. Tables created from the SQL editor
-- are not granted to the API roles on newer Supabase projects, and without this
-- every read and write from the app is refused with "permission denied for
-- table" (HTTP 403) before a single policy above is even consulted: guest
-- names never save, a dropped player cannot rejoin, and Play Online never finds
-- a match. Party Code still works without it, because it only uses Realtime.
grant select, insert, update, delete
  on public.profiles, public.rooms, public.matchmaking_queue
  to authenticated;
grant select on public.profiles, public.rooms, public.matchmaking_queue to anon;

-- ------------------------------------------------------ account deletion ---

-- Google Play requires that an account made in the app can be deleted from the
-- app. A client cannot delete its own auth user, so this runs as the function
-- owner, and only ever on auth.uid() — the caller, never an argument anyone
-- could pass. Queue rows and hosted rooms reference profiles without a cascade,
-- so they go first; the profile goes with the auth user (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from public.matchmaking_queue where user_id = me;
  delete from public.rooms where host_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- tidy ---

-- Abandoned rooms would otherwise accumulate forever. Nothing calls this on a
-- schedule yet; run it by hand, or attach it to pg_cron when there is traffic
-- worth tidying.
-- ponytail: manual sweep, not a scheduled job. Upgrade path is pg_cron once
-- room volume justifies it.
create or replace function public.sweep_stale_rooms()
returns void language sql
set search_path = ''
as $$
  delete from public.rooms where updated_at < now() - interval '6 hours';
  delete from public.matchmaking_queue where joined_at < now() - interval '1 hour';
$$;

-- An admin chore, not something a player should be able to trigger over the API.
revoke execute on function public.sweep_stale_rooms() from public, anon, authenticated;

-- rls_auto_enable is Supabase's own "turn RLS on for new tables" event trigger
-- function. Nothing calls it over the API, but it is exposed there as SECURITY
-- DEFINER (advisor 0028 / 0029). Guarded: absent on older projects, and owned by
-- a role that may refuse the revoke, which must not abort this whole script.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    begin
      revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    exception when insufficient_privilege then
      raise notice 'rls_auto_enable: not the owner, left as is';
    end;
  end if;
end;
$$;
