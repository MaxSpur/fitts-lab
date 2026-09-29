/** Participant-aware descriptive analysis. No DOM, network, storage, or trial mutation.
 * Methods and estimands: docs/ANALYSIS.md. All durations are cue-to-press times.
 */
export const ANALYSIS_VERSION = '2.0.0';
export const REPLICATES = 2000;
export const MIN_CI_PEOPLE = 4; // A display guard, not a guarantee of adequate sample size.
export const tasks = ['horizontal', 'circles', 'interfaces'];
export const taskLabels = {horizontal:'Horizontal', circles:'Circles', interfaces:'Interfaces'};
export const runKey = r => `${r.participant_id}:${r.run_id || 'legacy'}`;
export const runLabel = r => `${r.participant_label || 'Participant'} · ${r.run_id ? 'Run ' + (r.run_number ?? '?') : 'Earlier results'}`;
export const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
export const hash = s => {let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export const random = seed => () => {seed+=0x6D2B79F5;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
export function quantile(a,p){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),q=(b.length-1)*p,i=Math.floor(q);return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*(q-i);}
export function groupBy(rows,key){const m=new Map();for(const r of rows){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}
export function cleanRows(rows){const map=new Map();let invalid=0;for(const r of rows){if(!r||typeof r.id!=='string'||typeof r.participant_id!=='string'||!tasks.includes(r.task)||!Number.isFinite(r.acquisition_ms)||r.acquisition_ms<0||typeof r.hit!=='boolean'||!Number.isInteger(r.attempt)||r.attempt<1){invalid++;continue;}map.set(`${r.participant_id}:${r.id}`,r);}return {rows:[...map.values()],invalid,duplicates:rows.length-map.size-invalid};}
export const firstRows = rows => rows.filter(r=>r.attempt===1&&!r.practice);
export const inputKey = r => JSON.stringify([r.app_version,r.input_mode,r.device,r.gain,r.perturbation,r.jitter_css_px||0]);
export const fitKey = r => JSON.stringify([r.task,inputKey(r)]);
export const inputLabel = r => `${r.input_mode||'unknown'} · ${r.device||'unspecified'} · ${r.gain??1}× · ${r.perturbation||'unknown'}${r.jitter_css_px?' '+r.jitter_css_px+' px':''} · v${r.app_version||'?'}`;
export function finiteRows(rows,cutoff=Infinity){return firstRows(rows).filter(r=>Number.isFinite(r.index_difficulty)&&r.index_difficulty>=0&&!/-edge$/.test(r.variant)&&r.acquisition_ms<=cutoff);}
const sums = (rows,x,log=false) => {
  const n=rows.length, a=[1,0,0,0,0,0];
  for(const r of rows){const u=r[x],v=log?Math.log(r.acquisition_ms):r.acquisition_ms;a[1]+=u/n;a[2]+=v/n;a[3]+=u*u/n;a[4]+=u*v/n;a[5]+=v*v/n;}return a;
};
const addSums = arrays => arrays.reduce((a,b)=>a.map((v,i)=>v+b[i]),[0,0,0,0,0,0]);
function fitSums(s){const [n,sx,sy,sxx,sxy,syy]=s,xx=sxx-sx*sx/n,xy=sxy-sx*sy/n,yy=syy-sy*sy/n;if(!(n>0)||xx<1e-9)return null;const b=xy/xx,a=sy/n-b*sx/n;return {a,b,r2:yy>1e-9?Math.max(0,Math.min(1,xy*xy/(xx*yy))):null};}
function supportsFit(a,x){if(a.length<8)return false;const xs=a.map(r=>r[x]),span=Math.max(...xs)-Math.min(...xs);if(span<(x==='distance'?40:x==='approach_width'?8:.5))return false;
  if(x==='distance'&&new Set(a.map(r=>Math.round((r.nominal_distance??r.distance)/10))).size<2)return false;
  if(x==='approach_width'&&a.every(r=>r.task!=='interfaces')&&new Set(a.map(r=>Math.round(r.target_w))).size<2)return false;
  if(!a.every(r=>/^buttons-/.test(r.variant))){const conditions=groupBy(a,r=>r.condition);if([...conditions.values()].filter(rs=>rs.length>=2).length<2)return false;}
  return true;
}
/** Equal total weight per participant; bootstrap whole participant clusters, retaining runs/clicks. */
export function regressionGroups(rows,x='index_difficulty',{replicates=REPLICATES,log=false}={}){
  if(!['index_difficulty','distance','approach_width'].includes(x))throw new Error('Unsupported analysis axis');
  const usable=rows.filter(r=>r.hit&&Number.isFinite(r[x])&&(!log||r.acquisition_ms>0));
  const fits=[],lines=[],bands=[];
  for(const [key,a] of [...groupBy(usable,fitKey)].sort(([a],[b])=>a.localeCompare(b))){
    if(!supportsFit(a,x))continue;
    const clusters=[...groupBy(a,r=>r.participant_id)].sort(([a],[b])=>a.localeCompare(b)).map(([,rs])=>sums(rs,x,log));
    const fit=fitSums(addSums(clusters));if(!fit)continue;
    const lo=Math.min(...a.map(r=>r[x])),hi=Math.max(...a.map(r=>r[x])),nPeople=clusters.length;
    const draws=[],rng=random(hash(key+'|'+x+'|'+log));
    if(nPeople>=MIN_CI_PEOPLE)for(let i=0;i<replicates;i++){
      const s=[0,0,0,0,0,0];for(let j=0;j<nPeople;j++){const c=clusters[Math.floor(rng()*nPeople)];for(let k=0;k<6;k++)s[k]+=c[k];}const f=fitSums(s);if(f)draws.push(f);
    }
    const enough=replicates>0&&draws.length>=replicates*.9&&nPeople>=MIN_CI_PEOPLE;
    const result={...fit,key,task:a[0].task,settings:inputLabel(a[0]),nPeople,nRuns:new Set(a.map(runKey)).size,nTrials:a.length,lo,hi,log,
      aLow:enough?quantile(draws.map(f=>f.a),.025):null,aHigh:enough?quantile(draws.map(f=>f.a),.975):null,
      bLow:enough?quantile(draws.map(f=>f.b),.025):null,bHigh:enough?quantile(draws.map(f=>f.b),.975):null,
      replicates:draws.length,ci:enough,warning:nPeople<MIN_CI_PEOPLE?'Too few participants for an interval':nPeople<8?'Small participant sample':''};
    fits.push(result);
    for(let j=0;j<=40;j++){const at=lo+(hi-lo)*j/40,pred=fit.a+fit.b*at;
      lines.push({key,task:result.task,settings:result.settings,[x]:at,acquisition_ms:pred,nPeople,nTrials:a.length,r2:fit.r2});
      if(enough){const ys=draws.map(f=>f.a+f.b*at);bands.push({key,task:result.task,[x]:at,low:quantile(ys,.025),high:quantile(ys,.975),nPeople});}
    }
  }
  return {fits,lines,bands};
}
export function bootstrapMean(values,seed=1,replicates=REPLICATES){const a=values.filter(Number.isFinite),n=a.length,m=avg(a);if(n<MIN_CI_PEOPLE||!replicates)return {mean:m,low:null,high:null,n};const rng=random(seed),draws=[];for(let b=0;b<replicates;b++){let s=0;for(let j=0;j<n;j++)s+=a[Math.floor(rng()*n)];draws.push(s/n);}return{mean:m,low:quantile(draws,.025),high:quantile(draws,.975),n};}
/** Pair only control approaches, within run AND all recorded input/protocol settings.
 * A usable timing pair has >=1 retained successful first attempt per side; it need not be a completed protocol.
 */
export function boundaryAnalysis(rows,cutoff=Infinity,{replicates=REPLICATES}={}){
  const controls=firstRows(rows).filter(r=>r.task==='interfaces'&&/^(menu|corner)-(floating|edge)$/.test(r.variant)&&r.condition===r.variant+'-control');
  const comparisons=groupBy(controls,r=>JSON.stringify([runKey(r),r.variant.split('-')[0],inputKey(r)]));
  const timing=[],accuracy=[];let unmatched=0,hidden=0;
  for(const [comparison,a]of comparisons){
    const free=a.filter(r=>r.variant.endsWith('-floating')),edge=a.filter(r=>r.variant.endsWith('-edge'));
    hidden+=a.filter(r=>r.hit&&r.acquisition_ms>cutoff).length;
    if(!free.length||!edge.length){unmatched++;continue;}
    const base={comparison,key:JSON.stringify([a[0].variant.split('-')[0],inputKey(a[0])]),pair:a[0].variant.split('-')[0],settings:inputLabel(a[0]),dataset_id:runKey(a[0]),dataset_label:runLabel(a[0]),participant_id:a[0].participant_id,participant_label:a[0].participant_label||'Participant'};
    const fe=100*free.filter(r=>!r.hit).length/free.length,ee=100*edge.filter(r=>!r.hit).length/edge.length;
    accuracy.push({...base,free:fe,edge:ee,saved:fe-ee,nFree:free.length,nEdge:edge.length,metric:'accuracy'});
    const fh=free.filter(r=>r.hit&&r.acquisition_ms<=cutoff),eh=edge.filter(r=>r.hit&&r.acquisition_ms<=cutoff);
    if(fh.length&&eh.length){const fm=avg(fh.map(r=>r.acquisition_ms)),em=avg(eh.map(r=>r.acquisition_ms));timing.push({...base,free:fm,edge:em,saved:fm-em,nFree:fh.length,nEdge:eh.length,metric:'time'});}
  }
  const summarize = (pairs,metric) => [...groupBy(pairs,r=>r.key)].map(([key,runs])=>{
    // Average repeated run pairs within each participant first. Repeaters have one vote.
    const people=[...groupBy(runs,r=>r.participant_id)].map(([id,a])=>{const f=avg(a.map(r=>r.free)),e=avg(a.map(r=>r.edge));return{participant_id:id,participant_label:a[0].participant_label,free:f,edge:e,saved:f-e,percent:metric==='time'&&f>0?100*(f-e)/f:null,nRuns:a.length};}).sort((a,b)=>a.saved-b.saved||a.participant_id.localeCompare(b.participant_id));
    const ci=bootstrapMean(people.map(r=>r.saved),hash(key+metric),replicates);
    return{key,pair:runs[0].pair,settings:runs[0].settings,metric,runs,people,summary:{...ci,free:avg(people.map(r=>r.free)),edge:avg(people.map(r=>r.edge)),percent:metric==='time'?avg(people.map(r=>r.percent)):null,nRuns:runs.length}};
  });
  return{timing:summarize(timing,'time'),accuracy:summarize(accuracy,'accuracy'),unmatched,hidden,nControls:controls.length};
}
export function perPersonFits(rows){return [...groupBy(rows,r=>r.participant_id)].flatMap(([id,a])=>regressionGroups(a,'index_difficulty',{replicates:0}).fits.map(f=>({...f,participant_id:id,participant_label:a[0].participant_label||'Participant'})));}
export function analyze(rows,{cutoff=Infinity,perturbation='normal',axis='index_difficulty',replicates=REPLICATES}={}){
  const clean=cleanRows(rows),scope=clean.rows.filter(r=>perturbation==='all'||r.perturbation===perturbation),first=firstRows(scope),all=finiteRows(scope),current=finiteRows(scope,cutoff);
  const reference=regressionGroups(all,'index_difficulty',{replicates}),filtered=cutoff===Infinity?reference:regressionGroups(current,'index_difficulty',{replicates});
  return{version:ANALYSIS_VERSION,cutoff:Number.isFinite(cutoff)?cutoff:null,perturbation,axis,replicates,
    dataset:{attempts:clean.rows.length,first:first.length,success:first.filter(r=>r.hit).length,misses:first.filter(r=>!r.hit).length,people:new Set(first.map(r=>r.participant_id)).size,runs:new Set(first.map(runKey)).size,invalid:clean.invalid,duplicates:clean.duplicates,hidden:all.length-current.length,referenceTrials:all.length,filteredTrials:current.length,protocols:[...new Set(scope.map(r=>r.app_version))]},
    plot:axis==='index_difficulty'?filtered:regressionGroups(current,axis,{replicates}),reference,filtered,
    logSensitivity:regressionGroups(all,'index_difficulty',{replicates:0,log:true}),people:perPersonFits(all),
    boundary:boundaryAnalysis(scope,cutoff,{replicates}),boundaryReference:boundaryAnalysis(scope,Infinity,{replicates})};
}
