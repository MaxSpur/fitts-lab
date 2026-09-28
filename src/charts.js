import {embed,vega} from '../vendor/index.js';
import {noData,showCode} from './ui.js';
/** Serialize View pulses and invalidate queued updates when the source changes. */
export class Chart {
  constructor(el){this.el=typeof el==='string'?document.querySelector(el):el;this.result=null;this.queue=Promise.resolve();this.spec=null;this.rows={};this.generation=0;
    this.observer=new ResizeObserver(()=>{const g=this.generation;this.queue=this.queue.catch(()=>{}).then(()=>g===this.generation?this.result?.view.resize().runAsync():undefined).catch(console.error);});this.observer.observe(this.el);}
  async set(spec,datasets={}){
    const g=++this.generation;this.spec=structuredClone(spec);this.rows=datasets;
    this.queue=this.queue.catch(()=>{}).then(async()=>{if(g!==this.generation)return;this.result?.finalize();this.result=null;this.el.innerHTML='';const result=await embed(this.el,{...spec,datasets:structuredClone(datasets)},{renderer:'canvas',actions:false,tooltip:true});
      if(g!==this.generation){result.finalize();return;}this.result=result;
      for(const [name,rows]of Object.entries(datasets))result.view.change(name,vega.changeset().remove(()=>true).insert(structuredClone(rows)));await result.view.runAsync();});return this.queue;
  }
  async update(datasets){const g=this.generation;this.rows={...this.rows,...datasets};this.queue=this.queue.catch(()=>{}).then(async()=>{if(g!==this.generation||!this.result)return;for(const[name,rows]of Object.entries(datasets))this.result.view.change(name,vega.changeset().remove(()=>true).insert(structuredClone(rows)));await this.result.view.runAsync();});return this.queue;}
  code(){if(!this.spec)return;const spec=structuredClone(this.spec);spec.datasets=structuredClone(this.rows);showCode(spec);}
  empty(message){++this.generation;this.result?.finalize();this.result=null;this.spec=null;this.rows={};noData(this.el,message);}
  destroy(){++this.generation;this.result?.finalize();this.observer.disconnect();}
}
