import test from 'node:test';import assert from 'node:assert/strict';
import {nearFar,shannon,approachWidth,constrainedMove,regression,downsample,seeded} from '../src/math.js';
import {protocol,targetFor,homeFor,buttonSequence,boundaryLayout,BUTTON_SETS,HORIZONTAL_DISTANCES,boundsFor,VERSION} from '../src/protocol.js';
import {TrialEngine} from '../src/engine.js';
import {boundaryRows,trendlines} from '../src/analysis.js';
import {simulationRows} from '../src/simulation.js';
import {validateTrial} from '../shared/validate.js';
const pid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function engine(plan=protocol('horizontal','x')[0]){const rows=[];const e=new TrialEngine(plan,{participantId:pid,participantLabel:'TEST',device:'mouse',dpr:2},{record:r=>rows.push(r)});return{e,rows};}
test('Shannon difficulty is invariant under uniform scaling',()=>assert.equal(shannon(200,20),shannon(400,40)));
test('near/far formulation and infinite limits are mathematically distinct',()=>{assert.equal(nearFar(100,300),Math.log2(2));assert.equal(nearFar(100,Infinity),0);assert.equal(nearFar(100,Infinity,'welford'),0);assert.equal(nearFar(100,Infinity,'shannon'),Math.log2(1.5));assert.equal(nearFar(100,100),null);});
test('rectangle chord uses approach direction, not bounding-box projection',()=>{assert.equal(approachWidth(100,20,1,0),100);assert.equal(approachWidth(100,20,0,1),20);assert.ok(Math.abs(approachWidth(100,20,1,1)-20*Math.SQRT2)<1e-9);});
test('overshoot is discarded; reversal immediately moves away from edge',()=>{const b={left:100,right:960,top:78,bottom:460};const q=constrainedMove({x:120,y:100},-1000,-1000,b);assert.deepEqual(q,{x:100,y:78});assert.deepEqual(constrainedMove(q,1,1,b),{x:101,y:79});});
test('guided horizontal sets keep width fixed and balance varied distances',()=>{
  const ps=protocol('horizontal','layout-test');
  assert.equal(ps.length,6);assert.deepEqual(ps.map(p=>p.width).sort((a,b)=>a-b),[24,24,24,64,64,64]);
  for(const p of ps){
    assert.equal(p.count,12);assert.equal(p.positions.length,13);
    const distances=Array.from({length:p.count},(_,i)=>Math.abs(targetFor(p,i+1).x-targetFor(p,i).x));
    assert.ok(distances.every((d,i)=>!i||d!==distances[i-1]));
    assert.ok(new Set(p.positions).size>3);
    assert.ok(Array.from({length:p.count+1},(_,i)=>targetFor(p,i)).every(t=>t.x-t.w/2>0&&t.x+t.w/2<960));
  }
  for(const w of [24,64]){
    const run=ps.filter(p=>p.width===w).sort((a,b)=>a.block-b.block);
    const distances=run.flatMap(p=>Array.from({length:p.count},(_,i)=>Math.abs(p.positions[i+1]-p.positions[i])));
    for(const d of HORIZONTAL_DISTANCES)assert.equal(distances.filter(v=>v===d).length,12);
    assert.ok(distances.every((d,i)=>!i||d!==distances[i-1]));
    for(let i=1;i<run.length;i++)assert.equal(run[i-1].positions.at(-1),run[i].positions[0]);
  }
});
test('guided horizontal records use designed trial distances as conditions',()=>{
  const p=protocol('horizontal','record-test')[0],{e,rows}=engine(p);
  e.activate();e.click(e.home,0);
  for(let i=1;i<=p.count;i++){e.click(e.target,i*100);
    assert.equal(rows.at(-1).condition,`horizontal-${Math.abs(p.positions[i]-p.positions[i-1])}-${p.width}`);
    if(i<p.count)assert.equal(e.state,'running');
  }
  assert.equal(rows.length,p.count);assert.equal(e.state,'complete');
});
test('fixed-distance exploration can reposition its pair with an unscored start',()=>{
  const p={...protocol('horizontal','block-test')[0],custom:true,distance:360,count:12};delete p.positions;
  const{e,rows}=engine(p);
  e.activate();e.click(e.home,0);
  for(let i=1;i<=4;i++)e.click(e.target,i*100);
  assert.equal(rows.length,4);assert.equal(e.state,'armed');
  assert.notEqual(e.home.x,targetFor(p,4).x);
  e.click(e.home,500);assert.equal(rows.length,4);
  e.click(e.target,650);assert.equal(rows[4].acquisition_ms,150);
  assert.ok(Math.abs(rows[4].nominal_distance-p.distance)<1e-3);
});
test('ring has twelve distinct directions and actual chords shorter than its diameter',()=>{const p=protocol('circles')[0],a=targetFor(p,0),b=targetFor(p,1);assert.equal(p.count,12);assert.equal(new Set(Array.from({length:12},(_,i)=>`${targetFor(p,i).x},${targetFor(p,i).y}`)).size,12);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<p.distance);});
test('guided interface buttons form varied serial sequences',()=>{
  const ps=protocol('interfaces','layout-test');
  assert.equal(ps.length,5);
  assert.equal(ps[0].variant,'buttons-varied');
  assert.deepEqual(ps.slice(1).map(p=>p.variant),['menu-floating','menu-edge','corner-floating','corner-edge']);
  for(const p of ps.slice(0,1)){
    assert.equal(p.count,24);
    const targets=Array.from({length:p.count+1},(_,i)=>targetFor(p,i));
    assert.equal(new Set(targets.map(t=>`${t.x},${t.y}`)).size,25);
    assert.ok(new Set(targets.map(t=>t.w)).size>=4);
    assert.ok(new Set(targets.map(t=>t.h)).size>=4);
    assert.ok(targets.every(t=>t.w/t.h>=2));
    assert.ok(targets.every(t=>t.x-t.w/2>0&&t.x+t.w/2<960&&t.y-t.h/2>0&&t.y+t.h/2<460));
    assert.ok(targets.every((t,i)=>!i||Math.hypot(t.x-targets[i-1].x,t.y-targets[i-1].y)>=145));
    assert.deepEqual(p.positions,buttonSequence(p.variant,p.layoutSeed));
  }
});
test('button selections continue from the previous click without another Home',()=>{
  const p=protocol('interfaces','serial-test')[0],{e,rows}=engine(p);
  e.activate();e.click(e.home,0);assert.equal(rows.length,0);assert.equal(e.state,'running');
  for(let i=0;i<p.count;i++){
    e.click(e.target,(i+1)*100);
    if(i<p.count-1){assert.equal(e.state,'running');assert.equal(e.start.x,rows.at(-1).click_x);assert.equal(e.start.y,rows.at(-1).click_y);}
  }
  assert.equal(rows.length,24);assert.equal(e.state,'complete');
});
test('matched menu and window pairs use serial controls and aligned boundaries',()=>{
  const ps=protocol('interfaces','layout-test');
  for(const pair of [['menu-floating','menu-edge'],['corner-floating','corner-edge']]){
    const [free,edge]=pair.map(v=>ps.find(p=>p.variant===v));
    assert.equal(free.layoutSeed,edge.layoutSeed);
    assert.deepEqual(Array.from({length:9},(_,i)=>targetFor(free,i)),Array.from({length:9},(_,i)=>targetFor(edge,i)));
    assert.deepEqual(Array.from({length:8},(_,i)=>homeFor(free,i)),Array.from({length:8},(_,i)=>homeFor(edge,i)));
    assert.equal(new Set(Array.from({length:9},(_,i)=>targetFor(edge,i).w)).size>1,true);
  }
  const corner=ps.find(p=>p.variant==='corner-edge');
  assert.ok(new Set(Array.from({length:9},(_,i)=>targetFor(corner,i).x)).size>1);
  assert.ok(new Set(Array.from({length:9},(_,i)=>targetFor(corner,i).y)).size>1);
  for(let i=0;i<8;i++){
    const b=boundsFor(corner,i),layout=boundaryLayout(corner,i),t=targetFor(corner,i+1),h=homeFor(corner,i);
    assert.equal(b.left,layout.left);assert.equal(b.top,layout.top);
    if(i%2===0)assert.equal(t.y-t.h/2,b.top);
    assert.ok(h.x>b.left&&h.y>b.top);
  }
});
test('Explore keeps chosen control size in a serial window sequence',()=>{
  const p={...protocol('interfaces','explore-layout').find(p=>p.variant==='corner-edge'),custom:true,width:38,height:44};
  delete p.positions;
  const targets=Array.from({length:8},(_,i)=>targetFor(p,i+1));
  assert.ok(targets.filter((_,i)=>i%2===0).every(t=>t.w===38&&t.h===44));
  assert.ok(new Set(targets.map(t=>`${t.x},${t.y}`)).size>1);
  for(let i=0;i<8;i+=2){const b=boundsFor(p,i),t=targets[i];assert.equal(t.y-t.h/2,b.top);}
});
test('starting click is unscored; misses and retries are retained',()=>{const{e,rows}=engine();e.activate();e.click(e.home,100);assert.equal(rows.length,0);e.click({x:2,y:2},400);assert.equal(rows.length,1);assert.equal(rows[0].hit,false);assert.equal(rows[0].attempt,1);e.click(e.target,600);assert.equal(rows[1].attempt,2);assert.equal(rows[1].acquisition_ms,500);assert.equal(e.count,1);});
test('long observations are retained rather than silently discarded',()=>{const{e,rows}=engine();e.activate();e.click(e.home,0);e.click(e.target,7000);assert.equal(rows[0].acquisition_ms,7000);});
test('finish is an explicit terminal state until a new set is created',()=>{const p={...protocol('horizontal')[0],count:2};const{e,rows}=engine(p);e.activate();e.click(e.home,0);e.click(e.target,200);e.click(e.target,450);assert.equal(e.state,'complete');e.click(e.target,500);assert.equal(rows.length,2);});
test('pause keeps completed attempts and logs interruption; resume starts unscored',()=>{const{e,rows}=engine();e.activate();e.click(e.home,0);e.click(e.target,200);e.pause('test');assert.equal(rows.length,1);assert.equal(e.interruptions.length,1);e.activate();e.click(e.home,800);assert.equal(rows.length,1);e.click(e.target,1000);assert.equal(rows[1].acquisition_ms,200);});
test('boundary rows have no scalar Fitts difficulty and continue without Home',()=>{const p=protocol('interfaces').find(p=>p.variant==='corner-edge');const{e,rows}=engine(p);e.activate();e.click(e.home,0);e.click(e.target,300);assert.equal(rows[0].index_difficulty,null);assert.equal(rows[0].condition,'corner-edge-control');assert.equal(boundsFor(p,1).left,boundaryLayout(p,1).left);assert.equal(e.state,'running');e.click(e.target,500);assert.equal(rows[1].condition,'corner-edge-between');assert.equal(e.state,'running');});
test('boundary chart only connects comparable input conditions',()=>{
  const base={participant_id:pid,app_version:VERSION,task:'interfaces',practice:false,attempt:1,hit:true,acquisition_ms:300,perturbation:'normal',gain:1};
  const rows=boundaryRows([
    {...base,variant:'menu-floating',condition:'menu-floating-control',input_mode:'native'},
    {...base,variant:'menu-edge',condition:'menu-edge-control',input_mode:'virtual'},
    {...base,variant:'menu-floating',condition:'menu-floating-control',input_mode:'virtual'},
    {...base,variant:'menu-edge',condition:'menu-edge-between',input_mode:'virtual'},
    {...base,app_version:'1.0.4',variant:'menu-edge',condition:'menu-edge-control',input_mode:'virtual'}]);
  assert.equal(rows.length,4);
  assert.equal(rows[1].comparison_key,rows[2].comparison_key);
  assert.notEqual(rows[0].comparison_key,rows[1].comparison_key);
  assert.notEqual(rows[1].comparison_key,rows[3].comparison_key);
});
test('classroom preview follows current guided task lengths and includes circles',()=>{
  const rows=simulationRows(1,28);
  assert.deepEqual(['horizontal','circles','interfaces'].map(t=>rows.filter(r=>r.task===t).length),[72,72,72]);
  assert.equal(rows.filter(r=>r.variant==='buttons-varied').length,24);
  assert.equal(boundaryRows(rows).length,4);
});
test('ingress validation strips client identities and recomputes difficulty',()=>{const{e,rows}=engine();e.activate();e.click(e.home,0);e.click(e.target,300);const r={...rows[0],index_difficulty:999,participant_id:'FAKE',path:downsample(rows[0].path,40)};const v=validateTrial(r);assert.equal(v.participant_id,undefined);assert.notEqual(v.index_difficulty,999);assert.equal(v.hit,true);});
test('ingress rejects invalid values and oversized telemetry',()=>{const{e,rows}=engine();e.activate();e.click(e.home,0);e.click(e.target,300);assert.throws(()=>validateTrial({...rows[0],acquisition_ms:NaN}));assert.throws(()=>validateTrial({...rows[0],path:Array(41).fill({x:1,y:1,t:1})}));});
test('ingress accepts system-cursor ordinary buttons but requires capture for hard boundaries',()=>{
  const wide=protocol('interfaces','input-test').find(p=>BUTTON_SETS.includes(p.variant));
  const a=engine(wide);a.e.activate();a.e.click(a.e.home,0);a.e.click(a.e.target,300);
  assert.equal(validateTrial(a.rows[0]).input_mode,'native');
  assert.equal(validateTrial({...a.rows[0],variant:'buttons-standard'}).variant,'buttons-standard');
  const edge=protocol('interfaces','input-test').find(p=>p.variant==='menu-edge');
  const b=engine(edge);b.e.activate();b.e.click(b.e.home,0);b.e.click(b.e.target,300);
  assert.throws(()=>validateTrial(b.rows[0]),/hard boundaries/);
});
test('regression requires at least three distinct x values',()=>{assert.equal(regression([{x:1,y:1},{x:1,y:2},{x:2,y:3}],'x','y'),null);const r=regression([1,2,3,4].map(x=>({x,y:20+2*x})),'x','y');assert.equal(r.b,2);assert.equal(r.a,20);assert.equal(r.r2,1);});
test('downsampling preserves both endpoints and seed is reproducible',()=>{const p=Array.from({length:100},(_,i)=>({x:i}));assert.deepEqual(downsample(p,5).map(r=>r.x),[0,25,50,74,99]);const a=seeded(5),b=seeded(5);assert.equal(a(),b());});

 test('trendlines exclude misses, retries and mixed input settings',()=>{
  const make=(x,i)=>({participant_id:pid,task:'horizontal',variant:'strips',app_version:VERSION,input_mode:'native',device:'mouse',gain:1,perturbation:'normal',condition:'c'+x,attempt:1,hit:true,practice:false,index_difficulty:x,nominal_distance:x*100,distance:x*100,acquisition_ms:100+50*x});
  const rows=Array.from({length:12},(_,i)=>make(1+i%3,i));
  const fit=trendlines([...rows,{...rows[0],hit:false,acquisition_ms:9000},{...rows[0],attempt:2,acquisition_ms:8000}]);
  assert.equal(fit.fits.length,1);assert.equal(fit.fits[0].n,12);assert.equal(fit.fits[0].b,50);assert.equal(fit.lines.length,2);
  assert.equal(trendlines(rows.map((r,i)=>({...r,input_mode:i<6?'native':'virtual'}))).fits.length,0);
  assert.equal(trendlines(rows.map(r=>({...r,condition:'fixed'}))).fits.length,0);
  assert.equal(trendlines(rows.map(r=>({...r,nominal_distance:300})),'distance').fits.length,0);
 });
 test('three circular distances and two widths support ID and distance trends',()=>{
  const rows=simulationRows(1).filter(r=>r.task==='circles');
  assert.ok(rows.every(r=>r.nominal_distance>170&&r.nominal_distance<370));
  assert.equal(trendlines(rows).fits.length,1);
  assert.equal(trendlines(rows,'distance').fits.length,1);
 });
import {sessionState,sessionLabel} from '../src/session.js';
test('session labels reflect ended, draining and expired admission',()=>{
 const now=Date.now(),r={title:'Class',status:'open',created_at:new Date(now).toISOString(),expires_at:new Date(now+3600000).toISOString(),accept_until:new Date(now+600000).toISOString()};
 assert.equal(sessionState(r,now).open,true);
 assert.equal(sessionState({...r,status:'closed'},now).label,'Ended');
 assert.match(sessionState({...r,status:'closed'},now).detail,/queued uploads/);
 assert.equal(sessionState(r,now+3600001).label,'Expired');
 assert.match(sessionLabel({...r,status:'closed'}),/Ended/);
});
test('all stages have 72 selections and circular distances vary independently of target size',()=>{
 for(const task of ['horizontal','circles','interfaces'])assert.equal(protocol(task,'balanced').reduce((n,p)=>n+p.count,0),72);
 for(const width of [22,44]){const ps=protocol('circles','balanced').filter(p=>p.width===width);assert.equal(ps.length,3);assert.deepEqual(ps.map(p=>p.distance).sort((a,b)=>a-b),[180,280,380]);assert.ok(ps.every(p=>p.count===12));}
});

test('size trends require actual size variation and exclude failed attempts',()=>{
 const rows=simulationRows(1).filter(r=>r.task==='circles');
 const fit=trendlines(rows,'approach_width');assert.equal(fit.fits.length,1);
 assert.ok(fit.fits[0].b<0);assert.ok(fit.lines.every(r=>Number.isFinite(r.approach_width)));
 assert.equal(trendlines(rows.filter(r=>r.target_w===22),'approach_width').fits.length,0);
});
