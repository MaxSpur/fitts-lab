export const $=(q,root=document)=>root.querySelector(q);
export const $$=(q,root=document)=>[...root.querySelectorAll(q)];
export function text(q,s){const e=$(q);if(e)e.textContent=s;}
export function toast(message,error=false){const e=$('#notice');if(!e)return;e.textContent=message;e.hidden=false;e.classList.toggle('error',error);clearTimeout(e._timer);e._timer=setTimeout(()=>e.hidden=true,error?15000:6500);}
export function download(name,data,type='application/json'){
  const b=data instanceof Blob?data:new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});
  const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
}
export const CSV_FIELDS=['schema_version','source','room_id','seed','id','participant_id','participant_label','run_id','run_number','task','variant','condition','set_id','target_index','movement_id','attempt','hit','practice','perturbation','jitter_css_px','gain','distance','nominal_distance','target_w','target_h','approach_width','index_difficulty','acquisition_ms','completion_ms','start_x','start_y','target_x','target_y','click_x','click_y','input_mode','device','viewport_width','dpr','created_at','app_version'];
export function csv(rows){const cell=v=>{let s=v==null?'':String(v);if(/^[=+@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return [CSV_FIELDS.join(','),...rows.map(r=>CSV_FIELDS.map(k=>cell(r[k])).join(','))].join('\r\n');}
export async function copy(s){try{await navigator.clipboard.writeText(s);toast('Copied.');}catch{toast('Clipboard unavailable. Use the download button instead.',true);}}
export function showCode(spec){const modal=$('#code-dialog');$('#code-text').textContent=JSON.stringify(spec,null,2);$('#download-spec').onclick=()=>download('chart.vl.json',spec);$('#copy-spec').onclick=()=>copy(JSON.stringify(spec,null,2));modal.showModal();}
export function common(){
  if(!document.body.classList.contains('dashboard'))import('./overview-link.js').catch(()=>{});
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d && (e.clientX<d.getBoundingClientRect().left||e.clientX>d.getBoundingClientRect().right||e.clientY<d.getBoundingClientRect().top||e.clientY>d.getBoundingClientRect().bottom))d.close();}));
  window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast('An operation failed. Your completed trials remain in the local history. '+(e.reason?.message||''),true);});
}
export function noData(el,message='Your data will appear after a few clicks.'){el.innerHTML='';const p=document.createElement('p');p.className='empty-chart';p.textContent=message;el.append(p);}
