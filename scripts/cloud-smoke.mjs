/** Explicit hosted smoke test. Creates/deletes only a uniquely named test room.
 * Run after configuring config.js and .env.smoke; never commit credentials.
 * This test does not exercise WebSocket delivery or browser-specific CORS handling.
 */
import assert from 'node:assert/strict';
import {CONFIG} from '../config.js';
import {TrialEngine} from '../src/engine.js';
import {protocol} from '../src/protocol.js';
import {randomBytes} from 'node:crypto';
const {FITTS_EMAIL:email,FITTS_PASSWORD:password,FITTS_ORIGIN:origin}=process.env;
if(!CONFIG.supabaseUrl||!CONFIG.publishableKey||!email||!password){console.error('Configure config.js, then set FITTS_EMAIL and FITTS_PASSWORD in an ignored .env.smoke file. Run: node --env-file=.env.smoke scripts/cloud-smoke.mjs');process.exit(1);}
const base=CONFIG.supabaseUrl.replace(/\/$/,''),headers={apikey:CONFIG.publishableKey,'Content-Type':'application/json',...(origin?{Origin:origin}:{})};
async function request(url,body,authorization){const res=await fetch(url,{method:'POST',headers:{...headers,...(authorization?{Authorization:`Bearer ${authorization}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});let data;try{data=await res.json();}catch{data={};}return{status:res.status,data,headers:res.headers};}
let access,room;
const call=(action,payload={},teacher=false)=>request(`${base}/functions/v1/${CONFIG.apiFunction}`,{action,...payload},teacher?access:undefined);
function ok(res){assert.equal(res.status,200,JSON.stringify(res.data));return res.data;}
try{
 access=ok(await request(`${base}/auth/v1/token?grant_type=password`,{email,password})).access_token;assert.ok(access);
 const slug='smoke-'+crypto.randomUUID().slice(0,8);
 room=ok(await call('create',{slug,title:'AUTOMATED SMOKE TEST — safe to delete',capacity:2},true)).room;assert.ok(room?.id);
 console.log('Created isolated smoke-test room:',room.id);
 const status=await call('status',{slug});assert.equal(ok(status).room.id,room.id);if(origin)assert.equal(status.headers.get('access-control-allow-origin'),origin);
 const token=randomBytes(32).toString('hex'),client_key=crypto.randomUUID();
 const payload={room_id:room.id,client_key,token,device:'mouse'};
 const participant=ok(await call('join',payload)).participant;
 assert.equal(ok(await call('join',payload)).participant.id,participant.id,'Joining must be idempotent.');
 let trial;const plan={...protocol('horizontal','smoke')[0],count:1};
 const engine=new TrialEngine(plan,{participantId:participant.id,participantLabel:participant.label,roomId:room.id,device:'mouse'},{record:r=>trial=r});
 engine.activate();engine.click(engine.home,1000);engine.click(engine.target,1400);assert.ok(trial);
 const ingest={participant_id:participant.id,token,rows:[trial]};
 assert.equal(ok(await call('ingest',ingest)).inserted,1);
 assert.equal(ok(await call('ingest',ingest)).inserted,0,'Retried observations must not be duplicated.');
 const snapshot=ok(await call('snapshot',{room_id:room.id,after:'0',limit:500},true));
 assert.equal(snapshot.trials.length,1);assert.equal(snapshot.trials[0].id,trial.id);assert.equal(snapshot.participants.length,1);
 assert.equal((await call('snapshot',{room_id:room.id})).status,401);
 assert.equal((await call('ingest',{...ingest,token:randomBytes(32).toString('hex')})).status,403);
 const direct=await fetch(`${base}/rest/v1/trials?select=trial_id&limit=1`,{headers:{apikey:CONFIG.publishableKey},signal:AbortSignal.timeout(20000)});
 if(direct.ok)assert.deepEqual(await direct.json(),[],'Anonymous direct access returned data.');else assert.ok([401,403].includes(direct.status));
 ok(await call('close',{room_id:room.id},true));
 assert.equal((await call('join',{...payload,client_key:crypto.randomUUID(),token:randomBytes(32).toString('hex')})).status,410);
 console.log('PASS: login/allowlist, ownership path, discovery, idempotent join/ingest, snapshot, wrong-credential rejection, anonymous-read restriction, and closed-room admission.');
 console.log('Still check real-browser persistence, CORS, private Realtime, network interruption, Safari, and classroom capacity manually.');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
finally{
 if(room&&access){try{const d=await call('delete',{room_id:room.id},true);if(d.status!==200)throw new Error(JSON.stringify(d.data));console.log('Deleted test room.');}catch(e){console.error('Cleanup failed. Delete this smoke-test room in the dashboard:',room.id,e.message);process.exitCode=1;}}
 if(access)try{await fetch(`${base}/auth/v1/logout`,{method:'POST',headers:{apikey:CONFIG.publishableKey,Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(10000)});}catch{}
}
