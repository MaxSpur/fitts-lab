import {seeded,shannon,approachWidth} from './math.js';
import {VERSION,protocol,targetFor,homeFor,BUTTON_SETS,isBoundary} from './protocol.js';

/** Explicitly synthetic projector preview. It follows the guided set geometry and never reaches the API. */
export function simulationRows(nPeople=24,seed=28){
  const rand=seeded(seed),rows=[];
  for(let i=0;i<nPeople;i++){
    const pid='simulation-'+i,a=100+rand()*180,b=70+rand()*90;
    for(const task of ['horizontal','circles','interfaces'])for(const p of protocol(task,pid))for(let j=0;j<p.count;j++){
      const t=targetFor(p,j+1),h=homeFor(p,j),dx=t.x-h.x,dy=t.y-h.y,d=Math.hypot(dx,dy);
      const w=t.shape==='circle'?t.w:approachWidth(t.w,t.h,dx,dy),edge=isBoundary(p),id=edge?null:shannon(d,w);
      const mt=Math.max(120,a+b*(id??2)+(rand()-.5)*180),hit=rand()>.055;
      const clickX=t.x+(hit?(rand()-.5)*t.w*.6:t.w*.65),clickY=t.y+(rand()-.5)*t.h*.6;
      const condition=task==='horizontal'?`horizontal-${Math.round(d)}-${p.width}`:
        task==='interfaces'&&!BUTTON_SETS.includes(p.variant)?`${p.variant}-${j%2?'between':'control'}`:p.condition;
      rows.push({schema_version:1,app_version:VERSION,id:crypto.randomUUID(),participant_id:pid,
        participant_label:'DEMO '+String(i+1).padStart(2,'0'),source:'simulation',task,variant:p.variant,condition,
        set_id:`${pid}-${task}-${p.variant}-${p.block??p.width??''}`,movement_id:crypto.randomUUID(),target_index:j,attempt:1,
        practice:false,perturbation:'normal',gain:1,hit,distance:d,nominal_distance:d,target_w:t.w,target_h:t.h,
        approach_width:w,index_difficulty:id,acquisition_ms:mt,completion_ms:hit?mt:null,
        start_x:h.x,start_y:h.y,target_x:t.x,target_y:t.y,click_x:clickX,click_y:clickY,
        input_mode:task==='interfaces'&&!BUTTON_SETS.includes(p.variant)?'virtual':'native',device:i%3?'mouse':'trackpad',
        viewport_width:960,dpr:1,created_at:new Date().toISOString(),
        path:Array.from({length:24},(_,k)=>{const u=k/23;return{x:h.x+(clickX-h.x)*u,y:h.y+(clickY-h.y)*u,t:mt*u};})});
    }
  }
  return rows.sort(()=>rand()-.5);
}
