/** Shared ingress validation. Explicit field selection prevents client-controlled identity fields. */
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(x,name='identifier'){if(typeof x!=='string'||!UUID.test(x))throw new Error(`Invalid ${name}.`);return x;}
export function number(x,min,max,name){if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error(`Invalid ${name}.`);return x;}
export function integer(x,min,max,name){number(x,min,max,name);if(!Number.isInteger(x))throw new Error(`Invalid ${name}.`);return x;}
export function choice(x,choices,name){if(!choices.includes(x))throw new Error(`Invalid ${name}.`);return x;}
export function shortText(x,max,name){if(typeof x!=='string'||!x.length||x.length>max||/[\u0000-\u001f]/.test(x))throw new Error(`Invalid ${name}.`);return x;}
export function validateTrial(r,maxPath=40){
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('A trial must be an object.');
  const task=choice(r.task,['horizontal','circles','interfaces'],'task');
  const variants=task==='horizontal'?['strips']:task==='circles'?['ring']:['buttons-varied','buttons-compact','buttons-standard','toolbar','form','dashboard','dialog','wide','tall','menu-floating','menu-edge','corner-floating','corner-edge'];
  const variant=choice(r.variant,variants,'variant'),duration=number(r.acquisition_ms,0,600000,'acquisition time');
  if(typeof r.hit!=='boolean'||typeof r.practice!=='boolean')throw new Error('Invalid outcome flags.');
  if(r.schema_version!==1)throw new Error('Unsupported trial schema.');
  const result={schema_version:1,app_version:shortText(r.app_version,24,'application version'),
    id:uuid(r.id,'trial ID'),set_id:uuid(r.set_id,'set ID'),movement_id:uuid(r.movement_id,'movement ID'),
    task,variant,condition:shortText(r.condition,160,'condition'),target_index:integer(r.target_index,0,2000,'target number'),attempt:integer(r.attempt,1,1000,'attempt'),
    hit:r.hit,practice:r.practice,perturbation:choice(r.perturbation,['normal','jitter'],'pointer condition'),
    jitter_css_px:number(r.jitter_css_px??0,0,10,'jitter'),gain:number(r.gain,.25,4,'gain'),seed:integer(r.seed??0,0,4294967295,'seed'),
    acquisition_ms:duration,completion_ms:r.hit?duration:null,input_mode:choice(r.input_mode,['virtual','native'],'input mode'),
    device:choice(r.device,['unspecified','mouse','trackpad','pen','other'],'device'),
    dpr:number(r.dpr,.25,8,'pixel ratio'),viewport_width:number(r.viewport_width,50,4096,'viewport width')};
  for(const key of ['distance','nominal_distance','start_x','start_y','target_x','target_y','click_x','click_y'])result[key]=number(r[key],0,8192,key);
  for(const key of ['target_w','target_h','approach_width'])result[key]=number(r[key],.05,8192,key);
  if(['menu-edge','corner-edge'].includes(variant)&&result.input_mode!=='virtual')throw new Error('Simulated hard boundaries require a captured virtual cursor.');
  if(result.input_mode==='native'&&(result.gain!==1||result.perturbation!=='normal'))throw new Error('Native-mode perturbations are unsupported.');
  result.index_difficulty=['menu-edge','corner-edge'].includes(variant)?null:Math.log2(1+result.distance/result.approach_width);
  if(typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at)))throw new Error('Invalid client timestamp.');result.created_at=new Date(r.created_at).toISOString();
  if(!Array.isArray(r.path)||r.path.length>maxPath)throw new Error(`A path must contain at most ${maxPath} samples.`);
  result.path=r.path.map(p=>({x:number(p.x,0,8192,'path x'),y:number(p.y,0,8192,'path y'),t:number(p.t,0,600000,'path time')}));
  for(let i=1;i<result.path.length;i++)if(result.path[i].t<result.path[i-1].t)throw new Error('Path time must be monotonic.');
  return result;
}
