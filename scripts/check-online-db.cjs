// Local Postgres regression tests. Install the isolated test dependency with:
// npm install --prefix .expo/sql-validation --no-save @electric-sql/pglite
const { PGlite } = require('../.expo/sql-validation/node_modules/@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema realtime;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_user::text$$;
    create table realtime.messages(extension text);
    alter table realtime.messages enable row level security;
    grant usage on schema public, auth, realtime to authenticated, anon;
    grant select,insert on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create table public.test_broadcasts(payload jsonb,event text,topic text,private boolean);
    create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into public.test_broadcasts values(payload,event,topic,private)$$;
    create publication supabase_realtime;
  `);
  await db.exec(fs.readFileSync('supabase-schema.sql','utf8'));
  await db.exec(fs.readFileSync('supabase-schema-v2.sql','utf8'));
  const migration = fs.readFileSync('supabase/migrations/202609160001_online_security.sql','utf8');
  await db.exec(migration);
  await db.exec(migration); // migration must be safely repeatable
  const users = Array.from({length:6}, (_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
  for (const id of users) await db.query('insert into auth.users values($1)',[id]);
  async function as(id, sql, params=[]) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec('set role authenticated');
    try { return (await db.query(sql,params)).rows; }
    finally { await db.exec('reset role'); }
  }
  await as(users[0],"select open_ludo_room('ABCDE','DUEL',true)");
  await as(users[1],"select open_ludo_room('ABCDE','DUEL',false)");
  await assert.rejects(as(users[2],"select open_ludo_room('ABCDE','DUEL',false)"), /full/);
  assert.equal((await as(users[2],"select * from rooms")).length,0,'outsider cannot discover rooms');
  await assert.rejects(as(users[1],"update rooms set host_id=$1 where code='ABCDE'",[users[1]]),/permission denied/);
  const {createGame}=require('../engine'); const {buildMatch}=require('../online');
  const match=buildMatch(users.slice(0,2).map((id,i)=>({id,joinedAt:i})), 'DUEL');
  const state=createGame(2,[],{players:match.players});
  await assert.rejects(as(users[1],"select save_ludo_state('ABCDE',$1,$2)",[state,match]),/Only the host/);
  await as(users[0],"select save_ludo_state('ABCDE',$1,$2)",[state,match]);
  await as(users[1],"select send_ludo_intent('ABCDE',$1,1)",[{type:'roll',from:users[0]}]);
  const message=(await db.query("select payload from test_broadcasts where event='intent'")).rows[0].payload;
  assert.equal(message.from,users[1],'sender cannot impersonate host');
  await as(users[1],"select send_ludo_intent('ABCDE',$1,0)",[{type:'roll'}]);
  assert.equal((await db.query("select * from test_broadcasts where event='intent'")).rows.length,1,'stale move ignored');
  await assert.rejects(as(users[2],"select send_ludo_intent('ABCDE',$1,1)",[{type:'roll'}]),/No active seat/);
  await db.exec("select set_config('realtime.topic','ludo-room:ABCDE',false)");
  await assert.rejects(as(users[1],"insert into realtime.messages values('broadcast')"),/row-level security/);
  await as(users[1],"insert into realtime.messages values('presence')");
  await as(users[1],"select leave_ludo_room('ABCDE')");
  assert.equal((await db.query("select status from rooms where code='ABCDE'")).rows[0].status,'playing','guest leave does not end match');
  await as(users[0],"select leave_ludo_room('ABCDE')");
  assert.equal((await db.query("select status from rooms where code='ABCDE'")).rows[0].status,'finished');
  for (const id of users.slice(2)) await as(id,"select join_ludo_queue('DUEL')");
  const first=(await as(users[2],"select poll_ludo_queue('DUEL') as result"))[0].result;
  const repeat=(await as(users[2],"select poll_ludo_queue('DUEL') as result"))[0].result;
  assert.equal(first.code,repeat.code,'retry must use same match');
  const peer=(await as(users[3],"select poll_ludo_queue('DUEL') as result"))[0].result;
  assert.equal(first.code,peer.code);
  const next=(await as(users[4],"select poll_ludo_queue('DUEL') as result"))[0].result;
  assert.notEqual(first.code,next.code,'next pair has separate room');
  await assert.rejects(as(users[4],"update matchmaking_queue set room_code='ABCDE'"),/permission denied/);
  await as(users[2],'select delete_my_account()');
  assert.equal((await db.query('select * from auth.users where id=$1',[users[2]])).rows.length,0);
  await db.close();
  console.log('Database checks passed: migration twice, capacity, privacy, host authority, sender identity, replay, broadcast denial, queue pairing, guest leave, deletion.');
})().catch(error=>{ console.error(error.message, error.position, error.query?.slice(Math.max(0, Number(error.position)-200), Number(error.position)+100)); process.exitCode=1; });

