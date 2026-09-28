import test from 'node:test';
import assert from 'node:assert/strict';
import {activityRuns} from '../src/activity.js';
const base={participant_id:'p',participant_label:'P',run_id:'r',run_number:1,task:'horizontal',set_id:'s',target_index:0,movement_id:'m',attempt:1,hit:true,acquisition_ms:200};
test('activity counts acquisitions once, including retries but excluding duplicate rows and practice',()=>{
 const miss={...base,id:'a',hit:false},retry={...base,id:'b',attempt:2,acquisition_ms:400};
 const [run]=activityRuns([miss,retry,retry,{...base,id:'c',movement_id:'m2',acquisition_ms:100},{...base,id:'d',movement_id:'m3',acquisition_ms:300},{...base,id:'e',practice:true}]);
 assert.equal(run.stages.horizontal,3);assert.equal(run.first,3);assert.equal(run.misses,1);assert.equal(run.median,200);assert.equal(run.latest.id,'d');
});
test('activity separates repeat runs and stages; arrival order is independent of client clocks',()=>{
 const rows=[{...base,id:'1',created_at:'2099'},{...base,id:'2',task:'circles',movement_id:'c',created_at:'2000'},{...base,id:'3',run_id:'r2',run_number:2}];
 const runs=activityRuns(rows);assert.equal(runs.length,2);assert.deepEqual(runs[0].stages,{horizontal:1,circles:1,interfaces:0});assert.equal(runs[0].latest.id,'2');assert.equal(runs[1].label,'P · Run 2');
 assert.equal(activityRuns([]).length,0);assert.equal(activityRuns([{...base,id:'4',hit:false}])[0].median,null);
});
