/** Reusable Vega-Lite specifications. Data is passed in; no DOM or experiment logic here. */
export const SCHEMA='https://vega.github.io/schema/vega-lite/v6.json';
export const theme={background:'transparent',font:'Arial',view:{stroke:null},axis:{labelColor:'#596563',titleColor:'#414b49',gridColor:'#e9ece7',domain:false,tickColor:'#cbd1cb',titleFontWeight:500,labelFontSize:11,titleFontSize:12,titlePadding:12},legend:{labelColor:'#596563',title:null,orient:'bottom',symbolType:'circle'}};
const base=(height=230)=>({$schema:SCHEMA,width:'container',height,autosize:{type:'fit',contains:'padding'},config:theme});
const tooltip=[{field:'participant_label',title:'Participant'},{field:'distance',title:'Distance (CSS px)',format:'.1f'},{field:'target_w',title:'Target width (CSS px)',format:'.1f'},{field:'target_h',title:'Target height (CSS px)',format:'.1f'},{field:'index_difficulty',title:'Difficulty (bits)',format:'.2f'},{field:'acquisition_ms',title:'Acquisition (ms)',format:'.0f'},{field:'hit',title:'Hit'},{field:'variant',title:'Condition'}];
export function scatterSpec({x='index_difficulty',height=270,extent=2000,interactive=true}={}){
  const axes={x:{field:x,type:'quantitative',title:x==='distance'?'Distance (CSS px)':'Index of difficulty (bits)',scale:{zero:true,domain:x==='distance'?[0,960]:[0,7]}},
    y:{field:'acquisition_ms',type:'quantitative',title:'Acquisition time (ms)',scale:{domain:[0,extent]}}};
  return {...base(height),layer:[
    {data:{name:'trials'},...(interactive?{params:[{name:'picked',select:{type:'point',fields:['participant_id'],on:'click',clear:'dblclick'}}]}:{}),
      mark:{type:'point',filled:true,size:34},encoding:{...axes,color:{field:'outcome',type:'nominal',scale:{domain:['Hit','Miss'],range:['#387d87','#bd5b2f']}},
      opacity:interactive?{condition:{param:'picked',value:.72},value:.15}:{value:.5},tooltip}},
    {data:{name:'fit'},mark:{type:'line',strokeWidth:2.5,color:'#283936',clip:true},encoding:{...axes,detail:{field:'series'},tooltip:[{field:'label',title:'Fit settings'},{field:'n',title:'Successful first attempts'},{field:'r2',title:'R²',format:'.2f'},{field:'a',title:'Intercept (ms)',format:'.1f'},{field:'b',title:'Slope',format:'.1f'}]}}
  ]};
}
export function heroSpec({height=300,extent=2000,mix=1}={}){
  const x={field:'plot_x',type:'quantitative',title:null,scale:{domain:[0,1]},axis:{values:[0,.2,.4,.6,.8,1],labelExpr:"encodingMix > .999 ? format(datum.value*7,'.1f') : encodingMix < .001 ? format(datum.value*960,'.0f') : ''"}};
  const y={field:'acquisition_ms',type:'quantitative',title:'Acquisition time (ms)',scale:{domain:[0,extent]}};
  return {...base(height),params:[{name:'encodingMix',value:mix}],
    layer:[
      {params:[{name:'selectedPerson',select:{type:'point',fields:['participant_id'],on:'click',clear:'dblclick'}}],data:{name:'trials'},transform:[{calculate:'(1-encodingMix)*datum.distance/960 + encodingMix*datum.index_difficulty/7',as:'plot_x'}],mark:{type:'point',filled:true,size:28},encoding:{x,y,color:{field:'outcome',scale:{domain:['Hit','Miss'],range:['#387d87','#bd5b2f']}},opacity:{condition:{param:'selectedPerson',value:.4},value:.06},tooltip}},
      {data:{name:'means'},transform:[{calculate:'(1-encodingMix)*datum.distance/960 + encodingMix*datum.index_difficulty/7',as:'plot_x'}],mark:{type:'point',filled:true,size:70,stroke:'white',strokeWidth:1},encoding:{x,y,color:{value:'#203455'},opacity:{condition:{param:'selectedPerson',value:.95},value:.2},tooltip:[...tooltip,{field:'n',title:'Successful first attempts'}]}},
      {data:{name:'fit'},transform:[{calculate:'(1-encodingMix)*datum.distance/960 + encodingMix*datum.index_difficulty/7',as:'plot_x'}],mark:{type:'line',strokeWidth:2.5,color:'#283936',clip:true},encoding:{x,y,detail:{field:'series'},tooltip:[{field:'label',title:'Fit settings'},{field:'n'},{field:'r2',title:'R²',format:'.2f'}]}}
    ]};
}
export function pathSpec(){return{...base(190),data:{name:'paths'},layer:[
  {data:{values:[{}]},mark:{type:'rule',color:'#b8c3d4',strokeDash:[4,4]},encoding:{x:{datum:1,type:'quantitative'}}},
  {mark:{type:'line',strokeWidth:1.6,opacity:.55},encoding:{x:{field:'along',type:'quantitative',title:'Progress toward target (1 = center)',axis:{tickCount:6,format:'.1f'},scale:{domain:[-.1,1.3]}},y:{field:'across',type:'quantitative',title:'Deviation (CSS px)',axis:{format:'.0f',tickCount:5}},detail:{field:'id'},order:{field:'order'},color:{field:'outcome',scale:{domain:['Hit','Miss'],range:['#387d87','#bd5b2f']},legend:null},tooltip:[{field:'time',title:'Time (ms)',format:'.0f'}]}}
]};}
export function speedSpec(){return{...base(190),data:{name:'speeds'},mark:{type:'line',opacity:.6,strokeWidth:1.5,color:'#387d87'},encoding:{x:{field:'time',type:'quantitative',title:'Time since target activation (ms)'},y:{field:'speed',type:'quantitative',title:'Cursor speed (CSS px/s)'},detail:{field:'id'},order:{field:'time'},tooltip:[{field:'time',format:'.0f'},{field:'speed',format:'.0f'}]}};}
export function endpointsSpec(shape='rect',extent=2){
  const target=shape==='circle'?Array.from({length:65},(_,i)=>({x:Math.cos(i*2*Math.PI/64),y:Math.sin(i*2*Math.PI/64),order:i})):[{x:-1,y:-1,order:0},{x:1,y:-1,order:1},{x:1,y:1,order:2},{x:-1,y:1,order:3},{x:-1,y:-1,order:4}];
  const enc={x:{field:'x',type:'quantitative',title:'Horizontal / half-width',scale:{domain:[-extent,extent]}},y:{field:'y',type:'quantitative',title:'Vertical / half-height',scale:{domain:[-extent,extent],reverse:true}}};
  return{...base(190),layer:[{data:{values:target},mark:{type:'line',color:'#a7b6cd',strokeWidth:1.5},encoding:{...enc,order:{field:'order'}}},{data:{name:'endpoints'},mark:{type:'point',filled:true,size:44,opacity:.65},encoding:{...enc,color:{field:'outcome',scale:{domain:['Hit','Miss'],range:['#387d87','#bd5b2f']},legend:null},tooltip:[{field:'trial'},{field:'outcome'},{field:'acquisition_ms',format:'.0f'}]}}]};
}
export function boundarySpec(){return{...base(230),data:{name:'boundaries'},layer:[
  {transform:[{joinaggregate:[{op:'count',as:'pair_count'}],groupby:['comparison_key']},{filter:'datum.pair_count === 2'},
    {aggregate:[{op:'mean',field:'acquisition_ms',as:'acquisition_ms'},{op:'count',as:'participants'}],groupby:['summary_key','variant','order']}],
    mark:{type:'line',strokeWidth:3,color:'#283936',point:{filled:true,size:80}},encoding:{x:{field:'variant',type:'nominal',sort:['menu-floating','menu-edge','corner-floating','corner-edge']},y:{field:'acquisition_ms',type:'quantitative'},detail:{field:'summary_key'},order:{field:'order'},tooltip:[{field:'variant'},{field:'acquisition_ms',title:'Paired participant mean (ms)',format:'.0f'},{field:'participants',title:'Complete pairs'}]}},
  {mark:{type:'line',opacity:.25,color:'#8492a8'},encoding:{x:{field:'variant',type:'nominal',sort:['menu-floating','menu-edge','corner-floating','corner-edge'],title:null,axis:{labelAngle:-18,labelExpr:"{'menu-floating':'Menu: free','menu-edge':'Menu: edge','corner-floating':'Window: free','corner-edge':'Window: edges'}[datum.label]"}},y:{field:'acquisition_ms',type:'quantitative',title:'Mean acquisition time (ms)',scale:{zero:true}},detail:{field:'comparison_key'},order:{field:'order'}}},
  {mark:{type:'point',filled:true,size:66,color:'#387d87'},encoding:{x:{field:'variant',type:'nominal',sort:['menu-floating','menu-edge','corner-floating','corner-edge']},y:{field:'acquisition_ms',type:'quantitative'},tooltip:[{field:'participant_label'},{field:'variant'},{field:'app_version',title:'Protocol version'},{field:'acquisition_ms',format:'.0f'},{field:'error_rate',title:'First-attempt error rate',format:'.0%'},{field:'n',title:'First attempts'}]}}
]};}
