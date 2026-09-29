import {Chart} from './charts.js';
import {pathSpec} from './specs.js';
import {pathRows} from './math.js';
import {activityRuns} from './activity.js';
import {saved,save} from './storage.js';
import {download,toast} from './ui.js';
import {analyze,finiteRows,regressionGroups,runKey,taskLabels,tasks,cleanRows,REPLICATES} from './study.js';
import {acquisitionSpec,pairedSpec,pairedData,personColor,slopesSpec} from './study-specs.js';
import {renderReport} from './study-report.js';
const bounded=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):fallback;
const chartCard=(id,title)=>`<article class="chart-card"><div class="chart-title"><h3>${title}</h3><button class="code-link" data-code="${id}" aria-label="Show chart code">&lt;/&gt;</button></div><div id="${id}" class="chart"></div></article>`;
/** Shared read-only visualization/report layer. This module never calls a backend or changes stored trials. */
export class Dashboard{
  constructor(root){
    this.root=root;this.selected=null;this.rows=[];this.people=[];this.room=null;this.frozen=false;this.requestId=0;this.epoch=0;this.renderId=0;this.charts=new Map();this.pending=null;this.running=false;this.cache=null;this.lastSnapshot=null;this.worker=null;
    root.innerHTML=`<div class="study-top"><article class="chart-card hero-chart"><div class="chart-title"><h3>Acquisition time</h3><button class="code-link" data-code="class-chart">&lt;/&gt; Vega-Lite</button></div>
    <div class="study-toolbar"><div class="segmented" aria-label="Horizontal axis"><button data-axis="distance">Distance only</button><button data-axis="approach_width">Size only</button><button data-axis="index_difficulty" class="active">Difficulty (D/W)</button></div>
    <label>Layout <select id="layout-filter"><option value="combined">Combined</option><option value="separate">Separate stages</option></select></label><label>Stage <select id="task-filter"><option value="all">All stages</option><option value="horizontal">Horizontal</option><option value="circles">Circles</option><option value="interfaces">Interfaces</option></select></label>
    <label>Pointer <select id="noise-filter"><option value="normal">Normal</option><option value="jitter">Unsteady</option><option value="all">Both</option></select></label>
    <label class="study-range">Cutoff <input id="outlier-filter" type="range" min="500" max="10000" step="250" value="5000"><output id="outlier-value"></output></label>
    <label class="study-range">Height <input id="height-filter" type="range" min="260" max="720" step="20" value="420"><output id="height-value"></output></label></div>
    <p class="study-key">Faint points: trials · colored lines: stage/input fits · shading: 95% participant-cluster intervals · selected run: outlined color</p>
    <div id="class-chart" class="chart"></div><div id="stage-charts" hidden>${tasks.map(t=>`<div class="stage-panel"><div class="chart-title"><h3>${taskLabels[t]}</h3><button class="code-link" data-code="stage-${t}">&lt;/&gt;</button></div><div id="stage-${t}" class="chart"></div></div>`).join('')}</div>
    <p id="coverage" class="study-key" role="status"></p></article>
    <aside class="chart-card activity-card"><div class="chart-title"><h3>Student runs</h3><button id="clear-selection" class="small" hidden>Show all</button></div><p id="activity-summary" class="study-key"></p><div id="mosaic" class="activity-list"></div><p id="run-detail" class="study-key"></p>
    <div class="chart-title"><h3 id="selected-path-title">Recent paths</h3><button class="code-link" data-code="class-path">&lt;/&gt;</button></div><div id="class-path" class="chart"></div><p id="selected-path-note" class="study-key"></p></aside></div>
    <section class="study-boundaries"><h2>Free vs. bounded targets</h2><p class="study-key">Each card separates recorded run pairs from participant-level effects. Positive time saved favors the boundary; zero means no difference.</p><div id="boundary-panels" class="study-pairs"></div><p id="boundary-note" class="study-key"></p>
    <details><summary>Accuracy differences (all first attempts)</summary><div id="accuracy-panels" class="study-pairs"></div></details></section>
    <section id="study-report" class="study-report"></section><details id="slopes-detail"><summary>Participant slope differences</summary>${chartCard('slopes-chart','Individual descriptive slopes · untrimmed reference')}<p class="study-key">Each dot is a participant-specific fit within a stage/input group; these are descriptive estimates without individual confidence intervals.</p></details>
    <details id="analysis-code-details"><summary>Analysis code and reproducibility</summary><p>Pure analysis functions shared by this page and the instructor dashboard. Bootstrap seeds are deterministic; all exported measurements remain intact.</p><button id="report-export">Export analysis · JSON</button> <a href="./src/study.js" target="_blank" rel="noopener">Open analysis source</a><pre id="analysis-source">Open this section to load the code.</pre></details>`;
    this.axis='index_difficulty';this.q('#outlier-filter').value=bounded(saved('classroom-outlier-ms',5000),500,10000,5000);this.q('#height-filter').value=bounded(saved('classroom-chart-height',420),260,720,420);
    this.root.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{this.axis=b.dataset.axis;this.root.querySelectorAll('[data-axis]').forEach(q=>{q.classList.toggle('active',q===b);q.setAttribute('aria-pressed',String(q===b));});this.compute();});
    for(const id of ['#task-filter','#layout-filter'])this.q(id).onchange=()=>this.repaint();
    this.q('#noise-filter').onchange=()=>this.compute();
    this.q('#outlier-filter').oninput=()=>{save('classroom-outlier-ms',+this.q('#outlier-filter').value);this.labels();this.compute();};
    this.q('#height-filter').oninput=()=>{save('classroom-chart-height',+this.q('#height-filter').value);this.labels();this.repaint();};
    this.q('#clear-selection').onclick=()=>this.select(null);
    root.addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(b)this.charts.get(b.dataset.code)?.code();});
    this.q('#report-export').onclick=()=>{if(this.cache)download('fitts-analysis.json',{...this.cache,snapshot:{title:this.lastSnapshot?.room?.title,received_at:this.lastSnapshot?.receivedAt,source:this.lastSnapshot?.source},note:'Untrimmed reference and current-cutoff sensitivity; participant-aware exploratory analysis.'});};
    this.q('#analysis-code-details').addEventListener('toggle',async()=>{if(this.q('#analysis-code-details').open&&!this.codeLoaded){try{const r=await fetch(new URL('./study.js',import.meta.url));if(!r.ok)throw new Error();this.q('#analysis-source').textContent=await r.text();this.codeLoaded=true;}catch{this.q('#analysis-source').textContent='Use the analysis source link above.';}}});
    this.q('#slopes-detail').addEventListener('toggle',()=>this.repaint());
    this.root.querySelector('.study-boundaries details').addEventListener('toggle',()=>this.repaint());
    this.resize=new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==this.width){this.width=w;this.repaint();}});this.resize.observe(root);
    this.labels();this.clear('Select a source to begin.');
  }
  q(s){return this.root.querySelector(s);}
  labels(){const v=+this.q('#outlier-filter').value;this.cutoff=v>=10000?Infinity:v;this.height=+this.q('#height-filter').value;this.q('#outlier-value').textContent=this.cutoff===Infinity?'All':`${v/1000} s`;this.q('#outlier-filter').setAttribute('aria-valuetext',this.q('#outlier-value').textContent);this.q('#height-value').textContent=`${this.height} px`;}
  setSnapshot(rows,people=[],room=null,{source='',receivedAt=new Date().toISOString()}={}){
    this.latest={rows,people,room,source,receivedAt};if(this.frozen)return;this.rows=rows;this.people=people;this.room=room;this.source=source;this.receivedAt=receivedAt;this.compute();
  }
  freeze(on){this.frozen=on;if(on){this.epoch++;clearTimeout(this.computeTimer);this.pending=null;this.worker?.terminate();this.worker=null;this.running=false;if(this.lastSnapshot){this.rows=this.lastSnapshot.rows;this.people=this.lastSnapshot.people;this.room=this.lastSnapshot.room;}this.repaint();}else if(this.latest)this.setSnapshot(this.latest.rows,this.latest.people,this.latest.room,this.latest);}
  clear(message='No results to display.'){
    clearTimeout(this.computeTimer);clearTimeout(this.paintTimer);this.requestId++;this.epoch++;this.renderId++;this.worker?.terminate();this.worker=null;this.running=false;this.pending=null;this.cache=null;this.lastSnapshot=null;this.latest=null;this.rows=[];this.people=[];this.selected=null;this.frozen=false;
    for(const chart of this.charts.values())chart.empty(message);this.q('#boundary-panels').replaceChildren();this.q('#accuracy-panels').replaceChildren();this.q('#study-report').replaceChildren();this.q('#mosaic').replaceChildren();this.q('#coverage').textContent=message;this.q('#activity-summary').textContent='';this.q('#run-detail').textContent='';this.q('#selected-path-title').textContent='Recent paths';this.q('#selected-path-note').textContent='';this.q('#boundary-note').textContent='';this.q('#clear-selection').hidden=true;
    for(const [id,chart]of this.charts)if(id.startsWith('pair-')){chart.destroy();this.charts.delete(id);}
  }
  compute(){clearTimeout(this.computeTimer);this.requestId++;this.q('#coverage').textContent='Updating participant-aware estimates…';this.computeTimer=setTimeout(()=>{
    const snapshot={rows:[...this.rows],people:[...this.people],room:this.room,source:this.source,receivedAt:this.receivedAt};
    this.pending={id:this.requestId,epoch:this.epoch,snapshot,options:{axis:this.axis,cutoff:this.cutoff,perturbation:this.q('#noise-filter').value}};this.startJob();
  },250);}
  startJob(){if(this.running||!this.pending)return;const job=this.pending;this.pending=null;this.running=true;this.job=job;
    if(!this.worker&&typeof Worker!=='undefined'){this.worker=new Worker(new URL('./study-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>this.finishJob(data);this.worker.onerror=e=>{this.worker?.terminate();this.worker=null;this.finishJob({id:this.job?.id,error:e.message||'Analysis worker failed'});};}
    // Trajectories are only needed by the main-thread inspector, not by the bootstrap worker.
    const rows=job.snapshot.rows.map(({path,...r})=>r);
    if(this.worker)this.worker.postMessage({id:job.id,rows,options:job.options});else setTimeout(()=>{try{this.finishJob({id:job.id,result:analyze(rows,job.options)});}catch(e){this.finishJob({id:job.id,error:e.message});}},0);
  }
  finishJob(data){const job=this.job;if(!job||data.id!==job.id)return;this.running=false;if(job.epoch===this.epoch&&job.options.axis===this.axis&&job.options.cutoff===this.cutoff&&job.options.perturbation===this.q('#noise-filter').value){if(data.error){this.q('#coverage').textContent='Analysis unavailable: '+data.error;toast(data.error,true);}else{this.cache=data.result;this.lastSnapshot=this.job.snapshot;this.repaint();}}this.startJob();}
  select(key){this.selected=key;this.repaint();}
  repaint(){clearTimeout(this.paintTimer);const id=++this.renderId;this.paintTimer=setTimeout(()=>this.render(id).catch(e=>{console.error(e);toast('Chart rendering failed: '+e.message,true);}),70);}
  async chart(id,spec,data,renderId){if(renderId!==this.renderId)return;let chart=this.charts.get(id);if(!chart){chart=new Chart(this.q('#'+id));this.charts.set(id,chart);}const signature=JSON.stringify(spec);
    if(chart.signature!==signature||!chart.result){chart.signature=signature;await chart.set(spec,data);if(renderId!==this.renderId)return;const view=chart.result?.view;view?.addEventListener('click',(_,item)=>{const datum=item?.datum;let key=datum?.dataset_id;if(!key&&datum?.participant_id){const recent=[...(this.lastSnapshot?.rows||[])].reverse().find(r=>!r.practice&&r.participant_id===datum.participant_id);if(recent)key=runKey(recent);}if(key)this.select(key);});view?.addEventListener('dblclick',()=>this.select(null));}
    else await chart.update(data);
  }
  async render(id){if(!this.cache||!this.lastSnapshot||id!==this.renderId)return;const a=this.cache,snap=this.lastSnapshot,rows=cleanRows(snap.rows).rows,noise=a.perturbation,scope=rows.filter(r=>noise==='all'||r.perturbation===noise),stage=this.q('#task-filter').value;
    const eligible=finiteRows(scope,a.cutoff===null?Infinity:a.cutoff),visible=eligible.filter(r=>stage==='all'||r.task===stage),focus=this.selected?visible.filter(r=>runKey(r)===this.selected):[];
    const basis=focus.length?focus:visible,max=(rs,k,min)=>Math.max(min,...rs.map(r=>r[k]).filter(Number.isFinite)),axis=a.axis;
    const step=axis==='distance'?100:axis==='approach_width'?20:1,xMax=Math.ceil(max(basis,axis,step)/step)*step,yMax=Math.ceil(max(basis,'acquisition_ms',250)*1.08/100)*100;
    const selectedFit=focus.length?regressionGroups(focus,axis,{replicates:0}).lines.map(r=>({...r,student_color:personColor(focus[0].participant_id)})):[];
    // Always retain every focused trial when deterministic sampling limits a large background.
    const background=visible.filter(r=>!this.selected||runKey(r)!==this.selected),stride=Math.max(1,background.length/5000),sample=background.filter((_,i)=>Math.floor(i/stride)!==Math.floor((i-1)/stride));
    const trials=[...sample,...(this.selected?focus:[])].map(r=>({...r,path:undefined,dataset_id:runKey(r),student_color:personColor(r.participant_id)}));
    const data={trials,bands:a.plot.bands,fit:a.plot.lines,selectedFit};const separate=this.q('#layout-filter').value==='separate'&&stage==='all';this.q('#class-chart').hidden=separate;this.q('#stage-charts').hidden=!separate;
    if(separate){for(const t of tasks){const w=Math.max(240,this.q('#stage-'+t).clientWidth);await this.chart('stage-'+t,acquisitionSpec({width:w,height:this.height,x:axis,xMax,yMax,selected:this.selected||'',stageFilter:t}),data,id);}}
    else await this.chart('class-chart',acquisitionSpec({width:Math.max(250,this.q('#class-chart').clientWidth),height:this.height,x:axis,xMax,yMax,selected:this.selected||'',stageFilter:stage==='all'?null:stage}),data,id);
    if(id!==this.renderId)return;
    const hidden=finiteRows(scope).filter(r=>stage==='all'||r.task===stage).length-visible.length;
    this.q('#coverage').textContent=`${visible.length} first attempts · ${new Set(visible.map(r=>r.participant_id)).size} participants${hidden?` · ${hidden} above cutoff`:''}${this.selected?focus.length?` · ${focus.length} selected-run trials`:' · selected run has no trials under these filters':''}${visible.length>5000?' · background dots sampled; calculations use all rows':''}${this.frozen?' · frozen':''}`;
    this.activity(rows,snap.people);
    const currentRun=this.selected||([...rows].reverse().find(r=>!r.practice)?runKey([...rows].reverse().find(r=>!r.practice)):null),recent=rows.filter(r=>!r.practice&&runKey(r)===currentRun&&r.path?.length>1).slice(-12);
    if(recent.length){const last=recent.at(-1);this.q('#selected-path-title').textContent=`${last.participant_label} · Run ${last.run_number??'?'} paths`;await this.chart('class-path',pathSpec(175),{paths:pathRows(recent)},id);this.q('#selected-path-note').textContent=`Latest ${recent.length} raw attempts · ${Math.round(last.acquisition_ms)} ms last · cutoff does not filter paths`;}else{this.charts.get('class-path')?.empty('No paths for the selected run.');this.q('#selected-path-note').textContent='';}
    await this.pairs(a.boundary.timing,'boundary-panels','time',id);
    if(this.q('.study-boundaries details').open)await this.pairs(a.boundary.accuracy,'accuracy-panels','accuracy',id);
    if(id!==this.renderId)return;
    this.q('#boundary-note').textContent=`${a.boundary.hidden} slow successful control attempts omitted from chart timings · ${a.boundary.unmatched} unpaired run/input/target groups · report includes the untrimmed comparison`;
    renderReport(this.q('#study-report'),a,{title:snap.room?.title,receivedAt:snap.receivedAt,frozen:this.frozen});
    if(this.q('#slopes-detail').open)await this.chart('slopes-chart',slopesSpec({width:this.q('#slopes-chart').clientWidth,height:Math.max(200,a.dataset.people*25)}),{people:a.people},id);
  }
  activity(rows,people){const runs=activityRuns(rows),root=this.q('#mosaic');this.q('#activity-summary').textContent=`${new Set(rows.map(r=>r.participant_id)).size} contributors / ${people.length||new Set(rows.map(r=>r.participant_id)).size} registered · ${runs.length} runs`;
    // Keep list scroll/focus stable during live updates and selection changes.
    for(const run of runs){let b=[...root.children].find(e=>e.dataset.run===run.id);if(!b){b=document.createElement('button');b.className='activity-run';b.dataset.run=run.id;b.onclick=()=>this.select(this.selected===run.id?null:run.id);b.append(document.createElement('strong'),document.createElement('span'));root.append(b);}b.style.setProperty('--student-color',personColor(run.participantId));b.classList.toggle('selected',this.selected===run.id);b.setAttribute('aria-pressed',String(this.selected===run.id));b.children[0].textContent=run.label;b.children[1].textContent=`□ ${run.stages.horizontal}  ○ ${run.stages.circles}  ◇ ${run.stages.interfaces}`;}
    for(const b of [...root.children])if(!runs.some(r=>r.id===b.dataset.run))b.remove();this.q('#clear-selection').hidden=!this.selected;const chosen=runs.find(r=>r.id===this.selected);this.q('#run-detail').textContent=chosen?`${chosen.first} first attempts · ${Math.round((chosen.errorRate||0)*100)}% misses · ${Math.round(chosen.median||0)} ms median (raw)`:'Select a run to inspect its data across all charts.';
  }
  async pairs(groups,parentId,metric,id){const parent=this.q('#'+parentId),keys=groups.map(g=>'pair-'+metric+'-'+Math.abs(this.hash(g.key)));
    for(const node of [...parent.children])if(!keys.includes(node.dataset.key)){this.charts.get(node.dataset.key)?.destroy();this.charts.delete(node.dataset.key);node.remove();}
    if(!groups.length){parent.textContent='No matched observations for these input settings yet.';return;}
    if(!parent.querySelector('article'))parent.replaceChildren();
    for(let i=0;i<groups.length;i++){const group=groups[i],key=keys[i];let card=[...parent.children].find(e=>e.dataset.key===key);if(!card){card=document.createElement('article');card.className='chart-card';card.dataset.key=key;card.innerHTML=`<div class="chart-title"><h3></h3><button class="code-link" data-code="${key}">&lt;/&gt;</button></div><p class="study-key"></p><p class="effect-headline"></p><div id="${key}" class="chart"></div><p class="study-key effect-help"></p>`;parent.append(card);}
      card.querySelector('h3').textContent=(group.pair==='menu'?'Menu':'Window')+(metric==='accuracy'?' · accuracy':'');card.querySelector('.study-key').textContent=group.settings;const s=group.summary,unit=metric==='time'?'ms':'points';card.querySelector('.effect-headline').textContent=`${Math.abs(s.mean).toFixed(1)} ${unit} ${metric==='time'?(s.mean>=0?'saved':'slower'):(s.mean>=0?'fewer misses':'more misses')} · ${s.n} participants / ${s.nRuns} pairs`;
      card.querySelector('.effect-help').textContent=(s.low===null?'Interval withheld: fewer than four participants.':`95% interval: ${s.low.toFixed(1)} to ${s.high.toFixed(1)} ${unit}.`)+(s.n<8?' Small sample.':'')+' Circle: participant mean · diamond: individual run / class mean.';
      const w=Math.max(370,card.querySelector('.chart').clientWidth);await this.chart(key,pairedSpec(group,{width:w,selected:this.selected||''}),pairedData(group),id);
    }
  }
  hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return h;}
  destroy(){this.clear();this.resize.disconnect();for(const chart of this.charts.values())chart.destroy();this.charts.clear();}
}
