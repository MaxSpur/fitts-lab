import {clamp,nearFar} from './math.js';
const MAX=1_000_000;
export const INITIAL_GEOMETRY={near:240,width:120,unbounded:false};
export function geometryValues({near,width,unbounded=false}){
  const far=unbounded?Infinity:near+width;
  return{far,distance:unbounded?Infinity:near+width/2,width:unbounded?Infinity:width,ratio:unbounded?.5:(near+width/2)/width,
    shannon:nearFar(near,far,'shannon'),fitts:nearFar(near,far,'fitts'),welford:nearFar(near,far,'welford')};
}
/** Update one geometric degree of freedom while respecting an external start. */
export function changeGeometry(state,part,delta){
  if(part==='target')return{...state,near:clamp(state.near+delta,0,MAX)};
  if(part==='near'&&state.unbounded)return{...state,near:clamp(state.near+delta,0,MAX)};
  if(part==='near'){const far=state.near+state.width,near=clamp(state.near+delta,Math.max(0,far-MAX),Math.min(MAX,far-1));return{...state,near,width:state.unbounded?state.width:far-near};}
  return{...state,width:clamp(state.width+delta,1,MAX)};
}
export function initGeometryLab(){
  const $=id=>document.getElementById(id),svg=$('geometry-diagram');if(!svg)return;
  let state={...INITIAL_GEOMETRY},drag=null,range=600;
  const fmt=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString():'∞';
  function render(editing=null){
    const v=geometryValues(state);range=drag?.range||Math.max(600,Math.ceil((state.near+state.width)*1.12/100)*100);
    const x=n=>50+900*n/range,near=x(state.near),far=state.unbounded?945:x(v.far),centre=state.unbounded?945:x(v.distance),prefix=state.unbounded?'→ ':'';
    for(const key of ['near','width'])if(editing!==$('geometry-'+key))$('geometry-'+key).value=String(Math.round(state[key]));
    $('geometry-width').disabled=state.unbounded;$('geometry-unbounded').checked=state.unbounded;
    const target=$('geometry-target');target.setAttribute('x',near);target.setAttribute('width',Math.max(1,far-near));target.classList.toggle('unbounded',state.unbounded);
    for(const [part,value]of [['near',state.near],['far',state.near+state.width]]){
      const handle=$(`geometry-${part}-handle`),px=part==='near'?near:far;
      handle.setAttribute('transform',`translate(${px},0)`);handle.querySelector('rect').setAttribute('x',-12);handle.querySelector('path').setAttribute('d','M0 67V163 M-5 79H5 M-5 151H5');
      handle.setAttribute('aria-valuemin',part==='near'?'0':String(Math.round(state.near+1)));handle.setAttribute('aria-valuemax',String(part==='near'?(state.unbounded?MAX:Math.min(MAX,state.near+state.width-1)):state.near+MAX));handle.setAttribute('aria-valuenow',String(Math.round(value)));handle.setAttribute('aria-valuetext',`${fmt(value)} illustration units`);
      handle.toggleAttribute('hidden',state.unbounded&&part==='far');
    }
    target.setAttribute('aria-valuemin','0');target.setAttribute('aria-valuemax',String(MAX));target.setAttribute('aria-valuenow',String(Math.round(state.near)));target.setAttribute('aria-valuetext',`Near edge ${fmt(state.near)}, width ${state.unbounded?'unbounded':fmt(state.width)}`);
    $('geometry-target-label').setAttribute('x',(near+far)/2);$('geometry-target-label').textContent=far-near>75?'Target':'';
    const centreLine=$('geometry-centre');centreLine.toggleAttribute('hidden',state.unbounded);centreLine.setAttribute('x1',centre);centreLine.setAttribute('x2',centre);
    $('geometry-width-line').setAttribute('d',`M${near} 63V52H${far}V63`);$('geometry-width-label').setAttribute('x',(near+far)/2);$('geometry-width-label').textContent=`W ${state.unbounded?'→ ∞':'= '+fmt(v.width)}`;
    $('geometry-distance-line').setAttribute('d',state.unbounded?'':`M50 183V192H${centre}V183`);$('geometry-distance-label').setAttribute('x',state.unbounded?500:(50+centre)/2);$('geometry-distance-label').textContent=state.unbounded?'Centre recedes as the far edge extends':`D = ${fmt(v.distance)}`;
    $('geometry-infinity').toggleAttribute('hidden',!state.unbounded);
    const ticks=$('geometry-ticks');ticks.replaceChildren();
    for(let i=0;i<=4;i++){const text=document.createElementNS(svg.namespaceURI,'text');text.setAttribute('x',50+i*225);text.setAttribute('y',246);text.setAttribute('text-anchor','middle');text.textContent=fmt(i*range/4);ticks.append(text);}
    $('geometry-scale').textContent=`Illustration units · view 0–${fmt(range)} · scale fits automatically after a drag. Numbers remain exact.`;
    $('geometry-d').textContent=prefix+fmt(v.distance);$('geometry-w').textContent=prefix+fmt(v.width);$('geometry-ratio').textContent=prefix+v.ratio.toFixed(3);$('geometry-id').textContent=prefix+v.shannon.toFixed(3)+' bits';
    for(const name of ['shannon','fitts','welford'])$('geometry-'+name).textContent=prefix+v[name].toFixed(3)+' bits';
    $('geometry-observation').textContent=state.unbounded?`Near edge n = ${fmt(state.near)} stays fixed. Both D and W grow without bound, while D/W approaches ½. The limiting index describes the formula, not zero travel time.`:`The target runs from n = ${fmt(state.near)} to f = ${fmt(v.far)}. Its centre is ${fmt(v.distance)} units from the start. Move it farther, widen it, or scale both to see what changes.`;
  }
  function point(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse()).x;}
  function finish(cancel=false){if(!drag)return;const current=drag;drag=null;if(cancel)state=current.state;if(current.el.hasPointerCapture(current.id))current.el.releasePointerCapture(current.id);render();}
  for(const [part,el]of [['target',$('geometry-target')],['near',$('geometry-near-handle')],['far',$('geometry-far-handle')]]){
    el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.focus();drag={part,el,id:e.pointerId,x:point(e),state:{...state},range};el.setPointerCapture(e.pointerId);});
    el.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;state=changeGeometry(drag.state,part,Math.round((point(e)-drag.x)*drag.range/900));render();});
    el.addEventListener('pointerup',()=>finish());el.addEventListener('pointercancel',()=>finish(true));
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){finish(true);return;}if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();state=changeGeometry(state,part,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?50:10));render();});
  }
  for(const [id,key]of [['geometry-near','near'],['geometry-width','width']]){
    const update=e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))state={...state,[key]:clamp(Math.round(n),key==='width'?1:0,MAX)};render(e.type==='input'?e.target:null);};
    $(id).addEventListener('input',update);$(id).addEventListener('change',update);
  }
  $('geometry-unbounded').addEventListener('change',e=>{const checked=e.target.checked;finish();state.unbounded=checked;render();});
  $('geometry-reset').addEventListener('click',()=>{finish();state={...INITIAL_GEOMETRY};render();});
  document.querySelectorAll('[data-geometry]').forEach(b=>b.addEventListener('click',()=>{
    finish();const d=state.near+state.width/2;state.unbounded=false;
    if(b.dataset.geometry==='farther')state.near=clamp(2*d-state.width/2,0,MAX);
    if(b.dataset.geometry==='wider'){state.width=Math.min(2*state.width,2*d,MAX);state.near=d-state.width/2;}
    if(b.dataset.geometry==='scale'){const factor=Math.min(2,MAX/Math.max(1,state.near,state.width));state.near*=factor;state.width*=factor;}
    render();
  }));
  render();
}
