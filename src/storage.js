import {initial,migrate,uid} from './finance.js';

const DB='mydearmoney', VERSION=2;
function open() { return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,VERSION);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('documents')) req.result.createObjectStore('documents');};
  req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
}); }
async function access(mode,callback) { const db=await open(); return new Promise((resolve,reject)=>{
  const tx=db.transaction('documents',mode), store=tx.objectStore('documents');
  let result; try {result=callback(store);} catch(e) {db.close();reject(e);return;}
  tx.oncomplete=()=>{db.close();resolve(result?.result);}; tx.onerror=()=>{db.close();reject(tx.error);};
}); }
export async function load() {return migrate((await access('readonly',store=>store.get('state'))) || initial());}
export async function save(state) {await access('readwrite',store=>store.put(state,'state'));}
export async function mutate(state,action,entity,detail={}) {
  state.audit.push({id:uid(),at:new Date().toISOString(),action,entity,detail});
  await save(state); return state;
}
export function backup(state) {return JSON.stringify({format:'MyDearMoney',version:2,exportedAt:new Date().toISOString(),data:state},null,2);}
export function restore(text) {const raw=JSON.parse(text); if(raw.format!=='MyDearMoney'||![1,2].includes(raw.version)) throw new Error('Formato de backup não reconhecido.'); return migrate(raw.data);}
