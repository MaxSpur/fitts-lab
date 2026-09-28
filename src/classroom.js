import {datasetKey,datasetLabel} from './runs.js';
import {sessionState,sessionLabel} from './session.js';
import {CONFIG} from '../config.js';
import {$,$$,text,toast,common,download,csv,copy} from './ui.js';
import {Chart} from './charts.js';
import {heroSpec,boundarySpec,pathSpec} from './specs.js';
import {firstAttempts,conditionMeans,mean,pathRows} from './math.js';
import {boundaryRows,displaySample,trendlines,trendCaption,studentColor,plotAxis} from './analysis.js';
import {simulationRows} from './simulation.js';
import {configured,InstructorAuth,RoomStream,localRoom,createLocalRoom,updateLocalRoom,localSnapshot,channel} from './network.js';
import {all,removeMany,saved,save} from './storage.js';
import {TASK_LABELS,VERSION} from './protocol.js';
common();
const auth=new InstructorAuth(),charts={hero:new Chart('#class-chart'),boundary:new Chart('#class-boundaries'),path:new Chart('#class-path')};
let source=null,room=null,records=new Map(),participants=new Map(),datasets=new Map(),lastReceived=null,selected=null,stream=null,poll=null,demoTimer=null,cursor='0',syncing=false;
let connectionRun=0;
let sourceGeneration=0,frozenPeople=null,frozenRows=null,renderedRows=[];
let frozen=false,renderedCount=0,renderTimer=null,rendering=false,dirty=false,extent=1600,axis='index_difficulty';
let streamState='Connecting…',lastSync=null,syncError='';
const flashes=new Set();const bc=channel();
function id(r){return `${r.participant_id}:${r.id}`;}
function reset(next){connectionRun++;sourceGeneration++;frozenPeople=null;frozenRows=null;renderedRows=[];for(const q of ['#task-filter','#device-filter','#noise-filter'])$(q).disabled=false;stream?.close();stream=null;clearInterval(poll);clearInterval(demoTimer);clearTimeout(renderTimer);renderTimer=null;dirty=false;cursor='0';source=next;records=new Map();participants=new Map();datasets=new Map();room=null;selected=null;flashes.clear();extent=1600;lastReceived=null;renderedCount=0;frozen=false;syncing=false;
  lastSync=null;syncError='';streamState='Connecting…';text('#sync-now','Sync now');$('#sync-now').hidden=next!=='remote';text('#session-state','');text('#freeze','Freeze view');$('#source-banner').classList.toggle('simulation',next==='simulation');$('#session-controls').hidden=!['local','remote'].includes(next);
  for(const c of Object.values(charts))c.empty('Waiting for measurements.');$('#mosaic').innerHTML='';$('#mosaic-empty').hidden=false;text('#participant-count','0');text('#mosaic-count','0');text('#selected-path-title','Movement path');text('#selected-path-note','');text('#boundary-note','');text('#attempt-count','0');text('#error-count','—');text('#last-update','Nothing received yet');text('#fit-caption','Waiting for enough successful trials to fit a line.');text('#coverage','');
}
function receive(newRows,animate=true){let added=0;for(const r of newRows){if(!r||!r.id||!r.participant_id||!Number.isFinite(r.acquisition_ms))continue;if(records.has(id(r)))continue;
  records.set(id(r),r);added++;const old=participants.get(r.participant_id)||{id:r.participant_id,label:r.participant_label||'Participant',device:r.device,count:0};old.count=(old.count||0)+1;if(!old.latest||r.created_at>=old.latest.created_at)old.latest=r;participants.set(r.participant_id,old);const key=datasetKey(r),set=datasets.get(key)||{id:key,participantId:r.participant_id,label:datasetLabel(r),count:0};set.count++;if(!set.latest||r.created_at>=set.latest.created_at)set.latest=r;datasets.set(key,set);if(animate)flashes.add(key);
}if(added){lastReceived=Date.now();if(frozen)text('#freeze',`Resume · ${records.size-renderedCount} new`);else schedule();}}
function receivePerson(p){participants.set(p.id,{...participants.get(p.id),...p,count:participants.get(p.id)?.count||0});if(!frozen)schedule();}
function labelSource(){text('#source-label',source==='simulation'?'Simulation':source==='local'?'Local rehearsal':source==='import'?'Imported session':'Classroom session');text('#source-detail',source==='simulation'?'Preview data is isolated from real sessions.':source==='local'?'Open the participant link in another tab of this browser profile.':source==='import'?'This view is not connected to a classroom.':'Measurements and saved results for the selected session.');text('#room-title',room?.title||'');}
function acceptRoom(next){
  if(!next||room&&next.id===room.id&&(next.data_revision||0)<(room.data_revision||0))return;
  if(room&&next.id===room.id&&(next.data_revision||0)!==(room.data_revision||0)){
    sourceGeneration++;records.clear();datasets.clear();cursor='0';selected=null;lastReceived=null;renderedCount=0;extent=1600;
    frozen=false;frozenPeople=null;frozenRows=null;renderedRows=[];flashes.clear();
    for(const p of participants.values()){p.count=0;delete p.latest;}
    for(const c of Object.values(charts))c.empty('No measurements since reset.');
    $('#mosaic').innerHTML='';text('#freeze','Freeze view');
    for(const q of ['#task-filter','#device-filter','#noise-filter'])$(q).disabled=false;
    text('#selected-path-title','Movement path');text('#selected-path-note','');
  }
  room=next;setupRoomControls();schedule();
}
function setupRoomControls(){
  const state=sessionState(room);text('#session-state',`${state.label} · ${state.detail}`);
  if(room){const o=[...$('#room-list').options].find(o=>o.value===room.id);if(o){o.textContent=sessionLabel(room);o.dataset.room=JSON.stringify(room);}}
  text('#room-title',room?.title||'');const link=new URL('./',location.href);if(source==='local')link.searchParams.set('local','1');$('#participant-address').href=link.href;$('#participant-address').textContent=link.href;
  $('#end-room').disabled=!state.open;$('#delete-room').disabled=!room;$('#reset-data').disabled=!room;$('#room-list').closest('div').hidden=source==='local';$('#capacity').closest('label').hidden=source==='local';
}
function schedule(){dirty=true;if(renderTimer||rendering||frozen)return;renderTimer=setTimeout(async()=>{renderTimer=null;if(!dirty||frozen)return;dirty=false;rendering=true;try{await render();}catch(e){toast('Chart update failed: '+e.message,true);console.error(e);}finally{rendering=false;if(dirty)schedule();}},450);}
function filterRows(){const task=$('#task-filter').value,noise=$('#noise-filter').value,device=$('#device-filter').value;return firstAttempts([...records.values()],{...(task==='all'?{}:{task}),perturbation:noise}).filter(r=>(device==='all'||r.device===device)&&Number.isFinite(r.index_difficulty)&&!/-edge$/.test(r.variant));}
async function render(){
  if(frozen)return;const generation=sourceGeneration;const allRows=[...records.values()],allFirst=firstAttempts(allRows,{perturbation:'all'}),rs=filterRows();
  text('#participant-count',participants.size);text('#mosaic-count',datasets.size);text('#attempt-count',records.size.toLocaleString());text('#error-count',allFirst.length?`${(100*allFirst.filter(r=>!r.hit).length/allFirst.length).toFixed(1)}%`:'—');
  text('#last-update',lastReceived?`Last received ${new Date(lastReceived).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Nothing received yet');
  renderMosaic();
  if(rs.length){
    const means=conditionMeans(rs.filter(r=>r.hit)),field=axis,trend=trendlines(rs,field);
    const max=Math.max(...rs.map(r=>r.acquisition_ms));const nextExtent=Math.max(extent,Math.ceil(max/500)*500);
    const fitData=trend.lines,axisInfo=plotAxis(rs,axis);
    const chartRows=displaySample(rs).map(r=>({...r,dataset_id:datasetKey(r),student_color:studentColor(r.participant_id),outcome:r.hit?'Hit':'Miss'})),data={trials:chartRows,means:means.map(r=>({...r,dataset_id:datasetKey(r),student_color:studentColor(r.participant_id)})),fit:fitData};
    if(!charts.hero.result||nextExtent!==extent||charts.hero.spec.layer[0].encoding.x.field!==axis||charts.hero.spec.layer[0].encoding.x.scale.domain[1]!==axisInfo.maximum){extent=nextExtent;await charts.hero.set(heroSpec({extent,x:axis,xMax:axisInfo.maximum}),data);bindSelection();}else await charts.hero.update(data);
    if(generation!==sourceGeneration)return;
    focusStudent();renderedRows=rs;text('#fit-caption',trendCaption(trend,field)+' · pooled classroom observations');
    text('#coverage',`${rs.length} first attempts in this view · ${new Set(rs.map(r=>r.participant_id)).size} students · ${new Set(rs.map(datasetKey)).size} runs · ${new Set(rs.map(r=>r.condition)).size} conditions${rs.length>5000?' · faint marks show a deterministic 5,000-observation sample; calculations use all rows':''}`);
  }else{charts.hero.empty('The selected task and condition have no observations yet.');text('#fit-caption','Waiting for enough successful trials to fit a line.');text('#coverage','');}
  const filteredAll=allRows.filter(r=>$('#device-filter').value==='all'||r.device===$('#device-filter').value);
  const boundaries=boundaryRows(filteredAll,$('#noise-filter').value);
  if(boundaries.length){if(charts.boundary.result)await charts.boundary.update({boundaries});else await charts.boundary.set(boundarySpec(),{boundaries});text('#boundary-note','Successful first attempts. Free runs precede bounded runs; practice may affect the difference.');}else{charts.boundary.empty('Interface measurements will appear here.');text('#boundary-note','');}
  if(generation!==sourceGeneration)return;
  await renderSelectedPath();renderedCount=records.size;
}
function bindSelection(){charts.hero.result?.view.addSignalListener('selectedPerson',(_,v)=>{const ids=v?.dataset_id;selected=Array.isArray(ids)?ids[0]||null:null;focusStudent();renderSelectedPath();renderMosaic();});}
function focusStudent(){const view=charts.hero.result?.view;if(view)view.signal('focusStudent',selected||'').runAsync().catch(console.error);}
function renderMosaic(){
  const people=frozen&&frozenPeople?frozenPeople:datasets;const grid=$('#mosaic');$('#mosaic-empty').hidden=people.size>0;
  // Stable insertion order; never re-sort people by speed or arrival frequency.
  for(const p of people.values()){
    let tile=[...grid.children].find(e=>e.dataset.person===p.id);
    if(!tile){tile=document.createElement('button');tile.className='person';tile.dataset.person=p.id;tile.setAttribute('aria-label',`Inspect ${p.label}`);const name=document.createElement('span');name.textContent=p.label;const canvas=document.createElement('canvas');canvas.width=150;canvas.height=80;const count=document.createElement('span');count.className='person-count';tile.append(name,canvas,count);tile.onclick=()=>{selected=selected===p.id?null:p.id;focusStudent();renderSelectedPath();renderMosaic();};grid.append(tile);}
    tile.style.borderLeft='4px solid '+studentColor(p.participantId);tile.classList.toggle('selected',selected===p.id);tile.querySelector('.person-count').textContent=String(p.count||0);
    if(flashes.has(p.id)){tile.classList.remove('flash');void tile.offsetWidth;tile.classList.add('flash');}
    drawMini(tile.querySelector('canvas'),p.latest);
  }flashes.clear();
}
function drawMini(canvas,r){const c=canvas.getContext('2d');c.clearRect(0,0,150,80);c.strokeStyle='#cbd1cb';c.lineWidth=1;c.beginPath();c.moveTo(12,40);c.lineTo(138,40);c.stroke();if(!r?.path?.length)return;
  const ps=pathRows([r]),d=Math.max(r.distance,1);c.strokeStyle=studentColor(r.participant_id);c.lineWidth=2;c.beginPath();ps.forEach((p,i)=>{const x=12+p.along*118,y=40+Math.max(-30,Math.min(30,p.across/d*100));i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.fillStyle='#387d87';c.beginPath();c.arc(130,40,3,0,2*Math.PI);c.fill();}
async function renderSelectedPath(){
  const people=frozen&&frozenPeople?frozenPeople:datasets;let p=people.get(selected);if(!p?.latest)p=[...people.values()].filter(p=>p.latest).at(-1);
  if(!p?.latest){charts.path.empty('Click a participant tile to inspect a movement.');return;}
  text('#selected-path-title',`${p.label} · latest movement`);const paths=pathRows([p.latest]);
  if(charts.path.result)await charts.path.update({paths});else await charts.path.set(pathSpec(),{paths});
  text('#selected-path-note',`${TASK_LABELS[p.latest.task]} · ${Math.round(p.latest.acquisition_ms)} ms · ${p.latest.hit?'hit':'miss'} · attempt ${p.latest.attempt}`);
}
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
  reset('remote');const run=connectionRun;room=next;$('#room-list').value=room.id;labelSource();setupRoomControls();save('selected-room',room.id);
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
$('#freeze').onclick=()=>{frozen=!frozen;frozenPeople=frozen?structuredClone(datasets):null;frozenRows=frozen?renderedRows:null;for(const q of ['#task-filter','#device-filter','#noise-filter'])$(q).disabled=frozen;text('#freeze',frozen?'Resume display (collecting)':'Freeze view');if(!frozen)schedule();};
$('#present').onclick=async()=>{const on=document.body.classList.toggle('presenting');text('#present',on?'Exit presentation':'Present ⛶');try{if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen();}catch{/* The presentation layout works without browser fullscreen. */}setTimeout(()=>schedule(),100);};
for(const q of ['#task-filter','#device-filter','#noise-filter'])$(q).onchange=()=>{selected=null;focusStudent();schedule();};
async function axisTo(next){
  if(axis===next)return;axis=next;
  $$('[data-axis]').forEach(b=>{b.classList.toggle('active',b.dataset.axis===axis);b.setAttribute('aria-pressed',String(b.dataset.axis===axis));});
  text('#axis-caption',plotAxis([],axis).caption);
  if(frozen&&charts.hero.result){
    const rows=frozenRows||[],trend=trendlines(rows,axis),data={...charts.hero.rows,fit:trend.lines};
    await charts.hero.set(heroSpec({extent,x:axis,xMax:plotAxis(rows,axis).maximum}),data);bindSelection();focusStudent();text('#fit-caption','Frozen · '+trendCaption(trend,axis));
  }else schedule();
}
$$('[data-axis]').forEach(b=>b.onclick=()=>axisTo(b.dataset.axis));
$('#hero-code').onclick=()=>charts.hero.code();$('#boundary-code').onclick=()=>charts.boundary.code();$('#path-code').onclick=()=>charts.path.code();
$('#class-export-csv').onclick=()=>download(`fitts-${source||'empty'}-trials.csv`,csv([...records.values()]),'text/csv;charset=utf-8');
$('#class-export-json').onclick=()=>download(`fitts-${source||'empty'}-session.json`,{schema_version:1,app_version:VERSION,source,room,exported_at:new Date().toISOString(),participants:[...participants.values()].map(({latest,...p})=>p),trials:[...records.values()]});
$('#import-json').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;try{if(file.size>50_000_000)throw new Error('Import limit: 50 MB.');const data=JSON.parse(await file.text());if(data.schema_version!==1||!Array.isArray(data.trials)||data.trials.length>50000)throw new Error('Expected a version-1 Fitts Lab export with at most 50,000 trials.');
    const trialRows=data.trials.filter(r=>r&&typeof r.id==='string'&&typeof r.participant_id==='string'&&Number.isFinite(r.acquisition_ms)&&Array.isArray(r.path)&&r.path.length<=120&&r.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.t)));
    if(trialRows.length!==data.trials.length)throw new Error('Some imported observations have invalid measurement fields.');
    reset('import');room=data.room||null;labelSource();text('#source-detail',`Imported ${file.name}${data.source==='simulation'?' · contains synthetic observations':''}. This view is disconnected from the classroom.`);text('#connection-state','Imported snapshot');receive(trialRows,false);schedule();
  }catch(e){toast(e.message,true);}finally{$('#import-json').value='';}
};
if(configured()&&auth.session){loadCloud().catch(e=>toast(e.message,true));}
for(const c of Object.values(charts))c.empty('Select a source to begin.');
