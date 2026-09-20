-- Run after schemas 1 and 2. One transaction; existing accounts are preserved.
begin;
alter table public.rooms add column if not exists revision bigint not null default 0;
create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_members enable row level security;

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;
revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

-- Replace old permissive policies, including policies added by earlier SQL.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('rooms','matchmaking_queue','room_members')
  loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
end $$;
create policy room_read on public.rooms for select to authenticated using (public.is_room_member(id));
create policy members_read on public.room_members for select to authenticated using (public.is_room_member(room_id));
create policy queue_read on public.matchmaking_queue for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.rooms, public.room_members, public.matchmaking_queue from anon, authenticated;
grant select on public.rooms, public.room_members, public.matchmaking_queue to authenticated;

create or replace function public.open_ludo_room(p_code text, p_mode text default 'FFA', p_create boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rooms; me uuid := auth.uid(); n integer;
begin
  if me is null then raise exception 'Sign in to play online'; end if;
  if p_mode not in ('FFA','DUEL','TEAM') or p_code !~ '^[A-HJ-NP-Z2-9]{5}$' then
    raise exception 'Invalid room or mode'; end if;
  -- Serialize admission, room creation and capacity checks for this code.
  perform pg_advisory_xact_lock(hashtextextended(p_code, 0));
  select * into r from public.rooms where code = p_code for update;
  if r.id is null then
    if not p_create then raise exception 'No room with that code'; end if;
    if (select count(*) from public.rooms where host_id = me and updated_at > now() - interval '6 hours' and status <> 'finished') >= 5 then
      raise exception 'Leave your previous rooms before creating another'; end if;
    insert into public.profiles(id) values(me) on conflict do nothing;
    insert into public.rooms(code, host_id, mode) values(p_code, me, p_mode) returning * into r;
  elsif p_create and r.host_id <> me then
    raise exception 'Room code already in use';
  end if;
  if r.updated_at < now() - interval '6 hours' or r.status = 'finished' then raise exception 'That game has ended'; end if;
  if not exists(select 1 from public.room_members where room_id = r.id and user_id = me) then
    if r.status <> 'waiting' then raise exception 'That game has already started'; end if;
    if r.is_public then raise exception 'Join public games through matchmaking'; end if;
    select count(*) into n from public.room_members where room_id = r.id;
    if n >= (case when r.mode = 'DUEL' then 2 else 4 end) then raise exception 'That room is full'; end if;
    insert into public.room_members(room_id,user_id) values(r.id,me);
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.leave_ludo_room(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = p_code for update;
  if r.host_id = auth.uid() then
    update public.rooms set status = 'finished' where id = r.id;
    perform realtime.send('{"ended":true}'::jsonb, 'ended', 'ludo-room:' || p_code, true);
  elsif r.status = 'waiting' then
    delete from public.room_members where room_id = r.id and user_id = auth.uid();
  end if;
end $$;

create or replace function public.save_ludo_state(p_code text, p_state jsonb, p_match jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = p_code for update;
  if r.id is null or r.host_id <> auth.uid() or auth.uid() is null then raise exception 'Only the host can save'; end if;
  if r.status = 'finished' and coalesce(r.state->>'gameOver','false') <> 'true' then raise exception 'Room has ended'; end if;
  if jsonb_typeof(p_state) <> 'object' or jsonb_typeof(p_match->'assignments') <> 'array'
     or octet_length(p_state::text) > 100000 or octet_length(p_match::text) > 180000 then raise exception 'Invalid state'; end if;
  if exists(select 1 from jsonb_array_elements(p_match->'assignments') a
    where not exists(select 1 from public.room_members m where m.room_id = r.id and m.user_id::text = a->>'id')) then
    raise exception 'Unknown player'; end if;
  update public.rooms set state = p_state, match = p_match,
    status = case when p_state->>'gameOver' = 'true' then 'finished' else 'playing' end,
    revision = revision + 1 where id = r.id returning * into r;
  perform realtime.send(jsonb_build_object('state',r.state,'seats',r.match,'revision',r.revision),
    'state','ludo-room:' || p_code,true);
  return r.revision;
end $$;

-- Sender identity is assigned by Postgres, never accepted from a payload.
create or replace function public.send_ludo_intent(p_code text, p_intent jsonb, p_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = p_code;
  if r.id is null or not public.is_room_member(r.id) or r.status <> 'playing' then raise exception 'No active seat'; end if;
  if p_revision <> r.revision then return; end if;
  if p_intent->>'type' not in ('roll','move','shield','gust','fire','wall','skipAbility')
    or octet_length(p_intent::text) > 1024 then raise exception 'Invalid move'; end if;
  perform realtime.send(p_intent || jsonb_build_object('from',auth.uid(),'revision',r.revision),
    'intent','ludo-room:' || p_code,true);
end $$;

create or replace function public.join_ludo_queue(p_mode text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or p_mode not in ('FFA','DUEL','TEAM') then raise exception 'Sign in and choose a mode'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ludo-queue',0));
  insert into public.profiles(id) values(me) on conflict do nothing;
  insert into public.matchmaking_queue(user_id, mode, room_code, joined_at) values(me,p_mode,null,now())
    on conflict(user_id) do update set mode = p_mode, room_code = null, joined_at = now();
  return me;
end $$;

create or replace function public.leave_ludo_queue()
returns void language sql security definer set search_path = '' as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

create or replace function public.poll_ludo_queue(p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ids uuid[]; n integer; c text; host uuid; r public.rooms;
begin
  if me is null or p_mode not in ('FFA','DUEL','TEAM') then raise exception 'Invalid queue'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ludo-queue',0));
  select room_code into c from public.matchmaking_queue where user_id = me and mode = p_mode;
  if not found then return jsonb_build_object('status','waiting','waiting',0); end if;
  if c is null then
    n := case when p_mode = 'DUEL' then 2 else 4 end;
    select array_agg(user_id order by joined_at,user_id) into ids from
      (select user_id,joined_at from public.matchmaking_queue where mode = p_mode and room_code is null
       and joined_at > now() - interval '150 seconds' order by joined_at,user_id limit n) q;
    if coalesce(cardinality(ids),0) < n then return jsonb_build_object('status','waiting','waiting',coalesce(cardinality(ids),0)); end if;
    host := ids[1];
    loop
      c := '';
      for i in 1..5 loop c := c || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::integer, 1); end loop;
      begin
        insert into public.rooms(code,host_id,mode,is_public) values(c,host,p_mode,true) returning * into r;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    insert into public.room_members(room_id,user_id) select r.id,unnest(ids);
    update public.matchmaking_queue set room_code = c where user_id = any(ids);
    -- A polling player outside the first group must stay in its own queue.
    if not me = any(ids) then return jsonb_build_object('status','waiting','waiting',1); end if;
  end if;
  select * into r from public.rooms where code = c;
  return jsonb_build_object('status',case when r.host_id = me then 'forming' else 'matched' end,'code',c);
end $$;

-- Private channel clients can receive messages and publish presence ONLY.
-- All broadcasts originate in the authenticated functions above.
drop policy if exists ludo_receive on realtime.messages;
drop policy if exists ludo_presence on realtime.messages;
create policy ludo_receive on realtime.messages for select to authenticated using (
  exists(select 1 from public.rooms r where 'ludo-room:' || r.code = realtime.topic() and public.is_room_member(r.id))
);
create policy ludo_presence on realtime.messages for insert to authenticated with check (
  extension = 'presence' and exists(select 1 from public.rooms r where 'ludo-room:' || r.code = realtime.topic() and public.is_room_member(r.id))
);
-- Restrictive guard prevents any older permissive broadcast policy bypassing this.
drop policy if exists ludo_no_client_broadcast on realtime.messages;
create policy ludo_no_client_broadcast on realtime.messages as restrictive for insert to authenticated with check (
  realtime.topic() not like 'ludo-room:%' or extension = 'presence'
);

revoke all on function public.open_ludo_room(text,text,boolean), public.leave_ludo_room(text),
  public.save_ludo_state(text,jsonb,jsonb), public.send_ludo_intent(text,jsonb,bigint),
  public.join_ludo_queue(text), public.leave_ludo_queue(), public.poll_ludo_queue(text) from public, anon;
grant execute on function public.open_ludo_room(text,text,boolean), public.leave_ludo_room(text),
  public.save_ludo_state(text,jsonb,jsonb), public.send_ludo_intent(text,jsonb,bigint),
  public.join_ludo_queue(text), public.leave_ludo_queue(), public.poll_ludo_queue(text) to authenticated;
commit;
