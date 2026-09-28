import {clamp,nearFar,approachWidth} from './math.js';
export const ORIGIN={x:36,y:238};
export const INITIAL_GEOMETRY={x:330,y:130,width:140,height:90,topEdge:false,rightEdge:false};
const BOUNDS={left:90,right:570,top:48,bottom:282},MIN_W=84,MIN_H=44;
/** The finite model uses the same center chord as the experiment. */
export function geometryValues(state){
  const center={x:state.x+state.width/2,y:state.y+state.height/2};
  const dx=center.x-ORIGIN.x,dy=center.y-ORIGIN.y,d=Math.hypot(dx,dy),w=approachWidth(state.width,state.height,dx,dy);
  const unit={x:dx/d,y:dy/d},near=d-w/2,far=d+w/2;
  return{center,unit,near,far,distance:d,width:w,ratio:d/w,
    shannon:nearFar(near,far,'shannon'),fitts:nearFar(near,far,'fitts'),welford:nearFar(near,far,'welford')};
}
/** Translate or resize from a fixed opposite edge. Keep Start outside the target. */
export function changeGeometry(state,part,dx,dy=0){
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
/** Window edges remove overshoot only on their own axis; geometry stays finite. */
export function boundedPointer(state,point){
  return{x:state.rightEdge?Math.min(point.x,state.x+state.width):point.x,
    y:state.topEdge?Math.max(point.y,state.y):point.y};
}
export function initGeometryLab(){
  const $=id=>document.getElementById(id),svg=$('geometry-diagram');if(!svg)return;
  let state={...INITIAL_GEOMETRY},drag=null,pointer=null;
  const fmt=n=>Number.isFinite(n)?String(Math.round(n)):'∞';
  const attrs=(el,values)=>{for(const[k,v]of Object.entries(values))el.setAttribute(k,String(v));};
  const along=(v,t)=>({x:ORIGIN.x+v.unit.x*t,y:ORIGIN.y+v.unit.y*t});
  const line=(id,a,b)=>attrs($(id),{x1:a.x,y1:a.y,x2:b.x,y2:b.y});
  function render(){
    const v=geometryValues(state);
    const target=$('geometry-target');attrs(target,{x:state.x,y:state.y,width:state.width,height:state.height,'aria-label':`Move target. Position ${fmt(state.x)}, ${fmt(state.y)}; size ${fmt(state.width)} by ${fmt(state.height)}. Arrow keys move; Shift increases the step.`});
    const handles={left:[state.x,v.center.y,state.x,BOUNDS.left,state.x+state.width-MIN_W],right:[state.x+state.width,v.center.y,state.x+state.width,state.x+MIN_W,BOUNDS.right],top:[v.center.x,state.y,state.y,BOUNDS.top,state.y+state.height-MIN_H],bottom:[v.center.x,state.y+state.height,state.y+state.height,state.y+MIN_H,BOUNDS.bottom],corner:[state.x+state.width,state.y+state.height]};
    for(const[part,[x,y,value,min,max]]of Object.entries(handles)){
      const el=$('geometry-'+part+'-handle');attrs(el,{x:x-7,y:y-7,width:14,height:14});
      if(part==='corner')el.setAttribute('aria-label',`Resize width and height. ${fmt(state.width)} by ${fmt(state.height)}. Use arrow keys.`);
      else attrs(el,{'aria-valuenow':Math.round(value),'aria-valuemin':min,'aria-valuemax':max,'aria-valuetext':`${fmt(value)} illustration units`});
    }
    line('geometry-approach',ORIGIN,v.center);
    line('geometry-chord',along(v,v.near),along(v,v.far));
    attrs($('geometry-size'),{x:v.center.x,y:v.center.y-5});$('geometry-size').textContent=`${fmt(state.width)} × ${fmt(state.height)}`;
    attrs($('geometry-width-label'),{x:v.center.x,y:v.center.y+14});$('geometry-width-label').textContent=`W = ${fmt(v.width)}`;
    const distanceLabel=along(v,v.near/2);attrs($('geometry-distance-label'),{x:distanceLabel.x,y:distanceLabel.y-12});$('geometry-distance-label').textContent=`D = ${fmt(v.distance)}`;
    const right=state.x+state.width;
    attrs($('geometry-top-outside'),{x:0,y:0,width:600,height:state.y});
    attrs($('geometry-right-outside'),{x:right,y:state.topEdge?state.y:0,width:600-right,height:state.topEdge?320-state.y:320});
    $('geometry-top-outside').toggleAttribute('hidden',!state.topEdge);
    $('geometry-right-outside').toggleAttribute('hidden',!state.rightEdge);
    line('geometry-top-boundary',{x:0,y:state.y},{x:state.rightEdge?right:600,y:state.y});
    line('geometry-right-boundary',{x:right,y:state.topEdge?state.y:0},{x:right,y:320});
    for(const edge of ['top','right']){
      const active=state[edge+'Edge'],button=$('geometry-'+edge+'-edge');
      attrs(button,{'aria-pressed':active,transform:edge==='top'?`translate(${v.center.x} ${state.y-27})`:`translate(${right+18} ${v.center.y}) rotate(90)`});
      button.querySelector('text').textContent=`${edge==='top'?'Top':'Right'} edge: ${active?'on':'off'}`;
      $('geometry-'+edge+'-boundary').toggleAttribute('hidden',!active);
    }
    for(const[id,value]of [['d',v.distance],['w',v.width],['ratio',v.ratio]])$('geometry-'+id).textContent=id==='ratio'?value.toFixed(2):fmt(value);
    for(const[id,value]of [['fitts',v.fitts],['welford',v.welford],['id',v.shannon]])$('geometry-'+id).textContent=value.toFixed(3);
    $('geometry-observation').textContent=state.topEdge&&state.rightEdge?'Both edges form a corner. Moving beyond both bounds places the dot at the target’s corner. The values above still describe the free rectangle, not this bounded movement.':state.topEdge?'The top edge stops upward overshoot. You still need to align horizontally. The values above describe the free rectangle; they do not account for the edge.':state.rightEdge?'The right edge stops rightward overshoot. You still need to align vertically. The values above describe the free rectangle; they do not account for the edge.':'With both edges off, the dot can overshoot any side. Turn on a window edge and move past it to compare.';
    renderPointer();
  }
  function renderPointer(){
    const dot=$('geometry-pointer');dot.toggleAttribute('hidden',!pointer||!!drag);
    if(!pointer||drag)return;
    const p=boundedPointer(state,pointer);
    attrs(dot,{cx:p.x,cy:p.y});
    dot.classList.toggle('on-target',p.x>=state.x&&p.x<=state.x+state.width&&p.y>=state.y&&p.y<=state.y+state.height);
  }
  function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  function finish(cancel=false){if(!drag)return;const current=drag;drag=null;if(cancel)state=current.state;if(current.el.hasPointerCapture(current.id))current.el.releasePointerCapture(current.id);render();}
  for(const part of ['target','left','right','top','bottom','corner']){
    const el=$(part==='target'?'geometry-target':`geometry-${part}-handle`);
    el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.focus({preventScroll:true});drag={part,el,id:e.pointerId,point:point(e),state:{...state}};el.setPointerCapture(e.pointerId);renderPointer();});
    el.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const p=point(e);state=changeGeometry(drag.state,part,Math.round(p.x-drag.point.x),Math.round(p.y-drag.point.y));render();});
    el.addEventListener('pointerup',()=>finish());el.addEventListener('pointercancel',()=>finish(true));el.addEventListener('lostpointercapture',()=>finish(true));
    el.addEventListener('keydown',e=>{
      if(e.key==='Escape'){finish(true);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();const step=e.shiftKey?20:2;
      state=changeGeometry(state,part,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);render();
    });
  }
  for(const edge of ['top','right']){
    const button=$('geometry-'+edge+'-edge');
    const toggle=()=>{finish();state[edge+'Edge']=!state[edge+'Edge'];render();};
    button.addEventListener('click',toggle);
    button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  }
  svg.addEventListener('pointermove',e=>{pointer=point(e);renderPointer();});
  svg.addEventListener('pointerleave',()=>{pointer=null;renderPointer();});
  $('geometry-reset').addEventListener('click',()=>{finish();state={...INITIAL_GEOMETRY};render();});
  render();
}
