import {Dashboard} from './dashboard.js';
import {PublicReader} from './overview-client.js';
import {common,text,download,csv} from './ui.js';
import {VERSION} from './protocol.js';
common();const dashboard=new Dashboard(document.querySelector('#dashboard'));let snapshot=null;
const csvButton=document.querySelector('#overview-export-csv'),jsonButton=document.querySelector('#overview-export-json');
const params=new URLSearchParams(location.search),reader=new PublicReader({roomId:params.get('room'),onData:(rows,people,room)=>{snapshot={schema_version:1,app_version:VERSION,source:'public',room,participants:people,trials:rows};csvButton.disabled=jsonButton.disabled=false;text('#overview-title',room.title);dashboard.setSnapshot(rows,people,room,{source:'public'});},onClear:m=>{snapshot=null;csvButton.disabled=jsonButton.disabled=true;dashboard.clear(m);text('#overview-title','Class results');},onStatus:m=>text('#overview-status',m)});
csvButton.onclick=()=>{if(snapshot)download('fitts-public-trials.csv',csv(snapshot.trials),'text/csv;charset=utf-8');};jsonButton.onclick=()=>{if(snapshot)download('fitts-public-session.json',{...snapshot,exported_at:new Date().toISOString()});};
reader.start();document.addEventListener('visibilitychange',()=>{reader.stop();if(!document.hidden)reader.start();});window.addEventListener('pagehide',()=>reader.stop());
