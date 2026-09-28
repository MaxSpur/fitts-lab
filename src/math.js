/** Pure geometry/statistics. All exported distance values use CSS pixels. */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
export const median = a => { if (!a.length) return null; const b = [...a].sort((x,y)=>x-y); const k = b.length>>1; return b.length%2 ? b[k] : (b[k-1]+b[k])/2; };
export const round = (x, places = 3) => Math.round(x * 10 ** places) / 10 ** places;
export function shannon(d, w) { return d >= 0 && w > 0 ? Math.log2(1 + d / w) : null; }
export function nearFar(near, far, formulation = 'fitts') {
  if (!(near >= 0 && far > near)) return null;
  if (!Number.isFinite(far)) return formulation === 'shannon' ? Math.log2(1.5) : 0;
  const width = far-near, d = (far+near)/2;
  if (formulation === 'welford') return Math.log2(d/width + .5);
  if (formulation === 'shannon') return shannon(d,width);
  return Math.log2(2*d/width);
}
/** Center-directed chord, not projected bounding-box width or statistical effective width. */
export function approachWidth(w, h, dx, dy) {
  const d = Math.hypot(dx,dy);
  if (!(w>0 && h>0) || !d) return Math.min(w,h);
  return Math.min(Math.abs(dx) < 1e-9 ? Infinity : w*d/Math.abs(dx), Math.abs(dy) < 1e-9 ? Infinity : h*d/Math.abs(dy));
}
export function hitTarget(p, t) {
  return t.shape === 'circle' ? distance(p,t) <= t.w/2 : Math.abs(p.x-t.x) <= t.w/2 && Math.abs(p.y-t.y) <= t.h/2;
}
/** Discard overshoot on every movement update: reversal must respond immediately. */
export function constrainedMove(p, dx, dy, b) {
  return {x:clamp(p.x+dx,b.left,b.right),y:clamp(p.y+dy,b.top,b.bottom)};
}
export function seeded(seed=1) {
  let x=seed>>>0;
  return ()=>{ x+=0x6D2B79F5; let t=Math.imul(x^x>>>15,1|x); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; };
}
export function hash(s) { let h=2166136261; for (const c of String(s)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
export function shuffled(a, seed) { const b=[...a], r=seeded(seed); for(let i=b.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; }
export function jitterAt(ms, seed, amplitude) {
  const t=ms/1000, phase=(seed%1000)/100;
  return {x:amplitude*(Math.sin(7.3*t+phase)+.4*Math.sin(17.1*t+2*phase))/1.4,
    y:amplitude*(Math.sin(8.1*t+2*phase)+.4*Math.sin(19.3*t+phase))/1.4};
}
export function downsample(points, max=64) {
  if (points.length <= max) return points.map(p=>({...p}));
  return Array.from({length:max},(_,i)=>({...points[Math.round(i*(points.length-1)/(max-1))]}));
}
export function regression(rows, x='index_difficulty', y='acquisition_ms', minDistinct=3) {
  const pts=rows.filter(r=>Number.isFinite(r[x]) && Number.isFinite(r[y]));
  if (pts.length<3 || new Set(pts.map(r=>round(r[x],4))).size<minDistinct) return null;
  const mx=mean(pts.map(r=>r[x])),my=mean(pts.map(r=>r[y]));
  let xx=0,xy=0,yy=0; for(const p of pts){xx+=(p[x]-mx)**2; xy+=(p[x]-mx)*(p[y]-my); yy+=(p[y]-my)**2;}
  if (xx < 1e-10 || yy < 1e-10) return null;
  const b=xy/xx, a=my-b*mx;
  return {a,b,r2:clamp(xy*xy/(xx*yy),0,1),n:pts.length};
}
export function firstAttempts(rows,{task,perturbation='normal',hitsOnly=false}={}) {
  return rows.filter(r=>r.attempt===1 && !r.practice && (!task||r.task===task) && (perturbation==='all'||r.perturbation===perturbation) && (!hitsOnly||r.hit));
}
export function conditionMeans(rows) {
  const groups=new Map();
  for(const r of rows) { const k=[r.participant_id,r.run_id,r.task,r.app_version,r.condition,r.device,r.perturbation,r.jitter_css_px,r.gain,r.input_mode].join('|'); if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r); }
  return [...groups.values()].filter(a=>a.length>=3).map(a=>({...a[0],id:'mean-'+a[0].id,
    distance:mean(a.map(r=>r.distance)),approach_width:mean(a.map(r=>r.approach_width)),target_w:mean(a.map(r=>r.target_w)),target_h:mean(a.map(r=>r.target_h)),index_difficulty:mean(a.map(r=>r.index_difficulty).filter(Number.isFinite)),
    acquisition_ms:mean(a.map(r=>r.acquisition_ms)),n:a.length,kind:'Participant–condition mean'}));
}
export function endpointRows(rows) {
  return rows.map(r=>({id:r.id,x:2*(r.click_x-r.target_x)/r.target_w,y:2*(r.click_y-r.target_y)/r.target_h,
    outcome:r.hit?'Hit':'Miss',trial:r.target_index+1,acquisition_ms:r.acquisition_ms,attempt:r.attempt}));
}
export function pathRows(rows,maxTrials=12) {
  return rows.slice(-maxTrials).flatMap(r=>{
    const dx=r.target_x-r.start_x,dy=r.target_y-r.start_y,d=Math.hypot(dx,dy)||1;
    return (r.path||[]).map((p,i)=>({id:r.id,order:i,time:p.t,
      along:((p.x-r.start_x)*dx+(p.y-r.start_y)*dy)/(d*d),
      across:((p.x-r.start_x)*(-dy)+(p.y-r.start_y)*dx)/d,
      x:p.x,y:p.y,outcome:r.hit?'Hit':'Miss'}));
  });
}
export function speedRows(rows,maxTrials=6) {
  return rows.slice(-maxTrials).flatMap(r=>{
    const p=r.path||[], out=[];
    for(let i=2;i<p.length;i++) {const a=p[i-2],b=p[i],dt=b.t-a.t;if(dt>0)out.push({id:r.id,time:(b.t+a.t)/2,speed:1000*distance(a,b)/dt});}
    return out;
  });
}
