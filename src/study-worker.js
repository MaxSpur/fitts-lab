import {analyze} from './study.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:analyze(data.rows,data.options)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
