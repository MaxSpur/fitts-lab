import {CONFIG} from '../config.js';
import {resultsRequest} from './overview-client.js';
// Discovery is independent of participant joining. Never create a membership on a read.
if(CONFIG.supabaseUrl&&document.querySelector('#join-class')){
  const anchor=document.createElement('a');anchor.className='overview-link';anchor.textContent='View class results →';anchor.href='./overview.html';anchor.hidden=true;document.querySelector('#join-class').parentElement.prepend(anchor);
  let timer,busy=false;async function check(){if(document.hidden||busy)return;busy=true;try{const r=await resultsRequest('published-room');anchor.hidden=!r.room;anchor.title=r.room?.title||'';}catch{anchor.hidden=true;}finally{busy=false;clearTimeout(timer);timer=setTimeout(check,20000);}}
  check();document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)check();});
}
