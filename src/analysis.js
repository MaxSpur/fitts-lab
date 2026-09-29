import {datasetKey,datasetLabel} from './runs.js';
import {firstAttempts,mean,regression,hash} from './math.js';
import {INTERFACE_ORDER,TASK_LABELS} from './protocol.js';

const T95=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
export function meanInterval(values){
  const a=values.filter(Number.isFinite),n=a.length,m=mean(a);if(!n)return{mean:null,low:null,high:null,n:0};
  if(n<2)return{mean:m,low:null,high:null,n};
  const variance=a.reduce((s,v)=>s+(v-m)**2,0)/(n-1),se=Math.sqrt(variance/n),t=n-1<T95.length?T95[n-1]:1.96;
  return{mean:m,low:m-t*se,high:m+t*se,n};
}
function runConditionMeans(rows){
  const groups=new Map();
  for(const r of rows){
    const key=[datasetKey(r),r.task,r.app_version,r.condition,r.device,r.perturbation,r.jitter_css_px,r.gain,r.input_mode].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  return [...groups.values()].map(a=>({...a[0],dataset_id:datasetKey(a[0]),acquisition_ms:mean(a.map(r=>r.acquisition_ms)),
    distance:mean(a.map(r=>r.distance).filter(Number.isFinite)),approach_width:mean(a.map(r=>r.approach_width).filter(Number.isFinite)),index_difficulty:mean(a.map(r=>r.index_difficulty).filter(Number.isFinite)),n_trials:a.length}));
}
/** Classroom uncertainty is across student-run condition means, so repeated clicks do not masquerade as independent people. */
export function conditionIntervals(rows,x='index_difficulty'){
  const runMeans=runConditionMeans(firstAttempts(rows,{perturbation:'all',hitsOnly:true})),groups=new Map();
  for(const r of runMeans){
    if(!Number.isFinite(r[x]))continue;
    const key=[r.task,r.app_version,r.condition,r.device,r.perturbation,r.jitter_css_px,r.gain,r.input_mode].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  return [...groups.values()].map(a=>{const ci=meanInterval(a.map(r=>r.acquisition_ms));return{...a[0],[x]:mean(a.map(r=>r[x])),acquisition_ms:ci.mean,ci_low:ci.low,ci_high:ci.high,n_runs:ci.n};});
}
/** Complete matched runs only: summarize free/edge means and paired bounded-minus-free effects with 95% t intervals. */
export function boundaryStatistics(boundaries){
  const comparisons=new Map();for(const r of boundaries){if(!comparisons.has(r.comparison_key))comparisons.set(r.comparison_key,[]);comparisons.get(r.comparison_key).push(r);}
  const complete=[...comparisons.values()].filter(a=>a.length===2&&a.some(r=>r.variant.endsWith('-floating'))&&a.some(r=>r.variant.endsWith('-edge')));
  const summaryGroups=new Map(),effects=[];
  for(const pairRows of complete){
    for(const r of pairRows){const key=r.summary_key+'|'+r.variant;if(!summaryGroups.has(key))summaryGroups.set(key,[]);summaryGroups.get(key).push(r);}
    const free=pairRows.find(r=>r.variant.endsWith('-floating')),edge=pairRows.find(r=>r.variant.endsWith('-edge'));
    effects.push({...edge,difference_ms:edge.acquisition_ms-free.acquisition_ms,effect_pair:edge.pair,order:edge.pair==='menu'?0:1});
  }
  const summaries=[...summaryGroups.values()].map(a=>{const ci=meanInterval(a.map(r=>r.acquisition_ms));return{...a[0],acquisition_ms:ci.mean,ci_low:ci.low,ci_high:ci.high,n_runs:ci.n};});
  const effectGroups=new Map();for(const r of effects){if(!effectGroups.has(r.summary_key))effectGroups.set(r.summary_key,[]);effectGroups.get(r.summary_key).push(r);}
  const effectSummary=[...effectGroups.values()].map(a=>{const ci=meanInterval(a.map(r=>r.difference_ms));return{...a[0],difference_ms:ci.mean,ci_low:ci.low,ci_high:ci.high,n_runs:ci.n};});
  return{summaries,effects,effectSummary};
}
export function boundaryRows(rows,perturbation='normal',maxAcquisitionMs=Infinity){
  const groups=new Map();for(const r of firstAttempts(rows,{task:'interfaces',perturbation})){
    if(!/^(menu|corner)-(floating|edge)$/.test(r.variant))continue;
    // The serial sequence includes travel back to ordinary buttons. Compare only approaches to controls.
    if(r.condition!==`${r.variant}-control`)continue;
    const key=[datasetKey(r),r.app_version,r.variant,r.perturbation,r.gain,r.input_mode].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  return [...groups.values()].flatMap(a=>{const hits=a.filter(r=>r.hit),timedHits=hits.filter(r=>!Number.isFinite(maxAcquisitionMs)||r.acquisition_ms<=maxAcquisitionMs);if(!timedHits.length)return[];const v=a[0].variant;
    const pair=v.startsWith('menu')?'menu':'corner';
    return [{...a[0],dataset_id:datasetKey(a[0]),dataset_label:datasetLabel(a[0]),acquisition_ms:mean(timedHits.map(r=>r.acquisition_ms)),error_rate:1-hits.length/a.length,n:a.length,timed_n:timedHits.length,excluded_time:hits.length-timedHits.length,
      pair,summary_key:[a[0].app_version,pair,a[0].gain,a[0].input_mode,a[0].perturbation].join('|'),comparison_key:[datasetKey(a[0]),a[0].app_version,pair,a[0].gain,a[0].input_mode,a[0].perturbation].join('|'),
      order:INTERFACE_ORDER.indexOf(v)}];});
}
/** Descriptive OLS on successful first attempts. Keep incompatible input settings apart. */
export function trendlines(rows,x='index_difficulty'){
  const groups=new Map(),lines=[],fits=[];
  for(const r of firstAttempts(rows,{perturbation:'all',hitsOnly:true})){
    if(!Number.isFinite(r[x])||!Number.isFinite(r.index_difficulty))continue;
    const key=[r.task,r.app_version,r.input_mode,r.device,r.gain,r.perturbation,r.jitter_css_px].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  for(const [series,a]of groups){
    if(a.length<8)continue;
    const xs=a.map(r=>r[x]),lo=Math.min(...xs),hi=Math.max(...xs);
    if(hi-lo<(x==='distance'?40:x==='approach_width'?8:.5))continue;
    // A fixed nominal distance must not acquire a trend from off-center clicks alone.
    if(x==='distance'&&new Set(a.map(r=>Math.round(r.nominal_distance/10))).size<2)continue;
    if(x==='approach_width'&&a.every(r=>['horizontal','circles'].includes(r.task))&&new Set(a.map(r=>Math.round(r.target_w))).size<2)continue;
    const varied=a.every(r=>/^buttons-/.test(r.variant));
    const conditions=new Map();for(const r of a)conditions.set(r.condition,(conditions.get(r.condition)||0)+1);
    if(!varied&&[...conditions.values()].filter(n=>n>=2).length<2)continue;
    const fit=regression(a,x,'acquisition_ms',2);if(!fit)continue;
    const label=`${a[0].input_mode} · ${a[0].device} · ${a[0].perturbation} · ${a[0].gain}× · ${a[0].app_version}`;
    fits.push({...fit,label,task:a[0].task,settings:[a[0].input_mode,a[0].device,a[0].perturbation,`${a[0].gain}×`,a[0].app_version,`${a[0].jitter_css_px||0}px jitter`]});
    for(const value of [lo,hi])lines.push({series,label,task:a[0].task,[x]:value,distance:x==='distance'?value:0,index_difficulty:x==='index_difficulty'?value:0,acquisition_ms:fit.a+fit.b*value,n:fit.n,r2:fit.r2,a:fit.a,b:fit.b});
  }
  return{lines,fits};
}
export function trendCaption(trend,x='index_difficulty'){
  if(!trend.fits.length)return 'Trend appears after 8 successful first attempts with sufficient variation; a single size or distance does not support a trend on that axis.';
  const differing=trend.fits[0].settings.map((_,i)=>new Set(trend.fits.map(f=>f.settings[i])).size>1);
  return trend.fits.map(f=>`${TASK_LABELS[f.task]}${f.settings.filter((_,i)=>differing[i]).map(s=>' · '+s).join('')}: T = ${f.a.toFixed(0)} ${f.b<0?'−':'+'} ${Math.abs(f.b).toFixed(1)} × ${x==='distance'?'D':x==='approach_width'?'W':'ID'} ms · R² = ${f.r2.toFixed(2)} · n = ${f.n}`).join(' | ')+' · descriptive fit to successful first attempts';
}
/** Deterministic display sample; calculations always use the complete filtered dataset. */
export function displaySample(rows,limit=5000){if(rows.length<=limit)return rows;const stride=rows.length/limit;return Array.from({length:limit},(_,i)=>rows[Math.floor(i*stride)]);}

export function studentColor(id){const hue=hash(id)%360;return `hsl(${hue},58%,40%)`;}

/** Shared labels and data-derived bounds for the three views of the same observations. */
export function plotAxis(rows,field='index_difficulty'){
  const config={
    distance:{step:100,caption:'Distance D · target-center distance (CSS px). Target size varies.'},
    approach_width:{step:20,caption:'Size W · width along approach (CSS px); diameter for circles. Distance varies.'},
    index_difficulty:{step:1,caption:'Index of difficulty · log₂(1 + D/W), in bits'}
  }[field];
  const maximum=Math.max(config.step,...rows.map(r=>Number.isFinite(r[field])?r[field]:0));
  return {maximum:Math.ceil(maximum/config.step)*config.step,caption:config.caption};
}
