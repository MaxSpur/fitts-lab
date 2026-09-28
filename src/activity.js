import {datasetKey,datasetLabel} from './runs.js';
import {TASKS} from './protocol.js';

/** Received observations, not online presence or inferred protocol completion. */
export function activityRuns(rows){
  const runs=new Map(),seen=new Set();
  for(const r of rows){
    const id=`${r.participant_id}:${r.id}`;
    if(seen.has(id)||r.practice)continue;seen.add(id);
    const key=datasetKey(r);
    if(!runs.has(key))runs.set(key,{id:key,participantId:r.participant_id,label:datasetLabel(r),stages:Object.fromEntries(TASKS.map(t=>[t,new Set()])),first:0,misses:0,times:[],latest:null});
    const run=runs.get(key);
    // Map insertion order reflects arrival; client clocks need not agree.
    run.latest=r;
    if(r.hit&&run.stages[r.task])run.stages[r.task].add(r.movement_id||`${r.set_id}:${r.target_index}`);
    if(r.attempt===1){run.first++;if(!r.hit)run.misses++;else if(Number.isFinite(r.acquisition_ms))run.times.push(r.acquisition_ms);}
  }
  return [...runs.values()].map(run=>{
    const times=run.times.sort((a,b)=>a-b),mid=Math.floor(times.length/2);
    return{...run,times:undefined,stages:Object.fromEntries(TASKS.map(t=>[t,run.stages[t].size])),median:times.length?(times[mid]+times[Math.floor((times.length-1)/2)])/2:null,errorRate:run.first?run.misses/run.first:null};
  });
}
