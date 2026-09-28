import {ARENA,VERSION,HORIZONTAL_BLOCK_SIZE,BUTTON_SETS,boundaryFrame,targetFor,horizontalPair,homeFor,boundsFor,isBoundary} from './protocol.js';
import {distance,hitTarget,approachWidth,shannon,round,downsample,constrainedMove,jitterAt,clamp} from './math.js';

/** Experiment state machine, independent of the DOM and the network.
 * A selection is a PRIMARY-BUTTON PRESS. The initial/home selection is unscored.
 * Misses stay on the same target and are retained as separate attempts.
 */
export class TrialEngine {
  constructor(plan,options={},callbacks={}){
    this.plan={...plan};this.options={scale:1,perturbation:'normal',gain:1,seed:1,jitter:3,inputMode:'native',device:'unspecified',...options};
    this.callbacks=callbacks;this.id=options.setId||crypto.randomUUID();this.count=options.completed||0;
    this.state='ready';this.attempt=1;this.path=[];this.lastPath=[];this.interruptions=[];
    this.home=this.getHome();this.target=targetFor(plan,plan.task==='interfaces'&&!plan.positions?this.count:this.count+1);
  }
  getHome(){return homeFor(this.plan,this.count);}
  notify(){this.callbacks.status?.(this);}
  activate(){if(this.count>=this.plan.count)return;this.state='armed';this.home=this.getHome();this.path=[];this.notify();}
  begin(p,now){this.state='running';this.start={...p};this.started=now;this.path=[{...p,t:0}];this.attempt=1;this.movementId=crypto.randomUUID();this.target=targetFor(this.plan,this.plan.task==='interfaces'&&!this.plan.positions?this.count:this.count+1);this.notify();}
  sample(p,now){if(this.state!=='running')return;const last=this.path.at(-1);if(!last || now-this.started-last.t>=12){this.path.push({...p,t:now-this.started});if(this.path.length>4096)this.path=downsample(this.path,2048);}}
  click(p,now){
    if(this.state==='armed'){if(this.plan.task==='interfaces'&&this.plan.positions?hitTarget(p,this.home):distance(p,this.home)<=20)this.begin(p,now);return null;}
    if(this.state!=='running')return null;
    this.path.push({...p,t:now-this.started});
    const t=this.target,s=this.options.scale,ok=hitTarget(p,t),duration=now-this.started;
    const dx=t.x-this.start.x,dy=t.y-this.start.y;
    const w=t.shape==='circle'?t.w:approachWidth(t.w,t.h,dx,dy);
    const d=Math.hypot(dx,dy),boundary=isBoundary(this.plan),o=this.options;
    const nominal=distance(this.getHome(),t);
    const condition=this.plan.task==='horizontal'&&this.plan.positions?
      `horizontal-${Math.round(nominal)}-${this.plan.width}`:this.plan.task==='interfaces'&&!this.plan.custom&&/^(menu|corner)-/.test(this.plan.variant)&&this.plan.positions?
      `${this.plan.variant}-${this.count%2?'between':'control'}`:this.plan.condition;
    const r={schema_version:1,source:'participant',app_version:VERSION,id:crypto.randomUUID(),set_id:this.id,movement_id:this.movementId,
      ...(o.runId?{run_id:o.runId,run_number:o.runNumber}:{}),participant_id:o.participantId,participant_label:o.participantLabel,room_id:o.roomId||null,
      task:this.plan.task,variant:this.plan.variant,condition,target_index:this.count,attempt:this.attempt,
      hit:ok,practice:!!o.practice,perturbation:o.perturbation,jitter_css_px:o.perturbation==='jitter'?o.jitter:0,gain:o.gain,seed:o.seed,
      distance:round(d*s),nominal_distance:round(nominal*s),target_w:round(t.w*s),target_h:round(t.h*s),
      approach_width:round(w*s),index_difficulty:boundary?null:shannon(d,w),
      acquisition_ms:round(duration),completion_ms:ok?round(duration):null,
      start_x:round(this.start.x*s),start_y:round(this.start.y*s),target_x:round(t.x*s),target_y:round(t.y*s),click_x:round(p.x*s),click_y:round(p.y*s),
      input_mode:o.inputMode,device:o.device,viewport_width:round(ARENA.width*s),dpr:o.dpr||1,created_at:new Date().toISOString(),
      path:downsample(this.path,120).map(p=>({x:round(p.x*s,2),y:round(p.y*s,2),t:round(p.t,1)}))};
    this.lastPath=[...this.path];this.callbacks.record?.(r);
    if(ok){
      this.count++;
      if(this.count>=this.plan.count){this.state='complete';this.notify();this.callbacks.complete?.(this);}
      else if(this.plan.task==='interfaces'&&!this.plan.positions||this.plan.task==='horizontal'&&!this.plan.positions&&this.count%HORIZONTAL_BLOCK_SIZE===0){
        this.state='armed';this.home=this.getHome();this.notify();
      }
      else{this.begin(p,now);}
    }else{this.attempt++;this.notify();}
    return r;
  }
  pause(reason='Pointer released'){
    if(!['armed','running'].includes(this.state))return;
    if(this.state==='running')this.interruptions.push({movement_id:this.movementId,target_index:this.count,reason,at:new Date().toISOString()});
    this.state='paused';this.path=[];this.notify();
  }
}

/** Canvas is exclusively for the measured interaction. Analysis uses Vega-Lite. */
export class ArenaController {
  constructor(canvas,callbacks={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.trace=canvas.parentElement.querySelector('#trace-layer');this.traceCtx=this.trace?.getContext('2d');this.cursor=canvas.parentElement.querySelector('#virtual-cursor');this.callbacks=callbacks;
    this.pos={x:480,y:230};this.frame=null;this.mode='native';this.ignoreNextMove=false;this.traceDirty=true;this.lastTraceAt=0;
    this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);
    document.addEventListener('pointerlockchange',()=>this.lockChanged());
    document.addEventListener('pointerlockerror',()=>{if(this.pending){this.pending=false;this.callbacks.error?.('The browser declined pointer lock. Click Start again, allow the request, and keep this tab active. Ordinary tasks also support the native-cursor option.');}});
    document.addEventListener('mousemove',e=>this.move(e));
    document.addEventListener('mousedown',e=>this.press(e));
    document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'||e.key==='Escape')this.pause('Keyboard pause');});
    window.addEventListener('blur',()=>this.pause('Window lost focus'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause('Tab hidden');});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }
  set(plan,options={}){
    this.pause('Changed set');this.mode=options.inputMode||'native';
    this.engine=new TrialEngine(plan,{...options,scale:this.scale}, {
      record:r=>this.callbacks.record?.(r),
      status:e=>{this.draw();this.callbacks.status?.(e);},
      complete:e=>{this.release();this.stopLoop();this.callbacks.complete?.(e);this.draw();}
    });
    this.pos={...this.engine.home};this.draw();return this.engine;
  }
  resize(){
    const r=this.canvas.getBoundingClientRect(),scale=r.width/ARENA.width;
    if(this.engine&&Math.abs((this.scale||scale)-scale)>.001)this.pause('Experiment area resized');
    this.scale=scale||1;const dpr=Math.min(window.devicePixelRatio||1,2.5);
    this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.width*ARENA.height/ARENA.width*dpr);
    this.pixelScale=this.canvas.width/ARENA.width;
    if(this.trace){this.trace.width=Math.round(r.width);this.trace.height=Math.round(r.width*ARENA.height/ARENA.width);this.traceScale=this.trace.width/ARENA.width;}
    if(this.engine&& !['running','armed'].includes(this.engine.state))this.engine.options.scale=this.scale;
    this.draw();
  }
  start(){
    if(!this.engine||this.engine.state==='complete')return;
    if(this.mode==='native'){
      if(isBoundary(this.engine.plan)){this.callbacks.error?.('This simulated edge needs the captured cursor. Select Captured cursor in the settings.');return;}
      this.engine.activate();this.canvas.classList.add('native-active');this.startLoop();return;
    }
    if(!this.canvas.requestPointerLock){this.callbacks.error?.('This browser does not provide Pointer Lock. Use the system cursor for ordinary targets; simulated hard boundaries need a desktop browser with Pointer Lock.');return;}
    this.pending=true;
    // Request synchronously in the user gesture. Events remain authoritative for Safari variants.
    try{const result=this.canvas.requestPointerLock();if(result?.catch)result.catch(()=>{if(this.pending){this.pending=false;this.callbacks.error?.('Pointer lock was declined. Click Start again after releasing Escape; allow the browser request.');}});}catch(e){this.pending=false;this.callbacks.error?.(e.message);}
  }
  lockChanged(){
    if(document.pointerLockElement===this.canvas){this.pending=false;this.canvas.classList.add('locked');this.pos={...this.engine.home};this.ignoreNextMove=true;this.engine.activate();this.startLoop();}
    else{this.pending=false;this.canvas.classList.remove('locked');if(this.engine?.state!=='complete')this.engine?.pause('Pointer lock released');this.stopLoop();this.draw();}
  }
  release(){this.pending=false;this.canvas.classList.remove('native-active');if(this.cursor)this.cursor.style.display='none';if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
  pause(reason){this.engine?.pause(reason);this.release();this.stopLoop();this.draw();}
  active(){return this.engine&&['running','armed'].includes(this.engine.state)&&(this.mode==='native'||document.pointerLockElement===this.canvas);}
  bounds(){const b=boundsFor(this.engine.plan,this.engine.count);if(this.engine.plan.task==='horizontal')b.top=b.bottom=230;return b;}
  point(now){
    let p={...this.pos};const o=this.engine?.options;
    if(o?.perturbation==='jitter'&&this.active()){const j=jitterAt(now,o.seed,o.jitter/this.scale);p.x+=j.x;p.y+=j.y;}
    if(this.engine){const b=this.bounds();p.x=clamp(p.x,b.left,b.right);p.y=clamp(p.y,b.top,b.bottom);}return p;
  }
  showCursor(p){
    if(!this.cursor)return;
    if(!this.active()||this.mode!=='virtual'){this.cursor.style.display='none';return;}
    this.cursor.style.transform=`translate3d(${p.x*this.scale}px,${p.y*this.scale}px,0)`;
    if(this.cursor.style.display!=='block')this.cursor.style.display='block';
  }
  nativePoint(e){
    const r=this.canvas.getBoundingClientRect(),b=this.bounds();
    return {x:clamp((e.clientX-r.left)/this.scale,b.left,b.right),y:this.engine.plan.task==='horizontal'?230:clamp((e.clientY-r.top)/this.scale,b.top,b.bottom)};
  }
  move(e){
    if(!this.active())return;
    if(this.mode==='virtual'){
      // Safari may send a real first delta. Discard only an implausibly large
      // pointer-warp delta instead of losing the first deliberate movement.
      if(this.ignoreNextMove){this.ignoreNextMove=false;if(Math.abs(e.movementX)>ARENA.width/2||Math.abs(e.movementY)>ARENA.height/2)return;}
      this.pos=constrainedMove(this.pos,e.movementX*this.engine.options.gain/this.scale,e.movementY*this.engine.options.gain/this.scale,this.bounds());
    }
    else{if(e.target!==this.canvas)return;this.pos=this.nativePoint(e);}
    const now=performance.now(),p=this.point(now);this.engine.sample(p,now);this.showCursor(p);this.traceDirty=true;
  }
  press(e){
    if(e.button!==0||!this.active()||(this.mode==='native'&&e.target!==this.canvas))return;
    e.preventDefault();const now=performance.now();if(this.mode==='native')this.pos=this.nativePoint(e);this.engine.click(this.point(now),now);this.draw();
  }
  startLoop(){if(this.frame)return;const tick=()=>{this.frame=null;if(!this.active())return;
    const now=performance.now();
    if(this.engine.options.perturbation==='jitter'){const p=this.point(now);this.engine.sample(p,now);this.showCursor(p);this.traceDirty=true;}
    if(this.traceDirty&&now-this.lastTraceAt>=30){this.drawTrace();this.lastTraceAt=now;this.traceDirty=false;}
    this.frame=requestAnimationFrame(tick);};
    this.frame=requestAnimationFrame(tick);
  }
  stopLoop(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;}
  draw(){
    const c=this.ctx;if(!c||!this.canvas.width)return;
    c.setTransform(this.pixelScale,0,0,this.pixelScale,0,0);c.clearRect(0,0,960,460);c.fillStyle='#faf9f6';c.fillRect(0,0,960,460);
    if(!this.engine)return;const e=this.engine,p=e.plan;
    if(p.task==='horizontal'){
      c.strokeStyle='#d1d8e3';c.lineWidth=1;c.beginPath();c.moveTo(60,230);c.lineTo(900,230);c.stroke();
      if(p.positions){this.drawTarget(targetFor(p,Math.min(e.count,p.count)),false);
        if(e.count<p.count)this.drawTarget(targetFor(p,e.count+1),false);
      }else{
        const block=Math.min(Math.floor(e.count/HORIZONTAL_BLOCK_SIZE),Math.ceil(p.count/HORIZONTAL_BLOCK_SIZE)-1);
        for(const t of horizontalPair(p,block))this.drawTarget(t,false);
      }
      c.fillStyle='#798596';c.font='12px system-ui';c.textAlign='center';c.fillText('ONE-DIMENSIONAL TRACK · VERTICAL MOTION IGNORED',480,422);
    }else if(p.task==='circles'){
      c.strokeStyle='#d8e0e9';c.setLineDash([3,7]);c.beginPath();c.arc(480,230,p.distance/2,0,2*Math.PI);c.stroke();c.setLineDash([]);
      for(let i=0;i<12;i++)this.drawTarget(targetFor(p,i),false);
    }else if(BUTTON_SETS.includes(p.variant)){
      c.strokeStyle='#e0e4e9';c.lineWidth=1;c.strokeRect(44,54,872,350);
      if(e.state==='running')this.drawTarget(targetFor(p,e.count),false);
    }else if(p.positions&&/^(menu|corner)-/.test(p.variant)){
      const b=boundaryFrame(p),hard=isBoundary(p);
      c.strokeStyle=hard?'#ae432e':'#b8c0c3';c.lineWidth=hard?2:1;c.setLineDash(hard?[]:[5,5]);
      c.beginPath();c.moveTo(b.left,b.top);c.lineTo(b.right,b.top);
      if(p.variant.startsWith('corner')){c.moveTo(b.left,b.top);c.lineTo(b.left,b.bottom);}c.stroke();c.setLineDash([]);
      c.fillStyle='#6c7c90';c.font='12px system-ui';c.textAlign='left';c.fillText(hard?'BOUNDARY ON':'BOUNDARY OFF',b.left,46);
      if(e.state==='running')this.drawTarget(targetFor(p,e.count),false);
    }else{
      this.drawTarget(targetFor(p,e.count),false);
    }
    if(e.state==='running')this.drawTarget(e.target,true);
    if(['armed','ready','paused'].includes(e.state)){
      const h=e.home;
      if(p.task==='interfaces'&&p.positions){
        this.drawTarget(h,true);c.fillStyle='#a84735';c.font='12px system-ui';c.textAlign='center';c.fillText('START · unscored',h.x,h.y+h.h/2+20);
      }else{
        c.fillStyle='#f4e9e2';c.strokeStyle='#ae432e';c.lineWidth=2;c.beginPath();c.arc(h.x,h.y,20,0,Math.PI*2);c.fill();c.stroke();
        c.fillStyle='#ae432e';c.beginPath();c.arc(h.x,h.y,4,0,Math.PI*2);c.fill();
        c.font='13px system-ui';c.textAlign='center';c.fillText(p.task==='interfaces'?'HOME · click to begin':'CLICK TO BEGIN',h.x,h.y+40);
      }
    }
    this.drawTrace();
    this.showCursor(this.point(performance.now()));
    c.textAlign='left';c.font='12px ui-monospace,monospace';c.fillStyle='#738097';c.fillText(`${Math.min(e.count,p.count)} / ${p.count} selections`,24,30);
    if(this.active()){c.textAlign='right';c.fillText('ESC / P TO PAUSE',936,30);}
  }
  drawTrace(){
    const c=this.traceCtx,e=this.engine;if(!c||!this.trace?.width)return;
    c.setTransform(this.traceScale,0,0,this.traceScale,0,0);c.clearRect(0,0,ARENA.width,ARENA.height);
    if(!e)return;
    const stroke=(path,color,width)=>{if(path.length<2)return;c.strokeStyle=color;c.lineWidth=width;c.beginPath();
      const step=Math.max(1,Math.floor(path.length/350));c.moveTo(path[0].x,path[0].y);
      for(let i=step;i<path.length;i+=step)c.lineTo(path[i].x,path[i].y);
      c.lineTo(path.at(-1).x,path.at(-1).y);c.stroke();};
    stroke(e.lastPath,'rgba(140,67,49,.5)',2);
    if(e.state==='running')stroke(e.path,'rgba(140,67,49,.74)',2.2);
  }
  drawTarget(t,active){const c=this.ctx,kind=t.kind||'button';
    c.fillStyle=active?'#ae432e':kind==='field'?'#fff':kind==='link'||kind==='label'?'#fff':'#e5e8e5';
    c.strokeStyle=active?'#8b3525':kind==='link'||kind==='label'?'transparent':'#abb6b4';c.lineWidth=active?2:1.5;c.beginPath();
    if(t.shape==='circle')c.arc(t.x,t.y,t.w/2,0,Math.PI*2);else c.rect(t.x-t.w/2,t.y-t.h/2,t.w,t.h);c.fill();c.stroke();
    if(t.label){c.fillStyle=active?'#fff':kind==='link'?'#3159ef':'#243850';c.textAlign='center';c.textBaseline='middle';c.font=(kind==='icon'?'600 17px':'13px')+' system-ui';c.fillText(t.label,t.x,t.y,Math.max(12,t.w-8));c.textBaseline='alphabetic';}
    else if(active){c.fillStyle='#fff';c.beginPath();c.arc(t.x,t.y,2.5,0,Math.PI*2);c.fill();}
  }
}
