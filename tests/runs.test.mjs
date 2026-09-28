import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRun,completedStages,datasetKey} from '../src/runs.js';
import {protocol,TASKS} from '../src/protocol.js';
import {TrialEngine} from '../src/engine.js';
import {validateTrial} from '../shared/validate.js';
import {conditionMeans} from '../src/math.js';
import {boundaryRows} from '../src/analysis.js';

function finished(run){return TASKS.flatMap(task=>protocol(task,run.id).map((p,i)=>({task,state:'complete',plan:{...p,guidedIndex:i},options:{runId:run.id}})));}
test('a repeat has a new dataset ID and completion belongs only to its own guided sets',()=>{
 const run=nextRun(),sets=finished(run),next=nextRun(run);
 assert.notEqual(next.id,run.id);assert.equal(next.number,2);
 assert.deepEqual(completedStages(sets,run),TASKS);assert.deepEqual(completedStages(sets,next),[]);
 assert.ok(!completedStages(sets.slice(1),run).includes('horizontal'));
 assert.ok(!completedStages([...sets.slice(1),sets[1]],run).includes('horizontal'),'repeating another condition cannot fill the missing set');
 assert.deepEqual(completedStages(sets.map(s=>({...s,plan:{...s.plan,custom:true}})),run),[]);
});
test('engine, export grouping and ingress preserve optional run identity without changing the participant',()=>{
 const run=nextRun(),rows=[],participantId=crypto.randomUUID();
 const e=new TrialEngine(protocol('horizontal',run.id)[0],{participantId,runId:run.id,runNumber:run.number},{record:r=>rows.push(r)});
 e.activate();e.click(e.home,0);e.click(e.target,200);
 const clean=validateTrial(rows[0]);assert.equal(clean.run_id,run.id);assert.equal(clean.run_number,1);
 assert.equal(rows[0].participant_id,participantId);assert.equal(clean.participant_id,undefined);
 const legacy={...rows[0]};delete legacy.run_id;delete legacy.run_number;
 assert.equal(validateTrial(legacy).run_id,undefined);
 assert.notEqual(datasetKey(legacy),datasetKey(rows[0]));
 assert.throws(()=>validateTrial({...rows[0],run_id:'invalid'}),/run ID/);
 assert.throws(()=>validateTrial({...rows[0],run_number:0}),/run number/);
 const second=nextRun(run),data=[...Array.from({length:3},()=>rows[0]),...Array.from({length:3},()=>({...rows[0],run_id:second.id,run_number:2,approach_width:64}))];
 const means=conditionMeans(data);assert.equal(means.length,2);assert.deepEqual(means.map(r=>r.n),[3,3]);assert.equal(means[1].approach_width,64);
 const paired=boundaryRows([{...rows[0],task:'interfaces',variant:'menu-floating',condition:'menu-floating-control'}, {...rows[0],task:'interfaces',run_id:second.id,variant:'menu-edge',condition:'menu-edge-control'}]);
 assert.equal(new Set(paired.map(r=>r.comparison_key)).size,2,'free and bounded trials from different runs never form a pair');
});
