import {firstAttempts,mean,regression,hash} from './math.js';
import {INTERFACE_ORDER,TASK_LABELS} from './protocol.js';
export function boundaryRows(rows,perturbation='normal'){
  const groups=new Map();for(const r of firstAttempts(rows,{task:'interfaces',perturbation})){
    if(!/^(menu|corner)-(floating|edge)$/.test(r.variant))continue;
    // The serial sequence includes travel back to ordinary buttons. Compare only approaches to controls.
    if(r.condition!==`${r.variant}-control`)continue;
    const key=[r.participant_id,r.app_version,r.variant,r.perturbation,r.gain,r.input_mode].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  return [...groups.values()].flatMap(a=>{const hits=a.filter(r=>r.hit);if(!hits.length)return[];const v=a[0].variant;
    const pair=v.startsWith('menu')?'menu':'corner';
    return [{...a[0],acquisition_ms:mean(hits.map(r=>r.acquisition_ms)),error_rate:1-hits.length/a.length,n:a.length,
      pair,summary_key:[a[0].app_version,pair,a[0].gain,a[0].input_mode,a[0].perturbation].join('|'),comparison_key:[a[0].participant_id,a[0].app_version,pair,a[0].gain,a[0].input_mode,a[0].perturbation].join('|'),
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
    if(hi-lo<(x==='distance'?40:.5))continue;
    // A fixed nominal distance must not acquire a trend from off-center clicks alone.
    if(x==='distance'&&new Set(a.map(r=>Math.round(r.nominal_distance/10))).size<2)continue;
    const varied=a.every(r=>/^buttons-/.test(r.variant));
    const conditions=new Map();for(const r of a)conditions.set(r.condition,(conditions.get(r.condition)||0)+1);
    if(!varied&&[...conditions.values()].filter(n=>n>=3).length<2)continue;
    const fit=regression(a,x,'acquisition_ms',2);if(!fit)continue;
    const label=`${a[0].input_mode} · ${a[0].device} · ${a[0].perturbation} · ${a[0].gain}× · ${a[0].app_version}`;
    fits.push({...fit,label,task:a[0].task,settings:[a[0].input_mode,a[0].device,a[0].perturbation,`${a[0].gain}×`,a[0].app_version,`${a[0].jitter_css_px||0}px jitter`]});
    for(const value of [lo,hi])lines.push({series,label,task:a[0].task,[x]:value,distance:x==='distance'?value:0,index_difficulty:x==='index_difficulty'?value:0,acquisition_ms:fit.a+fit.b*value,n:fit.n,r2:fit.r2,a:fit.a,b:fit.b});
  }
  return{lines,fits};
}
export function trendCaption(trend,x='index_difficulty'){
  if(!trend.fits.length)return 'Trend appears after 8 successful first attempts with sufficient variation; fixed-distance runs have no distance trend.';
  const differing=trend.fits[0].settings.map((_,i)=>new Set(trend.fits.map(f=>f.settings[i])).size>1);
  return trend.fits.map(f=>`${TASK_LABELS[f.task]}${f.settings.filter((_,i)=>differing[i]).map(s=>' · '+s).join('')}: T = ${f.a.toFixed(0)} ${f.b<0?'−':'+'} ${Math.abs(f.b).toFixed(1)} × ${x==='distance'?'D':'ID'} ms · R² = ${f.r2.toFixed(2)} · n = ${f.n}`).join(' | ')+' · descriptive fit to successful first attempts';
}
/** Deterministic display sample; calculations always use the complete filtered dataset. */
export function displaySample(rows,limit=5000){if(rows.length<=limit)return rows;const stride=rows.length/limit;return Array.from({length:limit},(_,i)=>rows[Math.floor(i*stride)]);}

export function studentColor(id){const hue=hash(id)%360;return `hsl(${hue},58%,40%)`;}
