// Uses ONLY the app's public key. Creates temporary guest accounts and deletes
// them in finally. Run manually: node scripts/check-live-online.cjs
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const {transformSync}=require('@babel/core');
const {createClient}=require('@supabase/supabase-js');
const config=require('../eas.json').build.preview.env;
const online=require('../online'), engine=require('../engine');
const clients=[], managers=[];
function load(file, deps) {
  const exports={};
  const code=transformSync(fs.readFileSync(file,'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
  vm.runInNewContext(code,{exports,require:name=>{if(name in deps)return deps[name]; throw Error(name);},console,setTimeout,clearTimeout,setInterval,clearInterval},{filename:file});
  return exports;
}
async function until(fn,label) {
  const limit=Date.now()+20000;
  while(Date.now()<limit){if(fn())return; await new Promise(r=>setTimeout(r,150));}
  throw Error('Timed out: '+label);
}
(async()=>{
  const storage={getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}};
  for(let i=0;i<5;i++){
    const client=createClient(config.EXPO_PUBLIC_SUPABASE_URL,config.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.signInAnonymously();
    if(error)throw Error('Guest sign-in: '+error.message);
    clients.push(client);
    const deps={'./supabase':{supabase:client,isSupabaseConfigured:true},'./online':online,'@react-native-async-storage/async-storage':storage};
    const rooms=load('rooms.js',deps);
    const {multiplayer}=load('multiplayer.js',{...deps,'./rooms':rooms});
    multiplayer.init(data.user.id,null); multiplayer.displayName='Temporary QA '+i;
    managers.push(multiplayer);
  }
  const [host,guest,outsider]=managers;
  let received=null, intent=null;
  const errors=[];
  const code=await host.createRoom({onError:m=>errors.push(m),onIntent:x=>{intent=x;return true;}},null,'DUEL');
  assert(code,'host room '+errors.join(';'));
  assert(await guest.joinRoom(code,{onError:m=>errors.push(m),onState:(state,seats)=>{received={state,seats};}}),'guest join '+errors.join(';'));
  await until(()=>host.members.length===2 && guest.members.length===2,'presence roster');
  assert.equal(guest.hostId,host.identity);
  assert.equal(guest.mode,'DUEL');
  const denied=await clients[2].rpc('open_ludo_room',{p_code:code,p_mode:'DUEL',p_create:false});
  assert(denied.error?.message.includes('full'),'third player rejected');
  const privateRows=await clients[2].from('rooms').select('id').eq('code',code);
  assert.equal(privateRows.data.length,0);
  const match=online.buildMatch(host.members,'DUEL');
  const state=engine.createGame(2,[],{players:match.players});
  host.publishState(state,match);
  await until(()=>received && host.revision>0,'database broadcast state');
  assert.equal(received.state.gameId,state.gameId);
  await guest.sendIntent({type:'roll',from:host.identity});
  await until(()=>intent,'authenticated intent broadcast');
  assert.equal(intent.from,guest.identity,'server must replace forged sender');
  // Reconnect with the same account and recover state and colour.
  guest.leave(); received=null;
  assert(await guest.joinRoom(code,{onState:(state,seats)=>{received={state,seats};},onError:m=>errors.push(m)}));
  guest.requestResync();
  await until(()=>received,'reconnect snapshot');
  assert.equal(received.seats.assignments.find(x=>x.id===guest.identity).colour,match.assignments.find(x=>x.id===guest.identity).colour);
  // A failed attempt to write public broadcasts cannot forge a private state.
  const forged=await clients[1].rpc('save_ludo_state',{p_code:code,p_state:state,p_match:match});
  assert(forged.error?.message.includes('Only the host'));
  for(const c of clients.slice(0,2)){
    const r=await c.rpc('join_ludo_queue',{p_mode:'DUEL'}); assert.ifError(r.error);
  }
  const matches=await Promise.all(clients.slice(0,2).map(c=>c.rpc('poll_ludo_queue',{p_mode:'DUEL'})));
  matches.forEach(r=>assert.ifError(r.error));
  assert.equal(matches[0].data.code,matches[1].data.code,'simultaneous polls form one room');
  assert.deepEqual(matches.map(r=>r.data.status).sort(),['forming','matched']);
  for (const mode of ['FFA','TEAM']) {
    for (const c of clients.slice(0,4)) {
      const queued=await c.rpc('join_ludo_queue',{p_mode:mode}); assert.ifError(queued.error);
    }
    const group=await Promise.all(clients.slice(0,4).map(c=>c.rpc('poll_ludo_queue',{p_mode:mode})));
    group.forEach(r=>assert.ifError(r.error));
    assert.equal(new Set(group.map(r=>r.data.code)).size,1,mode+' players share one room');
    assert.equal(group.filter(r=>r.data.status==='forming').length,1,mode+' has one host');
    const table=online.buildMatch(managers.slice(0,4).map((m,i)=>({id:m.identity,joinedAt:i})),mode);
    assert.equal(table.assignments.length,4);
    if(mode==='TEAM')assert.equal(Object.values(table.teams).filter(t=>t==='A').length,2);
  }
  console.log('LIVE PASSED: private room, two clients, presence, capacity, outsider privacy, state broadcast, authenticated intent, guest reconnect, host-only writes, simultaneous DUEL/FFA/TEAM matchmaking.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
  managers.forEach(m=>m.leave());
  for(const c of clients){
    const {error}=await c.rpc('delete_my_account');
    if(error){console.error('Temporary account cleanup failed:',error.message);process.exitCode=1;}
    await c.removeAllChannels();
  }
  console.log('Temporary guest cleanup completed.');
});
