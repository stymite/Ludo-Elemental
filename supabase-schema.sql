-- Run this in your Supabase SQL Editor

-- 1. Create Profiles Table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  username text,
  avatar_url text,
  coins integer default 0,
  level integer default 1,
  primary key (id)
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 2. Create Rooms Table
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  host_id uuid references public.profiles(id) not null,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'waiting', -- 'waiting', 'playing', 'finished'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rooms enable row level security;

-- For development, let's allow anyone to read and insert rooms
-- In production, you'd restrict this to authenticated users
create policy "Rooms are viewable by everyone."
  on rooms for select
  using ( true );

create policy "Authenticated users can insert rooms."
  on rooms for insert
  with check ( auth.role() = 'authenticated' );

create policy "Participants can update room."
  on rooms for update
  using ( auth.role() = 'authenticated' ); -- could be more restrictive

-- Enable realtime for rooms table
alter publication supabase_realtime add table rooms;

-- 3. Create Matchmaking Queue Table
create table public.matchmaking_queue (
  user_id uuid references public.profiles(id) primary key,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.matchmaking_queue enable row level security;

create policy "Users can insert themselves into queue."
  on matchmaking_queue for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete themselves from queue."
  on matchmaking_queue for delete
  using ( auth.uid() = user_id );

create policy "Queue is viewable by everyone."
  on matchmaking_queue for select
  using ( true );
