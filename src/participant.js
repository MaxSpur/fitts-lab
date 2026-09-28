import {CONFIG} from '../config.js';
import {$,$$,text,toast,common,download,csv} from './ui.js';
import {ArenaController} from './engine.js';
import {protocol,horizontalSequence,buttonSequence,boundarySequence,BUTTON_SETS,TASKS,TASK_LABELS,planLabel,taskHint,VERSION} from './protocol.js';
import {hash,firstAttempts,mean,nearFar,pathRows,speedRows,endpointRows} from './math.js';
import {boundaryRows,trendlines,trendCaption} from './analysis.js';
import {Chart} from './charts.js';
import {pathSpec,speedSpec,endpointsSpec,scatterSpec,boundarySpec} from './specs.js';
import {put,get,all,clear,saved,save,identity} from './storage.js';
import {configured,api,localRoom,joinRoom,Outbox} from './network.js';
common();
const person=identity(),localLabel='P-'+person.slice(0,6).toUpperCase();
let rows=[],sets=[],currentSet=null,task='horizontal',progress=saved('progress',{}),membership=null,joinCandidate=null;
let refreshTimer=null,saveFailed=false,resultExtent=1600;
try{rows=await all('trials');sets=await all('sets');sets.sort((a,b)=>a.created_at.localeCompare(b.created_at));}catch(e){saveFailed=true;toast('Persistent storage is unavailable. Export your measurements before closing this page.',true);}
if(!saved('horizontal-protocol-v6',false)){progress.horizontal=0;save('progress',progress);save('horizontal-protocol-v6',true);}
if(!saved('circles-protocol-v3',false)){progress.circles=0;save('progress',progress);save('circles-protocol-v3',true);}
if(!saved('interfaces-protocol-v6',false)){progress.interfaces=0;save('progress',progress);save('interfaces-protocol-v6',true);}
const charts={paths:new Chart('#path-chart'),speed:new Chart('#speed-chart'),endpoints:new Chart('#endpoint-chart'),combined:new Chart('#combined-results'),interfaces:new Chart('#interface-results')};
const outbox=new Outbox(({pending,message,blocked})=>{
  text('#saved-count',`${rows.length} attempts saved${saveFailed?' in memory only':''}${pending?` · ${pending} awaiting upload`:''}`);
  $('#retry-sync').hidden=!pending||(!message&&!blocked);
  if(membership)text('#session-description',message?`${message} ${pending} queued; your local copy is intact.`:pending?`${pending} attempts waiting to sync. You are ${membership.credential.participant_label}.`:`New attempts shared · you are ${membership.credential.participant_label}. Your earlier standalone data stays private.`);
});
const arena=new ArenaController($('#arena'),{record:onRecord,status:onStatus,complete:onComplete,error:m=>{toast(m,true);text('#overlay-text',m);$('#run-overlay').hidden=false;}});
function options(plan){
  const choice=$('#input-mode').value;
  const paired=plan.task==='interfaces'&&/^(menu|corner)-/.test(plan.variant);
  const inputMode=['menu-edge','corner-edge'].includes(plan.variant)?'virtual':choice==='auto'?(paired?'virtual':'native'):choice;
  return{participantId:membership?.credential.participant_id||person,participantLabel:membership?.credential.participant_label||localLabel,roomId:membership?.room.id||null,
  perturbation:$('#jitter').checked?'jitter':'normal',jitter:3,gain:Number($('#gain').value),inputMode,
  device:$('#device').value,seed:hash(person+sets.length),dpr:devicePixelRatio||1};}
function selectedPlan(){
  const list=protocol(task,person),i=Math.min(progress[task]||0,list.length-1),p={...list[i]};
  p.protocolVersion=VERSION;
  if($('#run-mode').value==='explore'){
    p.distance=Number($('#distance-control').value);p.width=Number($('#width-control').value);p.height=task==='horizontal'?300:Number($('#height-control').value);
    if(task==='interfaces')p.variant=$('#interface-variant').value;
    if(task==='horizontal')delete p.positions;
    p.custom=true;p.condition=`explore-${p.task}-${p.variant}-${p.distance}-${p.width}-${p.height}`;p.count=task==='horizontal'?12:task==='circles'?9:8;
    p.layoutSeed=hash(`${person}-explore-${p.variant}-${sets.length}`);
    if(task==='interfaces'&&/^(menu|corner)-/.test(p.variant))p.positions=boundarySequence(p);
    else if(task==='interfaces')delete p.positions;
  }else if(task==='horizontal'){
    const completed=sets.filter(s=>s.task==='horizontal'&&s.state==='complete'&&s.plan.width===p.width&&s.plan.block!==undefined&&s.plan.protocolVersion===VERSION).length;
    p.layoutSeed=hash(`${person}-horizontal-${p.width}-${Math.floor(completed/3)}`);
    p.positions=horizontalSequence(p.width,p.layoutSeed).slice(p.block*16,p.block*16+17);
  }else if(task==='interfaces'){
    const pair=p.variant.startsWith('menu')?'menu':p.variant.startsWith('corner')?'corner':p.variant;
    const completed=sets.filter(s=>s.task==='interfaces'&&s.state==='complete'&&s.plan.protocolVersion===VERSION&&
      (BUTTON_SETS.includes(p.variant)?s.plan.variant===p.variant:s.plan.variant.startsWith(pair))).length;
    p.layoutSeed=hash(`${person}-${pair}-${BUTTON_SETS.includes(p.variant)?completed:Math.floor(completed/2)}`);
    p.positions=BUTTON_SETS.includes(p.variant)?buttonSequence(p.variant,p.layoutSeed):boundarySequence(p);
  }
  return p;
}
function prepare(plan=selectedPlan(),restored=null){
  if(currentSet&&arena.engine&&['running','armed','paused'].includes(arena.engine.state))saveCurrent('paused');
  const opts=restored?{...restored.options,setId:restored.id,completed:restored.completed}:options(plan);
  if(['menu-edge','corner-edge'].includes(plan.variant)&&opts.inputMode==='native'){
    opts.inputMode='virtual';$('#input-mode').value='auto';
  }
  if(opts.inputMode==='native'){opts.gain=1;opts.perturbation='normal';$('#jitter').checked=false;$('#gain').value='1';}
  const e=arena.set(plan,opts);
  currentSet=restored||{id:e.id,plan:{...plan},options:opts,task,completed:0,state:'ready',created_at:new Date().toISOString(),interruptions:[]};
  text('#condition-name',planLabel(plan));text('#task-hint',taskHint(plan));
  text('#set-label',$('#run-mode').value==='explore'?'Exploration · a separate condition':`Set ${Math.min((progress[task]||0)+1,protocol(task,person).length)} of ${protocol(task,person).length}`);
  $('#set-history').value='current';onStatus(e);historyOptions();renderMini();
}
function saveCurrent(state){
  if(!currentSet||!arena.engine)return;
  currentSet.completed=arena.engine.count;currentSet.state=state||arena.engine.state;currentSet.interruptions=[...arena.engine.interruptions];
  const i=sets.findIndex(s=>s.id===currentSet.id);if(i<0)sets.push(currentSet);else sets[i]=currentSet;
  put('sets',structuredClone(currentSet)).catch(storageError);
}
function storageError(e){saveFailed=true;toast('Local storage could not be updated. Keep the page open and export your data. '+e.message,true);}
function onRecord(record){
  if(rows.length>=CONFIG.maxLocalTrials){arena.pause('Local capacity reached');toast('The local record limit has been reached. Export and clear the browser data before continuing.',true);return;}
  rows.push(record);put('trials',record).catch(storageError);saveCurrent();
  if(membership)outbox.enqueue(record,structuredClone(membership.credential)).catch(storageError);
  text('#saved-count',`${rows.length} attempts saved${saveFailed?' in memory only':''}`);
  scheduleCharts();
}
function onStatus(e){
  const active=['running','armed'].includes(e.state),complete=e.state==='complete';
  $('#run-overlay').hidden=active;$('#pause-button').disabled=!active;
  $$('.controls input,.controls select,.controls button,.task-tab').forEach(el=>el.disabled=active);
  $('#input-mode').disabled=false;
  $('#input-mode').querySelector('[value=native]').disabled=['menu-edge','corner-edge'].includes(e.plan.variant);
  text('#input-note',e.options.inputMode==='native'?/^(menu|corner)-floating$/.test(e.plan.variant)?'System cursor on the free side. Captured edge results use a different input path.':'System cursor · no pointer capture. Gain and jitter are unavailable.':
    ['menu-edge','corner-edge'].includes(e.plan.variant)?'Captured cursor required to simulate the hard boundary. Esc or P releases it.':
    'Captured cursor · relative movement. Esc or P releases it before changing mode.');
  if(e.options.inputMode==='native'){$('#jitter').disabled=true;$('#gain').disabled=true;}
  text('#overlay-title',complete?'Set complete':e.state==='paused'?'Paused':'Ready');
  if(complete){const a=rows.filter(r=>r.set_id===e.id&&r.attempt===1);const m=mean(a.map(r=>r.acquisition_ms));text('#overlay-text',`${a.length} first attempts · ${m?Math.round(m)+' ms on average':'no timed data'} · ${a.filter(r=>!r.hit).length} misses. Your traces stay visible below.`);text('#start-button',nextLabel());}
  else{const start=e.plan.task==='interfaces'&&e.plan.positions?'starting button':'start marker';text('#overlay-text',e.state==='paused'?`Completed attempts are saved. Click the ${start} to resume.`:e.options.inputMode==='native'?`System cursor. Click the ${start}, then each target. Press P to pause.`:`Cursor capture. Click the ${start}, then each target. Esc releases it.`);text('#start-button',e.state==='paused'?'Resume set':'Start set');}
  text('#trial-status',e.state==='armed'?`Click the ${e.plan.task==='interfaces'&&e.plan.positions?'starting button':'starting marker'}. This click is unscored.`:e.state==='running'?`${e.count} / ${e.plan.count} selections · ${e.attempt>1?'miss recorded; correct your aim':'primary-button clicks only'}`:complete?'Review your traces, then explicitly start the next set.':'The starting click is unscored.');
  $('#progress-track').innerHTML='';for(let i=0;i<e.plan.count;i++){const span=document.createElement('span');span.className='segment'+(i<e.count?' done':'');$('#progress-track').append(span);}
  if(['running','armed'].includes(e.state)&&currentSet?.id===e.id)saveCurrent();
  $('#distance-control').disabled=active||task==='interfaces';
  if(e.state==='paused'){saveCurrent('paused');scheduleCharts(true);}
}
function onComplete(e){saveCurrent('complete');if($('#run-mode').value==='guided'){progress[task]=(progress[task]||0)+1;save('progress',progress);}text('#start-button',nextLabel());historyOptions();scheduleCharts(true);}
function nextLabel(){if($('#run-mode').value==='explore')return'Repeat these settings →';const list=protocol(task,person),i=progress[task]||0;
  if(i<list.length)return`Next set → ${planLabel(list[i])}`;const n=TASKS.indexOf(task);return n<2?`Continue → ${TASK_LABELS[TASKS[n+1]]}`:'All done → view your results';}
function switchTask(next){task=next;if((progress[task]||0)>=protocol(task,person).length)progress[task]=0;
  $$('.task-tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.task===task)));
  $('#variant-label').hidden=task!=='interfaces';$('#height-label').hidden=task!=='interfaces';
  $('#distance-control').disabled=task==='interfaces';
  prepare();}
function start(){
  if(arena.engine.state==='complete'){
    if($('#run-mode').value==='guided'&&(progress[task]||0)>=protocol(task,person).length){
      const n=TASKS.indexOf(task);if(n===2){$('#results').scrollIntoView({behavior:'smooth'});return;}switchTask(TASKS[n+1]);
    }else prepare();
  }
  if(rows.length>=CONFIG.maxLocalTrials){toast('Export and clear the local history before starting more sets.',true);return;}
  // Keep the entire measured area in view before the first movement.
  $('#arena').scrollIntoView({block:'center',behavior:'instant'});
  saveCurrent('armed');arena.start();
}
$('#start-button').onclick=start;$('#pause-button').onclick=()=>arena.pause('Pause button');
$$('.task-tab').forEach(b=>b.onclick=()=>switchTask(b.dataset.task));
// Roving-keyboard behavior for the three tabs.
$$('.task-tab').forEach((b,i)=>b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;switchTask(TASKS[n]);$$('.task-tab')[n].focus();}}));
for(const q of ['#device','#jitter','#gain'])$(q).onchange=()=>{save(q.slice(1),$(q).type==='checkbox'?$(q).checked:$(q).value);prepare();};
$('#input-mode').onchange=()=>{const hadProgress=arena.engine?.count>0||arena.active();save('cursor-mode-v2',$('#input-mode').value);prepare();if(hadProgress)toast('Cursor mode changed. A new set is ready; earlier attempts remain in history.');};
$('#run-mode').onchange=()=>{$('#explore-controls').hidden=$('#run-mode').value!=='explore';
  $('#input-mode').value=$('#run-mode').value==='guided'?'auto':saved('cursor-mode-v2','auto');prepare();};
$('#apply-parameters').onclick=()=>prepare();
for(const kind of ['distance','width','height'])$('#'+kind+'-control').oninput=()=>text('#'+kind+'-value',$('#'+kind+'-control').value);
$('#retry-sync').onclick=()=>outbox.retry();
function historyOptions(){const selected=$('#set-history').value;$('#set-history').innerHTML='<option value="current">Current set</option>';
  for(const s of [...sets].reverse()){if(!s.completed&&!rows.some(r=>r.set_id===s.id))continue;const o=document.createElement('option');o.value=s.id;o.textContent=`${TASK_LABELS[s.task]} · ${planLabel(s.plan)} · ${s.completed}/${s.plan.count}${s.options.perturbation==='jitter'?' · jitter':''}`;$('#set-history').append(o);}
  $('#set-history').value=selected||'current';if(!$('#set-history').value)$('#set-history').value='current';
}
async function renderMini(){
  const id=$('#set-history').value==='current'?arena.engine?.id:$('#set-history').value,rs=rows.filter(r=>r.set_id===id),s=sets.find(s=>s.id===id)||currentSet;
  if(!rs.length){for(const k of ['paths','speed','endpoints'])charts[k].empty('Your traces will appear here.\nFinish a few clicks to begin.');return;}
  const defs={paths:[pathSpec(),{paths:pathRows(rs)}],speed:[speedSpec(),{speeds:speedRows(rs)}],endpoints:[endpointsSpec(s?.task==='circles'?'circle':'rect',Math.max(2,...endpointRows(rs).flatMap(r=>[Math.abs(r.x),Math.abs(r.y)]))*1.05),{endpoints:endpointRows(rs)}]};
  for(const[k,[spec,data]]of Object.entries(defs)){const key=k==='endpoints'?JSON.stringify(spec.layer[0]):'stable';if(charts[k].result&&charts[k]._geometryKey===key)await charts[k].update(data);else{charts[k]._geometryKey=key;await charts[k].set(spec,data);}}
}
async function renderResults(){
  const perturbation=$('#result-condition').value;
  const rs=firstAttempts(rows,{perturbation}).filter(r=>Number.isFinite(r.index_difficulty)&&(r.task!=='interfaces'||/^buttons-|^(wide|tall)$/.test(r.variant)));
  if(rs.length){
    resultExtent=Math.max(resultExtent,Math.ceil(Math.max(...rs.map(r=>r.acquisition_ms))/500)*500);
    const trend=trendlines(rs);await charts.combined.set(scatterSpec({height:340,extent:resultExtent}),{trials:rs,means:[],fit:trend.lines});
    text('#combined-summary',`${rs.length} first attempts · ${rs.filter(r=>!r.hit).length} misses · ${trendCaption(trend)}`);
  }else{charts.combined.empty('Complete some selections to compare stages here.');text('#combined-summary','');}
  const br=boundaryRows(rows,perturbation);
  if(br.length){await charts.interfaces.set(boundarySpec(),{boundaries:br});text('#interfaces-summary','Within each pair, the target sequence matches. The bold line averages complete participant pairs. Only control approaches are compared, and protocol versions stay separate. Current runs put free before edge, so practice may affect the difference.');}else charts.interfaces.empty('Complete a menu or window-edge set to start the matched comparison.');
}
function scheduleCharts(full=false){if(refreshTimer&&!full)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{refreshTimer=null;try{await renderMini();if(full||!arena.active())await renderResults();}catch(e){toast('Chart update failed: '+e.message,true);}},full?30:650);}
$('#set-history').onchange=renderMini;$('#result-condition').onchange=renderResults;
$$('[data-chart-code]').forEach(b=>b.onclick=()=>charts[b.dataset.chartCode].code());
$('#export-csv').onclick=()=>download('fitts-trials.csv',csv(rows),'text/csv;charset=utf-8');
$('#export-json').onclick=()=>download('fitts-session.json',{schema_version:1,app_version:VERSION,source:'participant',exported_at:new Date().toISOString(),trials:rows,sets});
$('#clear-data').onclick=async()=>{if(!confirm('Clear all participant trials and set history in this browser? Export first. Pending uploads will also be removed. The instructor’s stored copy is unchanged.'))return;
  arena.pause('Cleared local history');for(const store of ['trials','sets','outbox'])await clear(store);rows=[];sets=[];progress={};save('progress',progress);prepare();renderResults();outbox.status();};
function limit(){const near=Number($('#near-slider').value),far=$('#infinite-toggle').checked?Infinity:Number($('#far-slider').value),x=20+near/1800*390,end=far===Infinity?432:20+far/1800*390;
  $('#edge-rect').setAttribute('x',x);$('#edge-rect').setAttribute('width',end-x);$('#near-label').setAttribute('x',x);$('#near-label').textContent=`near ${near}`;$('#far-label').setAttribute('x',Math.min(end,390));$('#far-label').textContent=far===Infinity?'far → ∞':`far ${far}`;$('#infinity-symbol').toggleAttribute('hidden',far!==Infinity);$('#far-slider').disabled=far===Infinity;
  text('#limit-value',far===Infinity?`Original-formula ID → 0 bits · Shannon ID → ${nearFar(near,far,'shannon').toFixed(3)} bits`:
    `Original-formula ID = ${nearFar(near,far).toFixed(3)} bits`);}
for(const q of ['#near-slider','#far-slider','#infinite-toggle'])$(q).oninput=limit;limit();
async function discoverRoom(){
  const useLocal=new URLSearchParams(location.search).has('local');
  if(useLocal){const room=localRoom();return room?.status==='open'?{room,source:'local'}:null;}
  if(!configured())return null;
  const result=await api('status',{slug:CONFIG.classroomSlug});return result.room?{room:result.room,source:'remote'}:null;
}
$('#join-class').onclick=async()=>{
  try{joinCandidate=await discoverRoom();
    if(!joinCandidate){toast(configured()?'No classroom is open at this address. You can continue on your own.':'No backend is configured. Open the classroom page and choose Local rehearsal to test both pages in this browser.',true);return;}
    text('#join-description',`${joinCandidate.room.title}${joinCandidate.source==='local'?' · same-browser rehearsal':''}`);$('#share-consent').checked=false;$('#confirm-join').disabled=true;$('#join-dialog').showModal();
  }catch(e){toast(e.message,true);}
};
$('#share-consent').onchange=()=>$('#confirm-join').disabled=!$('#share-consent').checked;
$('#confirm-join').onclick=async()=>{
  if(!$('#share-consent').checked||!joinCandidate)return;$('#confirm-join').disabled=true;
  try{arena.pause('Joined classroom');const credential=await joinRoom(joinCandidate.room,$('#device').value,joinCandidate.source);membership={credential,room:joinCandidate.room};$('#join-dialog').close();updateMembership();prepare();}catch(e){toast(e.message,true);$('#confirm-join').disabled=false;}
};
$('#leave-class').onclick=()=>{arena.pause('Stopped sharing');membership=null;save('active-membership',null);updateMembership();prepare();toast('Future attempts stay private. Already queued attempts will finish uploading.');};
function updateMembership(){
  $('#join-class').hidden=!!membership;$('#leave-class').hidden=!membership;
  text('#session-title',membership?`${membership.room.title} · ${membership.credential.participant_label}`:'Local session');
  text('#session-description',membership?`Sharing new measurements${membership.credential.source==='local'?' in a same-browser rehearsal':''}.`:'Saved in this browser. Nothing new is uploaded unless you join a classroom.');
  if(!membership)$('#class-recommendation').hidden=true;outbox.status();
}
function recommend(room){if(!membership)return;membership.room=room;
  if(room.phase&&room.phase!==task){$('#class-recommendation').hidden=false;text('#recommendation-text',room.phase==='results'?'The class is discussing the results. Finish your current set, then look at the projection.':`The class is exploring ${TASK_LABELS[room.phase]}. Finish your set or use the button to switch.`);text('#follow-class',room.phase==='results'?'View my results':'Go to this stage');}else $('#class-recommendation').hidden=true;
}
$('#follow-class').onclick=()=>{const phase=membership?.room.phase;if(phase==='results')$('#results').scrollIntoView({behavior:'smooth'});else if(TASKS.includes(phase))switchTask(phase);};
setInterval(async()=>{
  if(!membership||document.hidden)return;
  try{const room=membership.credential.source==='local'?localRoom():(await api('status',{slug:CONFIG.classroomSlug,room_id:membership.room.id})).room;
    if(!room||room.id!==membership.room.id||room.status!=='open'){
      // End sharing only at a safe boundary. Already-completed records remain queued.
      if(arena.active()){recommend({...membership.room,phase:'results'});return;}
      membership=null;save('active-membership',null);updateMembership();prepare();toast('The classroom has ended. Further exploration stays local.');
    }else recommend(room);
  }catch{/* The durable outbox handles interruptions; do not discard membership on a transient failure. */}
},CONFIG.participantPollMs);
for(const q of ['device','jitter','gain']){const v=saved(q,null);if(v!==null){if(q==='jitter')$('#'+q).checked=v;else $('#'+q).value=v;}}
$('#input-mode').value='auto';
const prior=saved('active-membership',null);if(prior&&(prior.credential.source==='local'?localRoom()?.id===prior.room.id:configured()))membership=prior;
updateMembership();prepare();renderResults();historyOptions();
$('#mobile-warning').hidden=matchMedia('(pointer:fine)').matches;
// Recover an incomplete set, with an unscored restart, after a refresh.
const incomplete=[...sets].reverse().find(s=>s.task===task&&s.state!=='complete'&&s.completed>0&&s.plan&&s.options&&
  s.options.roomId===(membership?.room.id||null)&&s.options.inputMode===options(s.plan).inputMode&&
  (s.plan.protocolVersion===VERSION)&&
  (s.task!=='horizontal'||s.plan.positions?.length===s.plan.count+1||s.plan.custom&&s.plan.count===12));
if(incomplete){prepare(incomplete.plan,incomplete);toast('Recovered an unfinished set. Resume with an unscored starting click.');}
window.addEventListener('beforeunload',e=>{if(arena.active()){e.preventDefault();e.returnValue='';}});
