import {CONFIG} from '../config.js';
/** Separate public-read service; no participant membership or Auth identity is created. */
export async function resultsRequest(action,payload={},token=null,signal=null){
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,15000);
  try{const r=await fetch(`${CONFIG.supabaseUrl.replace(/\/$/,'')}/functions/v1/results-api`,{method:'POST',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:CONFIG.publishableKey,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,slug:CONFIG.classroomSlug,...payload})});let data;try{data=await r.json();}catch{data={};}if(!r.ok){const e=new Error(data.error||`Results service unavailable (${r.status})`);e.status=r.status;throw e;}return data;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
/** Incremental snapshots, revision-aware resets, and fail-closed public revocation. */
export class PublicReader{
  constructor({request=resultsRequest,onData=()=>{},onClear=()=>{},onStatus=()=>{},roomId=null}={}){Object.assign(this,{request,onData,onClear,onStatus,roomId});this.rows=new Map();this.cursor='0';this.revision=null;this.generation=0;this.busy=false;this.active=false;}
  clear(message){this.rows.clear();this.cursor='0';this.revision=null;this.onClear(message);}
  async refresh(){if(this.busy)return;this.busy=true;const g=this.generation,controller=new AbortController();this.controller=controller;
    try{let after=this.cursor,working=new Map(this.rows),revision=this.revision,metadata=null,people=[],more=true,pages=0;
      while(more){if(++pages>400)throw new Error('Snapshot page limit reached');const result=await this.request('public-snapshot',{room_id:this.roomId,after,limit:500,publication_revision:revision?.publication??null,data_revision:revision?.data??null},null,controller.signal);if(g!==this.generation)return;
        if(!result.room){this.clear('No session is currently published.');this.onStatus('Public overview is off');return;}
        const next={publication:result.publication_revision,data:result.room.data_revision||0,room:result.room.id};
        if(!revision||next.publication!==revision.publication||next.data!==revision.data||next.room!==revision.room){working.clear();after='0';this.onClear('Loading the published session…');if(!result.restarted&&result.request_after!=='0'&&result.cursor!=='0'&&this.cursor!=='0'){revision=next;continue;}}
        revision=next;metadata=result.room;people=result.participants||people;
        for(const r of result.trials||[])working.set(`${r.participant_id}:${r.id}`,r);
        const cursor=String(result.cursor??after);more=!!result.has_more;if(more&&cursor===after)throw new Error('Snapshot cursor did not advance');after=cursor;
      }
      if(g!==this.generation)return;this.rows=working;this.cursor=after;this.revision=revision;this.onData([...working.values()],people,metadata);this.onStatus('Published results · read only');
    }catch(e){if(g===this.generation){this.clear('Public results temporarily unavailable.');this.onStatus(e.name==='AbortError'?'Results request interrupted':e.message);}}
    finally{if(g===this.generation){this.busy=false;this.controller=null;}}
  }
  start(){this.active=true;this.tick();}
  async tick(){if(!this.active)return;await this.refresh();if(this.active)this.timer=setTimeout(()=>this.tick(),10000);}
  stop(){this.active=false;clearTimeout(this.timer);this.generation++;this.controller?.abort();this.busy=false;}
}
