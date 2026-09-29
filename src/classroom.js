import {Dashboard} from './dashboard.js';
import {resultsRequest} from './overview-client.js';
import {sessionState,sessionLabel} from './session.js';
import {CONFIG} from '../config.js';
import {$,text,toast,common,download,csv,copy} from './ui.js';
import {firstAttempts} from './math.js';
import {simulationRows} from './simulation.js';
import {configured,InstructorAuth,RoomStream,localRoom,createLocalRoom,updateLocalRoom,localSnapshot,channel} from './network.js';
import {all,removeMany,saved,save} from './storage.js';
import {VERSION} from './protocol.js';
common();
const auth=new InstructorAuth(),dashboard=new Dashboard($('#dashboard'));
let source=null,room=null,records=new Map(),participants=new Map(),lastReceived=null,stream=null,poll=null,demoTimer=null,cursor='0',syncing=false;
let connectionRun=0,renderTimer=null,frozen=false,lastSync=null,syncError='',streamState='Connecting…',publication=null,publishing=false,publicationAvailable=false;
const bc=channel();
function id(r){return `${r.participant_id}:${r.id}`;}
function reset(next){connectionRun++;stream?.close();stream=null;clearInterval(poll);clearInterval(demoTimer);clearTimeout(renderTimer);renderTimer=null;cursor='0';source=next;records=new Map();participants=new Map();room=null;lastReceived=null;frozen=false;syncing=false;lastSync=null;syncError='';streamState='Connecting…';dashboard.clear('Waiting for measurements.');
  $('#sync-now').hidden=next!=='remote';$('#session-controls').hidden=!['local','remote'].includes(next);$('#publication-controls').hidden=next!=='remote';text('#session-state','');text('#freeze','Freeze view');text('#attempt-count','0');text('#participant-count','0');text('#error-count','—');text('#last-update','');$('#source-banner').classList.toggle('simulation',next==='simulation');
}
function receive(newRows){let added=0;for(const r of newRows){if(!r||!r.id||!r.participant_id||!Number.isFinite(r.acquisition_ms)||records.has(id(r)))continue;records.set(id(r),r);added++;if(!participants.has(r.participant_id))participants.set(r.participant_id,{id:r.participant_id,label:r.participant_label||'Participant',device:r.device});}
  if(added){lastReceived=Date.now();schedule();}}
function receivePerson(p){const prior=participants.get(p.id);participants.set(p.id,{...prior,...p});if(!prior||prior.label!==p.label)schedule();}
function schedule(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;if(frozen){text('#freeze','Resume display (collecting)');dashboard.setSnapshot([...records.values()],[...participants.values()],room,{source});return;}
  const rows=[...records.values()],first=firstAttempts(rows,{perturbation:'all'});text('#participant-count',participants.size);text('#attempt-count',rows.length.toLocaleString());text('#error-count',first.length?`${(100*first.filter(r=>!r.hit).length/first.length).toFixed(1)}%`:'—');text('#last-update',lastReceived?'Last received '+new Date(lastReceived).toLocaleTimeString():'Nothing received yet');dashboard.setSnapshot(rows,[...participants.values()],room,{source});
},300);}
function labelSource(){text('#source-label',source==='simulation'?'Simulation':source==='local'?'Local rehearsal':source==='import'?'Imported session':'Classroom session');text('#source-detail',source==='simulation'?'Synthetic preview data.':source==='local'?'This browser profile only.':source==='import'?'Disconnected snapshot.':'Measurements saved in the selected session.');text('#room-title',room?.title||'');}
function acceptRoom(next){if(!next||room&&next.id===room.id&&(next.data_revision||0)<(room.data_revision||0))return;
  if(room&&next.id===room.id&&(next.data_revision||0)!==(room.data_revision||0)){records.clear();cursor='0';lastReceived=null;frozen=false;dashboard.clear('Measurements changed; reloading.');text('#freeze','Freeze view');}
  room=next;setupRoomControls();schedule();}
function setupRoomControls(){const state=sessionState(room);text('#session-state',`${state.label} · ${state.detail}`);if(room){const o=[...$('#room-list').options].find(o=>o.value===room.id);if(o){o.textContent=sessionLabel(room);o.dataset.room=JSON.stringify(room);}}
  text('#room-title',room?.title||'');const link=new URL('./',location.href);if(source==='local')link.searchParams.set('local','1');$('#participant-address').href=link.href;$('#participant-address').textContent=link.href;
  $('#end-room').disabled=!state.open;$('#delete-room').disabled=!room;$('#reset-data').disabled=!room;$('#room-list').closest('div').hidden=source==='local';$('#capacity').closest('label').hidden=source==='local';paintPublication();}
function paintPublication(){const active=!!(room&&publication?.room?.id===room.id);text('#publish-results',active?'Unpublish overview':'Publish this session');$('#publish-results').disabled=publishing||!room||source!=='remote'||!publicationAvailable;text('#publication-status',publication===null?'Overview service not checked.':publication.room?`Published: ${publication.room.title}`:'Public overview is off.');}
async function checkPublication(){const run=connectionRun;try{const value=await resultsRequest('published-room');if(run===connectionRun){publication=value;publicationAvailable=true;paintPublication();}}catch{if(run===connectionRun){publicationAvailable=false;text('#publication-status','Public overview needs the results-api deployment. See the analysis setup guide.');$('#publish-results').disabled=true;}}}
$('#publish-results').onclick=async()=>{if(!room||source!=='remote'||publishing)return;const active=publication?.room?.id===room.id,roomId=room.id,run=connectionRun;
  if(!active&&!confirm('Publish this session’s measurements and trajectories for anyone to view? This replaces the currently published overview. Joining and collection are unchanged.'))return;
  publishing=true;paintPublication();try{const result=await resultsRequest('publish',{room_id:active?null:roomId,expected_publication_revision:publication?.publication_revision??null},await auth.access());if(run===connectionRun){publication=result;paintPublication();toast(active?'Public overview disabled.':'Public overview published.');}}catch(e){toast(e.message,true);await checkPublication();}finally{publishing=false;paintPublication();}};
function showConnection(){
  if(source!=='remote')return;
  const checked=lastSync?' · checked '+new Date(lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  text('#connection-state',syncError?'Sync delayed · '+syncError+' · retrying':streamState+checked);
}
$('#sync-now').onclick=async()=>{text('#sync-now','Checking…');try{await syncRemote();}finally{text('#sync-now','Sync now');}};
window.addEventListener('online',()=>{syncRemote();stream?.reconnectNow();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncRemote();stream?.reconnectNow();}});
async function syncRemote(){
  if(syncing||!room||source!=='remote')return;syncing=true;const roomId=room.id,run=connectionRun;
  try{let more=true,pages=0;while(more&&pages++<100){const result=await auth.call('snapshot',{room_id:roomId,after:cursor,limit:500});if(run!==connectionRun||room?.id!==roomId||source!=='remote')return;
      if(result.room&&(result.room.data_revision||0)<(room.data_revision||0)){more=true;continue;}
      if(result.room&&(result.room.data_revision||0)!==(room.data_revision||0)){acceptRoom(result.room);more=true;continue;}
      for(const p of result.participants||[])receivePerson(p);receive(result.trials||[],cursor!=='0');cursor=result.cursor||cursor;more=!!result.has_more;if(result.room){room=result.room;setupRoomControls();}}
    lastSync=Date.now();syncError='';showConnection();
  }catch(e){if(run===connectionRun){syncError=e.message;showConnection();}}finally{if(run===connectionRun)syncing=false;}
}
async function attachRemote(next){
  reset('remote');const run=connectionRun;room=next;$('#room-list').value=room.id;labelSource();setupRoomControls();save('selected-room',room.id);checkPublication();
  stream=new RoomStream(auth,room.id,(event,payload)=>{if(run!==connectionRun)return;if(event==='trials'){receive(payload.rows||[]);}else if(event==='participant')receivePerson(payload);else if(event==='room'){acceptRoom({...room,...payload});syncRemote();}else if(event==='connected')syncRemote();},s=>{if(run!==connectionRun)return;streamState=s;showConnection();});
  await syncRemote();if(run!==connectionRun)return;poll=setInterval(syncRemote,CONFIG.instructorPollMs);schedule();
}
async function loadCloud(preferredId=saved('selected-room',null)){
  const run=connectionRun,result=await auth.call('list',{slug:CONFIG.classroomSlug});if(run!==connectionRun)return;$('#logout').hidden=false;$('#room-list').innerHTML='<option value="">Choose a session</option>';
  for(const r of result.rooms){const o=document.createElement('option');o.value=r.id;o.textContent=sessionLabel(r);o.dataset.room=JSON.stringify(r);$('#room-list').append(o);}
  const preferred=result.rooms.find(r=>r.id===preferredId)||result.rooms[0];
  if(preferred){$('#room-list').value=preferred.id;await attachRemote(preferred);}else{reset('remote');labelSource();setupRoomControls();$('#session-controls').open=true;text('#connection-state','Signed in · open a session');}
}
$('#local-mode').onclick=async()=>{
  reset('local');const run=connectionRun;room=localRoom();if(!room||room.status==='deleted')room=createLocalRoom();labelSource();setupRoomControls();$('#session-controls').open=true;text('#connection-state','Local · this browser only');
  async function syncLocal(){if(run!==connectionRun)return;acceptRoom(localRoom());const snap=await localSnapshot(room.id);if(run!==connectionRun)return;for(const p of snap.participants)receivePerson(p);receive(snap.trials,false);}
  await syncLocal();if(run!==connectionRun)return;poll=setInterval(syncLocal,1500);schedule();
};
if(bc)bc.onmessage=e=>{const m=e.data;if(source!=='local'||m.room_id!==room?.id)return;if(m.type==='trials')receive(m.rows);if(m.type==='participant')receivePerson(m.participant);if(m.type==='room')acceptRoom(m.room);};
$('#simulate-mode').onclick=()=>{
  reset('simulation');labelSource();text('#connection-state','Preview · synthetic data only');const pool=simulationRows();receive(pool.splice(0,720),false);
  demoTimer=setInterval(()=>{if(!pool.length){clearInterval(demoTimer);text('#connection-state','Simulation complete');return;}receive(pool.splice(0,8));},220);schedule();
};
$('#cloud-mode').onclick=async()=>{
  if(!configured()){text('#auth-help','Set supabaseUrl and publishableKey in config.js, then follow docs/DEPLOYMENT.md. Local rehearsal and simulated preview work now.');$('#login-form').hidden=true;$('#auth-dialog').showModal();return;}
  if(auth.session){try{await loadCloud();return;}catch(e){toast(e.message,true);}}
  $('#login-form').hidden=false;$('#auth-dialog').showModal();
};
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#login-button').disabled=true;try{await auth.login($('#email').value,$('#password').value);$('#password').value='';await loadCloud();$('#auth-dialog').close();}catch(e){toast(e.message,true);}finally{$('#login-button').disabled=false;}};
$('#logout').onclick=async()=>{stream?.close();clearInterval(poll);await auth.logout();$('#logout').hidden=true;reset(null);labelSource();text('#source-label','Signed out.');text('#source-detail','Local copies remain in this page only until it is closed.');text('#connection-state','Signed out');};
$('#create-room').onclick=async()=>{
  if(sessionState(room).open&&!confirm('Open a new session? The current session stops admitting students; its saved data is retained.'))return;
  try{if(source==='local'){updateLocalRoom({status:'closed'});createLocalRoom($('#new-title').value);await $('#local-mode').onclick();}else{const result=await auth.call('create',{slug:CONFIG.classroomSlug,title:$('#new-title').value,capacity:Number($('#capacity').value)});await loadCloud(result.room.id);}}catch(e){toast(e.message,true);}
};
$('#end-room').onclick=async()=>{if(!room||!confirm('End this session? New joins stop now. Existing queued uploads are accepted for ten more minutes.'))return;try{room=source==='local'?updateLocalRoom({status:'closed'}):(await auth.call('close',{room_id:room.id})).room;setupRoomControls();toast('Session ended. Buffered uploads have a ten-minute grace period.');}catch(e){toast(e.message,true);}};
$('#reset-data').onclick=async()=>{
  if(!room||!confirm('Reset all measurements in this session? This permanently removes the classroom trials and clears the charts. Participants stay joined and the session stays open if it is open. Export first if needed. Student-local data and exports are unchanged; queued or new uploads can arrive afterward.'))return;
  const button=$('#reset-data');button.disabled=true;
  try{
    if(source==='local'){
      const rs=await all('localClass');await removeMany('localClass',rs.filter(r=>r.room_id===room.id&&r.kind==='trial').map(r=>r.id));
      acceptRoom(updateLocalRoom({data_revision:(room.data_revision||0)+1}));
    }else{const result=await auth.call('reset-data',{room_id:room.id});acceptRoom(result.room);await syncRemote();}
    toast('Classroom measurements reset. Participants can continue.');
  }catch(e){toast(e.message,true);}finally{button.disabled=!room;}
};
$('#delete-room').onclick=async()=>{if(!room||prompt('This permanently deletes the session and its measurements. Type DELETE to confirm.')!=='DELETE')return;
  try{if(source==='local'){const rs=await all('localClass');await removeMany('localClass',rs.filter(r=>r.room_id===room.id).map(r=>r.id));updateLocalRoom({status:'deleted'});reset('local');labelSource();setupRoomControls();}else{await auth.call('delete',{room_id:room.id});reset('remote');await loadCloud();}toast('Session deleted. Already-exported files and other browsers’ local copies are unchanged.');}catch(e){toast(e.message,true);}};
$('#load-room').onclick=async()=>{const o=$('#room-list').selectedOptions[0];if(o?.dataset.room)await attachRemote(JSON.parse(o.dataset.room));};
$('#copy-address').onclick=()=>copy($('#participant-address').href);

$('#freeze').onclick=()=>{frozen=!frozen;dashboard.freeze(frozen);text('#freeze',frozen?'Resume display (collecting)':'Freeze view');if(!frozen)schedule();};
$('#present').onclick=async()=>{const on=document.body.classList.toggle('presenting');text('#present',on?'Exit presentation':'Present ⛶');try{if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen();}catch{}dashboard.repaint();};
$('#class-export-csv').onclick=()=>download(`fitts-${source||'empty'}-trials.csv`,csv([...records.values()]),'text/csv;charset=utf-8');
$('#class-export-json').onclick=()=>download(`fitts-${source||'empty'}-session.json`,{schema_version:1,app_version:VERSION,source,room,exported_at:new Date().toISOString(),participants:[...participants.values()].map(({latest,...p})=>p),trials:[...records.values()]});
$('#import-json').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;try{if(file.size>50_000_000)throw new Error('Import limit: 50 MB.');const data=JSON.parse(await file.text());if(data.schema_version!==1||!Array.isArray(data.trials)||data.trials.length>50000)throw new Error('Expected a version-1 Fitts Lab export with at most 50,000 trials.');
    const trialRows=data.trials.filter(r=>r&&typeof r.id==='string'&&typeof r.participant_id==='string'&&Number.isFinite(r.acquisition_ms)&&Array.isArray(r.path)&&r.path.length<=120&&r.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.t)));
    if(trialRows.length!==data.trials.length)throw new Error('Some imported observations have invalid measurement fields.');
    reset('import');room=data.room||null;for(const p of data.participants||[])receivePerson(p);labelSource();text('#source-detail',`Imported ${file.name}${data.source==='simulation'?' · contains synthetic observations':''}. This view is disconnected from the classroom.`);text('#connection-state','Imported snapshot');receive(trialRows,false);schedule();
  }catch(e){toast(e.message,true);}finally{$('#import-json').value='';}
};

if(configured()&&auth.session)loadCloud().catch(e=>toast(e.message,true));
