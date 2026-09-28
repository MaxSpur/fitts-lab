import {VERSION,TASKS,protocol} from './protocol.js';

/** A repeat belongs to the same participant and classroom, with its own dataset ID. */
export function nextRun(previous=null){return{id:crypto.randomUUID(),number:(previous?.number||0)+1,version:VERSION};}
export function completedStages(sets,run){
  return TASKS.filter(task=>{
    const required=protocol(task,run.id).length;
    const indices=new Set(sets.filter(s=>s.task===task&&s.state==='complete'&&s.options?.runId===run.id&&!s.plan.custom).map(s=>s.plan.guidedIndex).filter(i=>Number.isInteger(i)&&i>=0&&i<required));
    return indices.size===required;
  });
}
export const datasetKey=r=>`${r.participant_id}:${r.run_id||'legacy'}`;
export const datasetLabel=r=>`${r.participant_label||'Participant'} · ${r.run_id?'Run '+r.run_number:'Earlier results'}`;
