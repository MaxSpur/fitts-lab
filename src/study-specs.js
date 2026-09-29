/** Classroom and public-overview specifications; participant experiment charts stay unchanged. */
import {SCHEMA,theme} from './specs.js';
import {hash} from './study.js';
export const stageColors={horizontal:'#397aac',circles:'#a65c31',interfaces:'#6b59a5'};
export const personColor=id=>`hsl(${hash(id)%360},58%,40%)`;
const stage={field:'task',type:'nominal',title:'Stage',scale:{domain:['horizontal','circles','interfaces'],range:Object.values(stageColors)},legend:{orient:'bottom',labelExpr:"{'horizontal':'Horizontal','circles':'Circles','interfaces':'Interfaces'}[datum.label]"}};
export function acquisitionSpec({width=760,height=400,x='index_difficulty',xMax=6,yMax=2000,selected='',stageFilter=null}={}){
  const X={field:x,type:'quantitative',title:x==='index_difficulty'?'Difficulty log₂(1 + D/W) (bits)':x==='distance'?'Distance (CSS px)':'Approach width (CSS px)',scale:{domain:[0,xMax],nice:false},axis:{tickCount:6}},
    Y={field:'acquisition_ms',type:'quantitative',title:'Acquisition time (ms)',scale:{domain:[0,yMax],nice:false},axis:{tickCount:6}}, filter=stageFilter?[{filter:{field:'task',equal:stageFilter}}]:[];
  const bandY={field:'low',type:'quantitative',scale:Y.scale,title:Y.title};
  return{$schema:SCHEMA,width,height,autosize:{type:'fit-x',contains:'padding'},config:theme,resolve:{legend:{color:'independent',shape:'independent',strokeDash:'independent'}},params:[{name:'focusStudent',value:selected}],layer:[
    {data:{name:'bands'},transform:filter,mark:{type:'area',opacity:.16,clip:true},encoding:{x:X,y:bandY,y2:{field:'high'},color:stage,detail:{field:'key'}}},
    {data:{name:'trials'},transform:filter,mark:{type:'point',size:25,strokeWidth:.8,clip:true},encoding:{x:X,y:Y,shape:{field:'task',type:'nominal',scale:{domain:['horizontal','circles','interfaces'],range:['square','circle','diamond']},legend:null},
      fill:{condition:[{test:'!datum.hit',value:'transparent'},{test:'datum.dataset_id === focusStudent',field:'student_color',scale:null}],value:'#929b9b'},
      stroke:{condition:{test:'datum.dataset_id === focusStudent',field:'student_color',scale:null},value:'#929b9b'},
      opacity:{condition:{test:'datum.dataset_id === focusStudent',value:.9},value:selected?.14:.24},
      tooltip:[{field:'participant_label',title:'Participant'},{field:'run_number',title:'Run'},{field:'task',title:'Stage'},{field:'acquisition_ms',title:'Time (ms)',format:'.0f'},{field:x,format:'.2f'},{field:'hit',title:'Hit'},{field:'input_mode',title:'Input'},{field:'variant',title:'Condition'}]}},
    {data:{name:'fit'},transform:filter,mark:{type:'line',strokeWidth:2.2,clip:true},encoding:{x:X,y:Y,color:stage,strokeDash:{field:'settings',type:'nominal',legend:null},detail:{field:'key'},tooltip:[{field:'task',title:'Stage'},{field:'settings',title:'Settings'},{field:'nPeople',title:'Participants'},{field:'nTrials',title:'Successful first attempts'},{field:'r2',title:'Weighted R²',format:'.2f'}]}},
    {data:{name:'selectedFit'},transform:filter,mark:{type:'line',strokeWidth:5,color:'white',clip:true},encoding:{x:X,y:Y,detail:{field:'key'}}},
    {data:{name:'selectedFit'},transform:filter,mark:{type:'line',strokeWidth:3,clip:true},encoding:{x:X,y:Y,color:{field:'student_color',type:'nominal',scale:null,legend:null},strokeDash:{field:'task',type:'nominal',legend:null},detail:{field:'key'},tooltip:[{field:'task',title:'Selected run'},{field:'settings',title:'Settings'},{field:'nTrials',title:'Successful first attempts'},{field:'r2',title:'Descriptive R²',format:'.2f'}]}}
  ]};
}
export function pairedData(group){
  const means=group.people.map(p=>({...p,row:p.participant_label,kind:'Participant mean'}));
  const runs=group.runs.map(r=>({...r,row:r.participant_label,student_color:personColor(r.participant_id),offset:(hash(r.dataset_id)%7-3)*1.6}));
  const paired=runs.flatMap(r=>[{...r,side:'Free',time:r.free},{...r,side:'Bounded',time:r.edge}]);
  return{paired,effectRuns:runs,effectPeople:means,effectMean:[{...group.summary,saved:group.summary.mean,row:'Class mean',kind:'Equal participant mean'}]};
}
/** Paired observations + a horizontally readable participant-effect forest (positive = boundary benefit). */
export function pairedSpec(group,{width=570,selected=''}={}){
  const yRows=[...group.people.map(p=>p.participant_label),'Class mean'],people=new Set(group.people.map(p=>p.participant_id)),selectedPerson=group.runs.find(r=>r.dataset_id===selected)?.participant_id||'';
  const height=Math.max(180,Math.min(760,yRows.length*22)),leftWidth=Math.max(120,Math.round(width*.32)),rightWidth=Math.max(170,width-leftWidth-105);
  const chosen=group.runs.filter(r=>r.dataset_id===selected),scaleRows=chosen.length?chosen:group.runs,vals=scaleRows.flatMap(r=>[r.free,r.edge]);
  const lo=Math.min(...vals),hi=Math.max(...vals),pad=Math.max(group.metric==='accuracy'?2:60,(hi-lo)*.12),bounds=[Math.max(0,lo-pad),hi+pad];
  const effectVals=[0,...group.people.map(r=>r.saved),...group.runs.map(r=>r.saved),group.summary.low,group.summary.high].filter(Number.isFinite),eLo=Math.min(...effectVals),eHi=Math.max(...effectVals),ePad=Math.max(group.metric==='accuracy'?2:20,(eHi-eLo)*.12);
  const effectX={field:'saved',type:'quantitative',title:group.metric==='accuracy'?'Misses reduced (percentage points)':'Time saved by boundary (ms)',scale:{domain:[eLo-ePad,eHi+ePad],nice:false},axis:{tickCount:4}},effectY={field:'row',type:'nominal',title:null,sort:yRows,axis:{labelLimit:95,labelFontSize:10}};
  const leftX={field:'side',type:'nominal',sort:['Free','Bounded'],title:null,axis:{labelAngle:0}},leftY={field:'time',type:'quantitative',title:group.metric==='accuracy'?'First-attempt misses (%)':'Run mean (ms)',scale:{domain:bounds,nice:false},axis:{tickCount:5}};
  return{$schema:SCHEMA,config:theme,spacing:10,params:[{name:'focusStudent',value:selected}],hconcat:[
    {width:leftWidth,height,layer:[
      {data:{name:'paired'},mark:{type:'line',strokeWidth:1,clip:true},encoding:{x:leftX,y:leftY,detail:{field:'dataset_id'},order:{field:'side',sort:'descending'},color:{condition:{test:'datum.dataset_id === focusStudent',field:'student_color',scale:null},value:'#b4bcbc'},opacity:{condition:{test:'datum.dataset_id === focusStudent',value:1},value:selected?.15:.5}}},
      {data:{name:'paired'},mark:{type:'point',filled:true,size:45,clip:true},encoding:{x:leftX,y:leftY,color:{condition:{test:'datum.dataset_id === focusStudent',field:'student_color',scale:null},value:'#82928e'},opacity:{condition:{test:'datum.dataset_id === focusStudent',value:1},value:selected?.18:.6},tooltip:[{field:'dataset_label',title:'Run'},{field:'side',title:'Target'},{field:'time',title:group.metric==='accuracy'?'Misses (%)':'Mean (ms)',format:'.1f'},{field:'nFree',title:'Free attempts used'},{field:'nEdge',title:'Bounded attempts used'}]}}
    ]},
    {width:rightWidth,height,layer:[
      {data:{values:[{}]},mark:{type:'rule',strokeDash:[4,3],color:'#adb7b3'},encoding:{x:{datum:0,type:'quantitative',scale:effectX.scale}}},
      {data:{name:'effectRuns'},mark:{type:'point',shape:'diamond',filled:true,size:30,clip:true},encoding:{x:effectX,y:effectY,yOffset:{field:'offset',type:'quantitative',scale:null},color:{condition:{test:'datum.dataset_id === focusStudent',field:'student_color',scale:null},value:'#bdc5c1'},opacity:{condition:{test:'datum.dataset_id === focusStudent',value:1},value:.5},tooltip:[{field:'dataset_label',title:'Run'},{field:'saved',title:'Free − bounded',format:'.1f'}]}},
      {data:{name:'effectPeople'},mark:{type:'point',filled:true,size:60,color:'#3d706a',clip:true},encoding:{x:effectX,y:effectY,opacity:{condition:{test:selectedPerson?`datum.participant_id === ${JSON.stringify(selectedPerson)}`:'true',value:1},value:.2},tooltip:[{field:'participant_label',title:'Participant'},{field:'saved',title:'Free − bounded',format:'.1f'},{field:'nRuns',title:'Paired runs averaged'}]}},
      {data:{name:'effectMean'},transform:[{filter:'isValid(datum.low) && isValid(datum.high)'}],mark:{type:'rule',strokeWidth:3,color:'#172840'},encoding:{x:{...effectX,field:'low'},x2:{field:'high'},y:effectY}},
      {data:{name:'effectMean'},mark:{type:'point',shape:'diamond',filled:true,size:140,color:'#172840'},encoding:{x:effectX,y:effectY,tooltip:[{field:'saved',title:'Mean benefit',format:'.1f'},{field:'low',title:'95% interval low',format:'.1f'},{field:'high',title:'95% interval high',format:'.1f'},{field:'n',title:'Participants'},{field:'nRuns',title:'Usable paired runs'}]}}
    ]}],resolve:{scale:{x:'independent',y:'independent',color:'independent'}}};
}
export function slopesSpec({width=850,height=350}={}){return{$schema:SCHEMA,width,height,autosize:{type:'fit',contains:'padding'},config:theme,data:{name:'people'},mark:{type:'point',filled:true,size:65},encoding:{x:{field:'b',type:'quantitative',title:'Participant slope (ms/bit)',scale:{zero:true}},y:{field:'participant_label',type:'nominal',title:null},color:stage,shape:{field:'settings',type:'nominal',legend:null},tooltip:[{field:'participant_label',title:'Participant'},{field:'task',title:'Stage'},{field:'settings',title:'Settings'},{field:'b',title:'Slope (ms/bit)',format:'.1f'},{field:'nTrials',title:'Successful first attempts'}]}};}
