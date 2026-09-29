/** Small IndexedDB store. Callers keep an in-memory copy; failures stay visible in the UI. */
const DB_NAME='fitts-lab-v1';let opening;
function db(){return opening??=(new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{for(const n of ['trials','sets','meta','outbox','localClass'])r.result.createObjectStore(n,{keyPath:'id'});};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close older Fitts Lab tabs to update local storage.'));
}));}
async function transaction(store,mode,operation){const d=await db();return new Promise((resolve,reject)=>{
  const tx=d.transaction(store,mode),s=tx.objectStore(store);let result;
  try{const req=operation(s);if(req){req.onsuccess=()=>{result=req.result;};req.onerror=()=>reject(req.error);}}catch(e){reject(e);return;}
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Local save aborted.'));
});}
export const put=(s,v)=>transaction(s,'readwrite',o=>o.put(v));
export const get=(s,id)=>transaction(s,'readonly',o=>o.get(id));
export const all=s=>transaction(s,'readonly',o=>o.getAll());
export const remove=(s,id)=>transaction(s,'readwrite',o=>o.delete(id));
export const clear=s=>transaction(s,'readwrite',o=>o.clear());
export async function putMany(s,rows){return transaction(s,'readwrite',o=>{for(const r of rows)o.put(r);});}
export async function removeMany(s,ids){return transaction(s,'readwrite',o=>{for(const id of ids)o.delete(id);});}
const memoryPreferences=new Map();
export function saved(key,fallback){try{return JSON.parse(localStorage.getItem('fitts:'+key))??memoryPreferences.get(key)??fallback;}catch{return memoryPreferences.get(key)??fallback;}}
export function save(key,value){memoryPreferences.set(key,value);try{localStorage.setItem('fitts:'+key,JSON.stringify(value));}catch{/* Preferences remain usable for this tab; participant storage reports persistence failures separately. */}}
export function identity(){let id=saved('identity',null);if(!id){id=crypto.randomUUID();save('identity',id);}return id;}

/** Delete only one round, atomically across its local stores. */
export async function clearParticipantRun(runId){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(['trials','sets','outbox'],'readwrite');
    for(const name of ['trials','sets','outbox']){
      const request=tx.objectStore(name).openCursor();
      request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const row=cursor.value;
        if((name==='sets'?row.options?.runId:name==='outbox'?row.trial?.run_id:row.run_id)===runId)cursor.delete();cursor.continue();};
    }
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Local reset aborted.'));
  });
}
export const localResetKey=(participantId,runId)=>`reset-run:${participantId}:${runId}`;
export async function resetLocalRun(roomId,participantId,runId){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(['meta','localClass'],'readwrite');
    tx.objectStore('meta').put({id:localResetKey(participantId,runId)});
    const request=tx.objectStore('localClass').openCursor();
    request.onsuccess=()=>{const c=request.result;if(!c)return;const row=c.value;
      if(row.kind==='trial'&&row.room_id===roomId&&row.data.participant_id===participantId&&row.data.run_id===runId)c.delete();c.continue();};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
/** The tombstone check and insert share a transaction with local reset. */
export async function putLocalTrial(roomId,row){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(['meta','localClass'],'readwrite');let inserted=false;
    const request=tx.objectStore('meta').get(localResetKey(row.participant_id,row.run_id));
    request.onsuccess=()=>{if(request.result)return;tx.objectStore('localClass').put({id:'trial:'+roomId+':'+row.id,kind:'trial',room_id:roomId,data:row});inserted=true;};
    tx.oncomplete=()=>resolve(inserted);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
