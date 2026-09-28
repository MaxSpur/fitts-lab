import {clamp,nearFar,approachWidth} from './math.js';
export const ORIGIN={x:36,y:238};
export const INITIAL_GEOMETRY={x:330,y:130,width:140,height:90,unbounded:false};
const BOUNDS={left:90,right:570,top:24,bottom:282},MIN_W=84,MIN_H=44;
/** The finite model uses the same center chord as the experiment. */
export function geometryValues(state){
  const center={x:state.x+state.width/2,y:state.y+state.height/2};
  const dx=center.x-ORIGIN.x,dy=center.y-ORIGIN.y,d=Math.hypot(dx,dy),w=approachWidth(state.width,state.height,dx,dy);
  const unit={x:dx/d,y:dy/d},near=d-w/2,far=state.unbounded?Infinity:d+w/2;
  return{center,unit,near,far,distance:state.unbounded?Infinity:d,width:state.unbounded?Infinity:w,ratio:state.unbounded?.5:d/w,
    shannon:nearFar(near,far,'shannon'),fitts:nearFar(near,far,'fitts'),welford:nearFar(near,far,'welford')};
}
/** Translate or resize from a fixed opposite edge. Keep Start outside the target. */
export function changeGeometry(state,part,dx,dy=0){
  if(state.unbounded)return{...state};
  const next={...state},right=state.x+state.width,bottom=state.y+state.height;
  if(part==='target'){
    next.x=clamp(state.x+dx,BOUNDS.left,BOUNDS.right-state.width);
    next.y=clamp(state.y+dy,BOUNDS.top,BOUNDS.bottom-state.height);
  }
  if(part==='left'){next.x=clamp(state.x+dx,BOUNDS.left,right-MIN_W);next.width=right-next.x;}
  if(part==='top'){next.y=clamp(state.y+dy,BOUNDS.top,bottom-MIN_H);next.height=bottom-next.y;}
  if(part==='right'||part==='corner')next.width=clamp(state.width+dx,MIN_W,BOUNDS.right-state.x);
  if(part==='bottom'||part==='corner')next.height=clamp(state.height+dy,MIN_H,BOUNDS.bottom-state.y);
  return next;
}
export function initGeometryLab(){
  const $=id=>document.getElementById(id),svg=$('geometry-diagram');if(!svg)return;
  let state={...INITIAL_GEOMETRY},drag=null;
  const fmt=n=>Number.isFinite(n)?String(Math.round(n)):'∞';
  const attrs=(el,values)=>{for(const[k,v]of Object.entries(values))el.setAttribute(k,String(v));};
  const along=(v,t)=>({x:ORIGIN.x+v.unit.x*t,y:ORIGIN.y+v.unit.y*t});
  const line=(id,a,b)=>attrs($(id),{x1:a.x,y1:a.y,x2:b.x,y2:b.y});
  function render(){
    const v=geometryValues(state),finite=geometryValues({...state,unbounded:false}),prefix=state.unbounded?'→ ':'';
    const target=$('geometry-target');attrs(target,{x:state.x,y:state.y,width:state.width,height:state.height,'aria-label':`Move target. Position ${fmt(state.x)}, ${fmt(state.y)}; size ${fmt(state.width)} by ${fmt(state.height)}. Arrow keys move; Shift increases the step.`});
    target.toggleAttribute('hidden',state.unbounded);$('geometry-handles').toggleAttribute('hidden',state.unbounded);
    const handles={left:[state.x,v.center.y,state.x,BOUNDS.left,state.x+state.width-MIN_W],right:[state.x+state.width,v.center.y,state.x+state.width,state.x+MIN_W,BOUNDS.right],top:[v.center.x,state.y,state.y,BOUNDS.top,state.y+state.height-MIN_H],bottom:[v.center.x,state.y+state.height,state.y+state.height,state.y+MIN_H,BOUNDS.bottom],corner:[state.x+state.width,state.y+state.height]};
    for(const[part,[x,y,value,min,max]]of Object.entries(handles)){
      const el=$('geometry-'+part+'-handle');attrs(el,{x:x-7,y:y-7,width:14,height:14});
      if(part==='corner')el.setAttribute('aria-label',`Resize width and height. ${fmt(state.width)} by ${fmt(state.height)}. Use arrow keys.`);
      else attrs(el,{'aria-valuenow':Math.round(value),'aria-valuemin':min,'aria-valuemax':max,'aria-valuetext':`${fmt(value)} illustration units`});
    }
    let label=v.center;
    line('geometry-approach',ORIGIN,v.center);
    line('geometry-chord',along(finite,finite.near),along(finite,finite.far));
    $('geometry-chord').toggleAttribute('hidden',state.unbounded);
    $('geometry-extension').toggleAttribute('hidden',!state.unbounded);
    if(state.unbounded){
      const end=Math.min((588-ORIGIN.x)/v.unit.x,v.unit.y<0?(12-ORIGIN.y)/v.unit.y:v.unit.y>0?(308-ORIGIN.y)/v.unit.y:Infinity);
      const a=along(v,v.near),b=along(v,end),normal={x:-v.unit.y*23,y:v.unit.x*23};
      const points=[[a.x+normal.x,a.y+normal.y],[b.x+normal.x,b.y+normal.y],[b.x-normal.x,b.y-normal.y],[a.x-normal.x,a.y-normal.y]];
      $('geometry-extension').setAttribute('points',points.map(p=>p.join(',')).join(' '));
      line('geometry-approach',ORIGIN,b);label=along(v,(v.near+end)/2);
    }
    attrs($('geometry-size'),{x:label.x,y:label.y-5});$('geometry-size').textContent=state.unbounded?'W∥ → ∞':`${fmt(state.width)} × ${fmt(state.height)}`;
    attrs($('geometry-width-label'),{x:label.x,y:label.y+13});$('geometry-width-label').textContent=state.unbounded?'→':`W∥ ${fmt(v.width)}`;
    const distanceLabel=along(finite,finite.near/2);attrs($('geometry-distance-label'),{x:distanceLabel.x,y:distanceLabel.y-12});$('geometry-distance-label').textContent=state.unbounded?`n = ${fmt(v.near)}`:`D = ${fmt(v.distance)}`;
    $('geometry-unbounded').checked=state.unbounded;
    for(const[id,value]of [['d',v.distance],['w',v.width],['ratio',v.ratio]])$('geometry-'+id).textContent=prefix+(id==='ratio'?value.toFixed(2):fmt(value));
    for(const[id,value]of [['fitts',v.fitts],['welford',v.welford],['id',v.shannon]])$('geometry-'+id).textContent=prefix+value.toFixed(3);
    $('geometry-observation').textContent=state.unbounded?`The near intersection stays at n = ${fmt(v.near)}. As the far intersection recedes, D and W∥ both grow and D/W∥ → ½. Fitts and Welford approach 0 bits; Shannon approaches 0.585 bits.`:'Extend the target along this line to compare the limits. The near intersection stays fixed while the far intersection recedes. The finite rectangle is restored when you turn the option off.';
  }
  function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  function finish(cancel=false){if(!drag)return;const current=drag;drag=null;if(cancel)state=current.state;if(current.el.hasPointerCapture(current.id))current.el.releasePointerCapture(current.id);render();}
  for(const part of ['target','left','right','top','bottom','corner']){
    const el=$(part==='target'?'geometry-target':`geometry-${part}-handle`);
    el.addEventListener('pointerdown',e=>{if(e.button!==0||state.unbounded)return;e.preventDefault();el.focus({preventScroll:true});drag={part,el,id:e.pointerId,point:point(e),state:{...state}};el.setPointerCapture(e.pointerId);});
    el.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const p=point(e);state=changeGeometry(drag.state,part,Math.round(p.x-drag.point.x),Math.round(p.y-drag.point.y));render();});
    el.addEventListener('pointerup',()=>finish());el.addEventListener('pointercancel',()=>finish(true));el.addEventListener('lostpointercapture',()=>finish(true));
    el.addEventListener('keydown',e=>{
      if(e.key==='Escape'){finish(true);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();const step=e.shiftKey?20:2;
      state=changeGeometry(state,part,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);render();
    });
  }
  $('geometry-unbounded').addEventListener('change',e=>{const checked=e.target.checked;finish();state.unbounded=checked;render();});
  $('geometry-reset').addEventListener('click',()=>{finish();state={...INITIAL_GEOMETRY};render();});
  render();
}
