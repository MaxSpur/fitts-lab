/** Public read-only snapshots + owner-authorized publication. Existing classroom-api is untouched. */
const MAX_BODY=4096,ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const uuid=v=>{if(typeof v!=='string'||!ID.test(v))throw new ApiError(400,'Invalid ID');return v;};
function cursor(v){const s=String(v??'0');if(!/^\d{1,18}$/.test(s))throw new ApiError(400,'Invalid cursor');return s;}
async function body(request){if(Number(request.headers.get('content-length'))>MAX_BODY)throw new ApiError(413,'Request too large');const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'JSON body required');let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new ApiError(413,'Request too large');}chunks.push(value);}const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'Invalid JSON');}}
export async function handle(request,env,fetcher=fetch){
  const origin=request.headers.get('origin'),origins=(env.origins||'').split(',').map(x=>x.trim()).filter(Boolean);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(origin&&origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!env.url||!env.key||!origins.length)return respond({error:'Results service is not configured'},503);
  if(origin&&!origins.includes(origin))return respond({error:'Origin is not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond({error:'Use POST'},405);
  if(!request.headers.get('content-type')?.includes('application/json'))return respond({error:'Use application/json'},415);
  const serverHeaders={apikey:env.key,'Content-Type':'application/json',...(env.key.startsWith('eyJ')?{Authorization:'Bearer '+env.key}:{})};
  async function rest(path,method='GET',data){const r=await fetcher(env.url+'/rest/v1/'+path,{method,headers:serverHeaders,...(data===undefined?{}:{body:JSON.stringify(data)})});if(!r.ok){let error={};try{error=await r.json();}catch{}if(error.message==='Publication changed')throw new ApiError(409,'Publication changed in another view. Refresh and retry.');throw new ApiError(r.status===403?403:503,'Results operation unavailable');}return r.json();}
  async function snapshot(b,limit){return rest('rpc/read_fitts_public_snapshot','POST',{p_slug:b.slug,p_room:b.room_id==null?null:uuid(b.room_id),p_after:cursor(b.after),p_limit:limit,p_publication:b.publication_revision==null?null:cursor(b.publication_revision),p_revision:b.data_revision==null?null:revision(b.data_revision)});}
  function revision(v){if(!Number.isInteger(v)||v<0||v>2147483647)throw new ApiError(400,'Invalid revision');return v;}
  try{const b=await body(request);if(!b||typeof b!=='object'||typeof b.slug!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(b.slug))throw new ApiError(400,'Invalid classroom slug');
    if(b.action==='published-room'){const s=await snapshot(b,0);return respond({room:s.room,publication_revision:s.publication_revision});}
    if(b.action==='public-snapshot'){const limit=b.limit??500;if(!Number.isInteger(limit)||limit<1||limit>500)throw new ApiError(400,'Invalid page size');return respond(await snapshot(b,limit));}
    if(b.action!=='publish')throw new ApiError(400,'Unknown results action');
    const token=request.headers.get('authorization');if(!token?.startsWith('Bearer '))throw new ApiError(401,'Instructor sign-in required');
    const auth=await fetcher(env.url+'/auth/v1/user',{headers:{apikey:env.key,Authorization:token}});if(!auth.ok)throw new ApiError(401,'Invalid instructor session');const owner=uuid((await auth.json()).id);
    if(!(await rest(`instructors?user_id=eq.${owner}&select=user_id&limit=1`)).length)throw new ApiError(403,'Instructor access required');
    // Recheck allowlist, room ownership and publication revision inside the SQL transaction.
    await rest('rpc/publish_fitts_results','POST',{p_owner:owner,p_slug:b.slug,p_room:b.room_id==null?null:uuid(b.room_id),p_expected:b.expected_publication_revision==null?null:cursor(b.expected_publication_revision)});
    const s=await snapshot({slug:b.slug},0);return respond({room:s.room,publication_revision:s.publication_revision});
  }catch(e){return respond({error:e instanceof ApiError?e.message:'Results operation failed'},e instanceof ApiError?e.status:500);}
}
