import {hash,seeded,shuffled} from './math.js';
export const VERSION='1.3.0';
export const ARENA={width:960,height:460};
export const TASKS=['horizontal','circles','interfaces'];
export const TASK_LABELS={horizontal:'Horizontal',circles:'Circles',interfaces:'Interfaces'};
export const BUTTON_SETS=['buttons-varied'];
export const INTERFACE_ORDER=['menu-floating','menu-edge','corner-floating','corner-edge'];
export const HORIZONTAL_BLOCK_SIZE=4;
export const HORIZONTAL_DISTANCES=[120,240,360,480];
export const TARGET_SIZES=[20,32,48,64];
export const CIRCLE_SITES=16;
export const VARIANTS={'buttons-varied':'Buttons · varied sizes','buttons-compact':'Buttons · compact','buttons-standard':'Buttons · standard',wide:'Wide button',tall:'Tall button','menu-floating':'Menu · free','menu-edge':'Menu · edge','corner-floating':'Window control · free','corner-edge':'Window control · edges'};
export function protocol(task,identity='local') {
  const seed=hash(identity);
  if(task==='horizontal')return shuffled(TARGET_SIZES,seed).map(width=>{
    const layoutSeed=hash(`${identity}-horizontal-${width}`);
    return{task,variant:'strips',width,height:300,count:8,condition:`horizontal-mixed-${width}`,layoutSeed,positions:horizontalSequence(width,layoutSeed)};
  });
  if(task==='circles')return shuffled(TARGET_SIZES,seed).map(width=>{
    const layoutSeed=hash(`${identity}-circles-${width}`);
    return{task,variant:'ring',distance:360,width,height:width,count:8,condition:`circles-random-${width}`,layoutSeed,sequence:circleSequence(layoutSeed)};
  });
  // Keep free/edge geometry and captured input matched within each boundary pair.
  const pairs=[['menu-floating','menu-edge'],['corner-floating','corner-edge']];
  const edges=pairs.flat().map(variant=>{
    const layoutSeed=hash(identity+'-'+(variant.startsWith('menu')?'menu':'corner'));
    const p={task,variant,count:8,condition:variant,layoutSeed};
    return{...p,positions:boundarySequence(p)};
  });
  const layoutSeed=hash(identity+'-buttons');
  return[{task,variant:'buttons-varied',count:8,condition:'buttons-varied',layoutSeed,positions:buttonSequence('buttons-varied',layoutSeed,8)},...edges];
}
export function planLabel(p) {
  if(p.task==='horizontal')return p.positions?`${p.width}px wide · varied distance`:`${p.distance}px apart · ${p.width}px wide`;
  if(p.task==='circles')return `${p.width}px circles · ${p.sequence?'varied distance':p.distance+'px ring'}`;
  return VARIANTS[p.variant];
}
function varied(points,seed,spreadX,spreadY){
  const rand=seeded(seed);
  return shuffled(points,seed).map(p=>({x:Math.round(p.x+(rand()-.5)*spreadX),
    y:Math.round(p.y+(rand()-.5)*spreadY)}));
}
const control=(x,y,w,h,label,kind='button')=>({x,y,w,h,label,kind,shape:'rect'});
/** Serial selections after one unscored start; count defaults to the older 24-trial plan. */
export function buttonSequence(variant,seed,count=24){
  const rand=seeded(seed),compact=variant==='buttons-compact';
  const xs=[125,300,480,660,835],ys=[78,154,230,306,382];
  const sites=ys.flatMap(y=>xs.map(x=>({x:x+Math.round((rand()-.5)*24),y:y+Math.round((rand()-.5)*18)})));
  let order;
  for(let attempt=0;attempt<200;attempt++){
    const candidate=shuffled(sites,seed+attempt);
    if(candidate.every((p,i)=>!i||Math.hypot(p.x-candidate[i-1].x,p.y-candidate[i-1].y)>=145)){order=candidate;break;}
  }
  if(!order)throw new Error('Could not lay out button sequence.');
  if(count===8){const sizes=shuffled([[64,28],[88,32],[112,36],[144,44]].flatMap(s=>[s,s]),seed^0x9e3779b9);return order.slice(0,9).map((p,i)=>{const s=i?sizes[i-1]:[96,34];return control(p.x,p.y,s[0],s[1],'','button');});}
  const choices=compact?[[64,28],[80,30],[96,34],[112,38]]:variant==='buttons-standard'?[[80,32],[104,36],[128,40],[152,44]]:[[64,28],[80,30],[96,34],[112,38],[128,40],[152,44]];
  const sizes=shuffled(Array.from({length:25},(_,i)=>choices[i%choices.length]),seed^0x9e3779b9);
  return order.map((p,i)=>control(p.x,p.y,sizes[i][0],sizes[i][1],'','button'));
}
export function boundaryFrame(p){const seed=p.layoutSeed??0;return{left:88+seed%5*8,top:64+seed%4*8,right:872,bottom:410};}
/** Matched free and bounded runs share an unscored start and serial targets. */
export function boundarySequence(p){
  const corner=p.variant.startsWith('corner'),seed=p.layoutSeed??0,{left,top}=boundaryFrame(p);
  const regular=shuffled([{x:275,y:305},{x:655,y:326},{x:425,y:205},{x:755,y:245},{x:510,y:368}],seed);
  const controls=shuffled([0,1,2,3],seed^0x9e3779b9);
  const ordinary=(i)=>{const q=regular[i%regular.length],sizes=[[80,32],[104,36],[128,40],[96,34],[112,38]],s=sizes[i%5];return control(q.x,q.y,s[0],s[1],'');};
  const out=[ordinary(0)];
  for(let i=0;i<(p.count||8)/2;i++){
    const slot=controls[i%4],w=p.custom?p.width:corner?[30,34,32,36][slot]:[72,88,96,80][slot];
    const h=p.custom?p.height:corner?[30,34,32,36][slot]:[30,32,30,32][slot];
    const x=corner?left+[0,52,108,166][slot]+w/2:[245,390,550,710][slot];
    const label=corner?['×','−','□','⋯'][slot]:['File','Edit','View','Help'][slot];
    out.push(control(x,top+h/2,w,h,label,corner?'icon':'button'));
    out.push(ordinary(i+1));
  }
  return out;
}
export function boundaryLayout(p,index=0){const frame=boundaryFrame(p),positions=p.positions||boundarySequence(p);return{...frame,target:positions[Math.min(index+1,positions.length-1)],home:positions[Math.min(index,positions.length-1)]};}
export function targetFor(p,index) {
  if(p.task==='horizontal'){
    if(p.positions)return{x:p.positions[Math.min(index,p.positions.length-1)],y:230,w:p.width,h:p.height,shape:'rect'};
    if(index===0)return horizontalPair(p,0)[0];
    const block=Math.floor((index-1)/HORIZONTAL_BLOCK_SIZE);
    return horizontalPair(p,block)[index%2?1:0];
  }
  if(p.task==='circles'){if(p.sequence)return circleSite(p,p.sequence[Math.min(index,p.sequence.length-1)]);const phase=p.layoutSeed===undefined?0:p.layoutSeed%12,a=2*Math.PI*((phase+index*5)%12)/12;return{x:480+p.distance/2*Math.cos(a),y:230+p.distance/2*Math.sin(a),w:p.width,h:p.width,shape:'circle'};}
  if(BUTTON_SETS.includes(p.variant))return p.positions[Math.min(index,p.positions.length-1)];
  if(p.variant.startsWith('menu')||p.variant.startsWith('corner')){
    const positions=p.positions||boundarySequence(p);return positions[Math.min(index,positions.length-1)];
  }
  const w=p.custom?p.width:p.variant==='tall'?28:112;
  const h=p.custom?p.height:p.variant==='tall'?112:28;
  const seed=p.layoutSeed??0;
  const buttons=varied([{x:300,y:160},{x:655,y:175},{x:390,y:155},{x:565,y:215},
    {x:475,y:165},{x:260,y:230},{x:690,y:225},{x:355,y:230}],seed,50,40);
  const position=buttons[index%buttons.length];
  return{...position,w,h,shape:'rect'};
}
/** A seeded serial path: two movements at each of four designed distances. */
export function horizontalSequence(width,seed){
  const rand=seeded(seed),lo=64+width/2,hi=896-width/2;
  const counts=HORIZONTAL_DISTANCES.map(()=>2),total=counts.length*2;
  for(const start of shuffled([400,440,520,560],seed)){
    counts.fill(2);const path=[start],failed=new Set();
    const walk=(x,previous=-1)=>{
      if(path.length===total+1)return true;
      const key=`${x}|${previous}|${counts.join(',')}`;
      if(failed.has(key))return false;
      const choices=[];
      HORIZONTAL_DISTANCES.forEach((d,i)=>{
        if(!counts[i]||i===previous)return;
        for(const sign of [-1,1]){const next=x+sign*d;
          if(next>=lo&&next<=hi)choices.push({i,next,rank:rand()});}
      });
      choices.sort((a,b)=>counts[b.i]-counts[a.i]||a.rank-b.rank);
      for(const {i,next} of choices){counts[i]--;path.push(next);
        if(walk(next,i))return true;
        path.pop();counts[i]++;
      }
      failed.add(key);return false;
    };
    if(walk(start))return path;
  }
  throw new Error('Could not lay out horizontal targets.');
}
/** Each block is a true one-dimensional alternation at the same D and W. */
export function horizontalPair(p,block=0){
  const half=p.distance/2, margin=48+p.width/2;
  const lo=margin+half,hi=ARENA.width-margin-half;
  const centers=shuffled([.1,.5,.9].map(t=>lo+(hi-lo)*t),p.layoutSeed??0);
  const center=centers[block%centers.length];
  return[-1,1].map(side=>({x:center+side*half,y:230,w:p.width,h:p.height,shape:'rect'}));
}
export function homeFor(p,index=0) {
  if(p.task==='horizontal'&&p.positions)return targetFor(p,index);
  if(p.task==='horizontal')return index%HORIZONTAL_BLOCK_SIZE===0?
    horizontalPair(p,Math.floor(index/HORIZONTAL_BLOCK_SIZE))[0]:targetFor(p,index);
  if(p.task==='interfaces'){
    if(BUTTON_SETS.includes(p.variant)||p.variant.startsWith('corner')||p.variant.startsWith('menu'))return targetFor(p,index);
    return{x:480,y:370};
  }
  return targetFor(p,index);
}
export function boundsFor(p,index=0) {
  if(isBoundary(p)){
    const b=boundaryFrame(p);return{left:p.variant==='corner-edge'?b.left:0,right:ARENA.width,top:b.top,bottom:ARENA.height};
  }
  return{left:0,right:ARENA.width,top:0,bottom:ARENA.height};
}
export const isBoundary=p=>['menu-edge','corner-edge'].includes(p.variant);
export function taskHint(p) {
  if(p.task==='horizontal')return p.positions?'Follow each highlighted strip. Width stays fixed; distance changes each trial.':'Alternate four times, then click the new start marker. Each start click is unscored.';
  if(p.task==='circles')return 'Click the highlighted circle, then the next. Connections vary in distance and direction.';
  if(BUTTON_SETS.includes(p.variant))return 'Click the starting button once, then follow each highlighted button without returning to Start. Size and position change each trial.';
  if(p.variant==='menu-edge')return 'Follow the buttons and menu items. The top edge stops vertical overshoot.';
  if(p.variant==='corner-edge')return 'Follow the buttons and window controls. The top and left edges catch overshoot.';
  if(p.variant.includes('floating'))return 'Follow the buttons and controls. You can overshoot the marked boundary.';
  return 'Approach the button from below. Click Home between selections.';
}

/** Sixteen visible sites; a balanced random walk visits nine distinct targets. */
export function circleSite(p,index){const a=2*Math.PI*index/CIRCLE_SITES;return{x:480+p.distance/2*Math.cos(a),y:230+p.distance/2*Math.sin(a),w:p.width,h:p.width,shape:'circle'};}
export function circleSequence(seed){
  const rand=seeded(seed),steps=[1,3,5,7],remaining=[2,2,2,2],path=[seed%CIRCLE_SITES];
  function walk(previous=-1){
    if(path.length===9)return true;
    const choices=[];
    steps.forEach((step,i)=>{if(!remaining[i]||i===previous)return;for(const sign of [-1,1]){const next=(path.at(-1)+sign*step+CIRCLE_SITES)%CIRCLE_SITES;if(!path.includes(next))choices.push({i,next,rank:rand()});}});
    choices.sort((a,b)=>remaining[b.i]-remaining[a.i]||a.rank-b.rank);
    for(const {i,next}of choices){remaining[i]--;path.push(next);if(walk(i))return true;path.pop();remaining[i]++;}
    return false;
  }
  if(!walk())throw new Error('Could not lay out circular sequence.');return path;
}
