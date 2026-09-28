import {uuid,choice,integer,shortText,validateTrial} from '../../../shared/validate.js';
const MAX_BODY=150000;
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function readBody(request){
  if(Number(request.headers.get('content-length'))>MAX_BODY)throw new HttpError(413,'Request is too large.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Expected a JSON body.');let size=0;const chunks=[];
  while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new HttpError(413,'Request is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON.');}
}
async function sha256(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function participantToken(t){if(typeof t!=='string'||!/^[a-f0-9]{64}$/.test(t))throw new HttpError(401,'Invalid participant credential.');return t;}
function slug(s){if(typeof s!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(s))throw new HttpError(400,'Invalid classroom name.');return s;}
function publicRoom(r){if(!r)return null;return{id:r.id,title:r.title,slug:r.slug,phase:r.phase,status:r.status,created_at:r.created_at,expires_at:r.expires_at};}
/** Native fetch only: no SDK package install is needed for this Edge Function. */
export async function handle(request,env,fetcher=fetch){
  const origin=request.headers.get('origin'),allowed=(env.origins||'').split(',').map(s=>s.trim()).filter(Boolean);
  const cors={'Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Cache-Control':'no-store'};
  if(origin&&allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
  if(!env.url||!env.key||!allowed.length)return respond({error:'Backend environment is not configured.'},503);
  if(origin&&!allowed.includes(origin))return respond({error:'Origin is not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return respond({error:'Use POST.'},405);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return respond({error:'Use application/json.'},415);
  const serverHeaders={apikey:env.key,'Content-Type':'application/json',...(env.key.startsWith('eyJ')?{Authorization:`Bearer ${env.key}`}:{})};
  async function rest(path,method='GET',body){
    const res=await fetcher(`${env.url}/rest/v1/${path}`,{method,headers:{...serverHeaders,Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    let json;try{json=await res.json();}catch{json=[];}
    if(!res.ok){const message=json.message||'Database request failed.';
      const status=/rate exceeded/i.test(message)?429:/closed|ended/i.test(message)?410:/capacity/i.test(message)?409:/credential|access required/i.test(message)?403:res.status>=500?503:400;
      // Return known operational errors; keep SQL internals and server credentials out of responses.
      throw new HttpError(status,/rate exceeded|closed|ended|capacity|credentials|access required|name is in use/i.test(message)?message:'Database operation failed. Check the deployment and server logs.');}
    return json;
  }
  async function instructor(){
    const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))throw new HttpError(401,'Instructor sign-in is required.');
    const response=await fetcher(`${env.url}/auth/v1/user`,{headers:{apikey:env.key,Authorization:authorization}});
    if(!response.ok)throw new HttpError(401,'Instructor session expired or is invalid.');const user=await response.json();
    uuid(user.id,'user ID');const whitelist=await rest(`instructors?user_id=eq.${user.id}&select=user_id&limit=1`);
    if(!whitelist.length)throw new HttpError(403,'This account is not in the instructor allowlist.');return user.id;
  }
  async function owned(roomId,owner){uuid(roomId,'room ID');const rs=await rest(`rooms?id=eq.${roomId}&owner_id=eq.${owner}&select=*&limit=1`);if(!rs.length)throw new HttpError(404,'Session not found.');return rs[0];}
  try{
    const b=await readBody(request);if(!b||typeof b!=='object')throw new HttpError(400,'Invalid request.');
    if(b.action==='status'){
      const name=slug(b.slug),filter=b.room_id?`id=eq.${uuid(b.room_id)}&`:`status=eq.open&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&`;
      const rs=await rest(`rooms?slug=eq.${name}&${filter}order=created_at.desc&limit=1&select=id,title,slug,phase,status,created_at,expires_at`);return respond({room:publicRoom(rs[0])});
    }
    if(b.action==='join'){
      const result=await rest('rpc/join_fitts_room','POST',{p_room:uuid(b.room_id),p_client:uuid(b.client_key),p_hash:await sha256(participantToken(b.token)),p_device:choice(b.device,['mouse','trackpad','pen','other','unspecified'],'device')});
      return respond({participant:result});
    }
    if(b.action==='ingest'){
      if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>24)throw new HttpError(400,'Send 1–24 observations per batch.');
      const rows=b.rows.map(r=>validateTrial(r,40));const result=await rest('rpc/ingest_fitts_batch','POST',{p_participant:uuid(b.participant_id),p_hash:await sha256(participantToken(b.token)),p_rows:rows});return respond(result);
    }
    const owner=await instructor();
    if(b.action==='list'){const name=slug(b.slug);const rooms=await rest(`rooms?owner_id=eq.${owner}&slug=eq.${name}&order=created_at.desc&limit=50`);return respond({rooms});}
    if(b.action==='create'){
      const room=await rest('rpc/create_fitts_room','POST',{p_owner:owner,p_slug:slug(b.slug),p_title:shortText(b.title,100,'session title'),p_capacity:integer(b.capacity,1,400,'capacity')});return respond({room});
    }
    const r=await owned(b.room_id,owner);
    if(b.action==='snapshot'){
      const after=String(b.after??'0');if(!/^\d{1,18}$/.test(after))throw new HttpError(400,'Invalid snapshot cursor.');const limit=integer(b.limit??500,1,500,'page size');
      const participants=await rest(`participants?room_id=eq.${r.id}&select=id,label,device,created_at&limit=400`);
      const ts=await rest(`trials?room_id=eq.${r.id}&sequence=gt.${after}&order=sequence.asc&limit=${limit}&select=sequence,data`);
      return respond({room:r,participants,trials:ts.map(t=>({...t.data,seq:String(t.sequence)})),cursor:ts.length?String(ts.at(-1).sequence):after,has_more:ts.length===limit});
    }
    if(b.action==='phase'){const phase=choice(b.phase,['horizontal','circles','interfaces','results'],'phase');const rs=await rest(`rooms?id=eq.${r.id}&owner_id=eq.${owner}`,'PATCH',{phase});return respond({room:rs[0]});}
    if(b.action==='close'){const rs=await rest(`rooms?id=eq.${r.id}&owner_id=eq.${owner}`,'PATCH',{status:'closed',accept_until:new Date(Math.min(Date.parse(r.expires_at),Date.now()+600000)).toISOString()});return respond({room:rs[0]});}
    if(b.action==='delete'){await rest(`rooms?id=eq.${r.id}&owner_id=eq.${owner}`,'DELETE');return respond({deleted:true});}
    throw new HttpError(400,'Unknown action.');
  }catch(e){return respond({error:e instanceof HttpError?e.message:(e.message||'Invalid request.')},e instanceof HttpError?e.status:400);}
}
