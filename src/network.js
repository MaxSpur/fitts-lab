import {CONFIG} from '../config.js';
import {saved,save,put,all,removeMany} from './storage.js';
import {downsample} from './math.js';
export const configured=()=>!!(CONFIG.supabaseUrl&&CONFIG.publishableKey);
export class ApiError extends Error{constructor(message,status=0){super(message);this.status=status;}}
export async function requestJSON(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(url,{...options,signal:controller.signal});let body;try{body=await response.json();}catch{body={};}
    if(!response.ok)throw new ApiError(body.error||body.msg||body.message||`Request failed (${response.status}).`,response.status);
    return body;
  }catch(e){if(e.name==='AbortError')throw new ApiError('Request timed out. Measurements are still saved locally.');throw e;}finally{clearTimeout(timer);}
}
export function api(action,payload={},token){
  if(!configured())throw new ApiError('The backend has not been configured. Standalone and local rehearsal still work.');
  return requestJSON(`${CONFIG.supabaseUrl.replace(/\/$/,'')}/functions/v1/${CONFIG.apiFunction}`,{method:'POST',
    headers:{'Content-Type':'application/json',apikey:CONFIG.publishableKey,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload})});
}
export const channel=()=>typeof BroadcastChannel!=='undefined'?new BroadcastChannel('fitts-lab-rehearsal-v1'):null;
export const localRoom=()=>saved('local-room',null);
export function createLocalRoom(title='Local rehearsal'){
  const room={id:crypto.randomUUID(),title,slug:'local',phase:'horizontal',status:'open',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),accept_until:new Date(Date.now()+86400000).toISOString(),source:'local'};save('local-room',room);save('local-room:'+room.id,room);return room;
}
export function updateLocalRoom(patch){const room={...localRoom(),...patch};if(patch.status==='closed')room.accept_until=new Date(Math.min(Date.parse(room.expires_at),Date.now()+600000)).toISOString();save('local-room',room);save('local-room:'+room.id,room);const c=channel();c?.postMessage({type:'room',room_id:room.id,room});c?.close();return room;}
export async function localSnapshot(roomId){const a=await all('localClass');return{participants:a.filter(r=>r.kind==='participant'&&r.room_id===roomId).map(r=>r.data),trials:a.filter(r=>r.kind==='trial'&&r.room_id===roomId).map(r=>r.data)};}
export function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function joinRoom(room,device,source='remote'){
  let c=saved('membership:'+room.id,null);
  if(!c){c={room_id:room.id,client_key:crypto.randomUUID(),token:randomToken(),source};save('membership:'+room.id,c);}
  let p;
  if(source==='local'){
    p={id:c.client_key,label:'P-'+c.client_key.slice(0,6).toUpperCase(),device};
    await put('localClass',{id:'participant:'+room.id+':'+p.id,room_id:room.id,kind:'participant',data:p});
    const b=channel();b?.postMessage({type:'participant',room_id:room.id,participant:p});b?.close();
  }else p=(await api('join',{room_id:room.id,client_key:c.client_key,token:c.token,device})).participant;
  c={...c,participant_id:p.id,participant_label:p.label};save('membership:'+room.id,c);save('active-membership',{credential:c,room});return c;
}
/** Persistent, idempotent outbox. Only measurements recorded AFTER joining are queued. */
export class Outbox {
  constructor(onStatus=()=>{}){this.onStatus=onStatus;this.busy=false;this.wait=0;this.failures=0;this.blocked=new Set();this.bc=channel();this.timer=setInterval(()=>this.flush().catch(e=>{if(!this.storageErrorReported){this.storageErrorReported=true;this.onStatus({pending:0,message:'Browser storage is unavailable: '+e.message,blocked:true});}}),CONFIG.uploadIntervalMs);window.addEventListener('online',()=>{this.wait=0;this.flush();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.wait=0;this.flush();}});}
  async enqueue(trial,credential){await put('outbox',{id:trial.id,trial,credential});this.status();if(!this.kickTimer)this.kickTimer=setTimeout(()=>{this.kickTimer=null;this.flush();},350);}
  async status(message){const rows=await all('outbox');this.onStatus({pending:rows.length,message,blocked:this.blocked.size>0});}
  async flush(){
    if(this.busy||Date.now()<this.wait||!navigator.onLine)return;this.busy=true;let activeCredential=null;
    try{
      const queued=(await all('outbox')).filter(r=>!this.blocked.has(r.credential.room_id));
      if(!queued.length){await this.status();return;}
      const credential=queued[0].credential,batch=queued.filter(r=>r.credential.room_id===credential.room_id&&r.credential.participant_id===credential.participant_id).slice(0,CONFIG.batchSize);
      activeCredential=credential;
      const rows=batch.map(r=>({...r.trial,path:downsample(r.trial.path||[],40)}));
      let accepted;
      if(credential.source==='local'){
        const r=saved('local-room:'+credential.room_id,null)||localRoom();if(!r||r.id!==credential.room_id||r.status==='deleted'||Date.parse(r.accept_until)<=Date.now()||Date.parse(r.expires_at)<=Date.now())throw new ApiError('Local classroom upload window has ended.',410);
        for(const row of rows)await put('localClass',{id:'trial:'+credential.room_id+':'+row.id,kind:'trial',room_id:credential.room_id,data:row});
        this.bc?.postMessage({type:'trials',room_id:credential.room_id,rows});accepted=rows.map(r=>r.id);
      }else{
        const result=await api('ingest',{participant_id:credential.participant_id,token:credential.token,rows});accepted=result.accepted||[];
      }
      await removeMany('outbox',accepted);this.failures=0;this.wait=Date.now()+300;await this.status();
    }catch(e){this.failures++;this.wait=Date.now()+Math.min(30000,1000*2**this.failures)+Math.random()*500;
      if([400,401,403,409,410,413].includes(e.status)){if(activeCredential)this.blocked.add(activeCredential.room_id);}
      await this.status(e.message);
    }finally{this.busy=false;}
  }
  retry(){this.blocked.clear();this.wait=0;this.flush();}
}
/** Instructor Auth REST client. Tokens live in sessionStorage, never in exports. */
export class InstructorAuth {
  constructor(){try{this.session=JSON.parse(sessionStorage.getItem('fitts-instructor')||'null');}catch{this.session=null;}this.refreshing=null;}
  store(s){this.session=s?{...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)}:null;if(s)sessionStorage.setItem('fitts-instructor',JSON.stringify(this.session));else sessionStorage.removeItem('fitts-instructor');}
  async login(email,password){const s=await requestJSON(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});this.store(s);return s;}
  async access(){if(!this.session)throw new ApiError('Sign in to open your classroom.',401);if(this.session.expires_at>Date.now()/1000+90)return this.session.access_token;
    if(!this.refreshing)this.refreshing=requestJSON(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:this.session.refresh_token})}).then(s=>{this.store(s);return s.access_token;}).catch(e=>{if([400,401,403].includes(e.status))this.store(null);throw e;}).finally(()=>this.refreshing=null);
    return this.refreshing;
  }
  async call(action,payload={}){return api(action,payload,await this.access());}
  async logout(){const s=this.session;this.store(null);if(s)try{await requestJSON(`${CONFIG.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:CONFIG.publishableKey,Authorization:`Bearer ${s.access_token}`}});}catch{/* Local credentials are already removed. */}}
}
/** Small subscriber for the documented Supabase Realtime protocol v1.
 * No public channel, no client broadcast, no student sockets. Polling is authoritative recovery.
 */
export class RoomStream {
  constructor(auth,roomId,onEvent,onState){this.auth=auth;this.roomId=roomId;this.onEvent=onEvent;this.onState=onState;this.ref=0;this.retry=0;this.closed=false;this.connect();}
  send(event,payload={},topic=this.topic){if(this.ws?.readyState!==WebSocket.OPEN)return;const ref=String(++this.ref);this.ws.send(JSON.stringify({topic,event,payload,ref,join_ref:topic===this.topic?this.joinRef:null}));return ref;}
  async connect(){
    if(this.closed||this.connecting)return;this.connecting=true;this.onState('Connecting live stream…');
    try{
      const token=await this.auth.access();if(this.closed)return;
      this.topic=`realtime:classroom:${this.roomId}`;this.ws=new WebSocket(`${CONFIG.supabaseUrl.replace(/^http/,'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(CONFIG.publishableKey)}&vsn=1.0.0`);
      this.ws.onopen=()=>{this.joinRef=String(this.ref+1);this.send('phx_join',{config:{private:true,broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[]},access_token:token});this.joinTimer=setTimeout(()=>this.ws?.close(),12000);};
      this.ws.onmessage=e=>{
        let m;try{m=JSON.parse(e.data);}catch{return;}
        if(m.event==='phx_reply'&&m.ref===this.joinRef){clearTimeout(this.joinTimer);if(m.payload?.status!=='ok'){this.onState('Live stream unavailable · reconciling by polling');this.ws.close();return;}this.retry=0;this.onState('Stream connected');this.onEvent('connected',{});this.startHeartbeat();}
        if(m.topic==='phoenix'&&m.event==='phx_reply')this.awaitingHeartbeat=false;
        if(m.event==='broadcast')this.onEvent(m.payload.event,m.payload.payload);
        if(['phx_error','phx_close'].includes(m.event))this.ws.close();
      };
      this.ws.onerror=()=>this.onState('Connection interrupted · polling continues');
      this.ws.onclose=()=>{clearInterval(this.heartbeat);clearTimeout(this.joinTimer);if(!this.closed){this.onState('Reconnecting · polling continues');this.schedule();}};
    }catch{if(!this.closed){this.onState('Live stream unavailable · polling continues');this.schedule();}}finally{this.connecting=false;}
  }
  startHeartbeat(){clearInterval(this.heartbeat);this.awaitingHeartbeat=false;this.heartbeat=setInterval(async()=>{
    if(this.awaitingHeartbeat){this.ws?.close();return;}
    this.awaitingHeartbeat=true;this.send('heartbeat',{},'phoenix');
    try{this.send('access_token',{access_token:await this.auth.access()});}catch{this.ws?.close();}
  },20000);}
  schedule(){clearTimeout(this.reconnect);this.reconnect=setTimeout(()=>this.connect(),Math.min(30000,1000*2**this.retry++)+Math.random()*500);}
  reconnectNow(){if(this.closed)return;if(this.ws?.readyState===WebSocket.OPEN)return;clearTimeout(this.reconnect);if(this.ws?.readyState===WebSocket.CONNECTING)return;this.connect();}
  close(){this.closed=true;clearTimeout(this.reconnect);clearTimeout(this.joinTimer);clearInterval(this.heartbeat);this.ws?.close();}
}
