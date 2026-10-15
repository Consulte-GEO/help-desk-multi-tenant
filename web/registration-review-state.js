import {parseRegistrationReviewContext,parseRegistrationReviewView} from '../shared/registration-review.js';
/** Optional, read-only presentation controller. Host owns current authorization
 * and must abort sessionSignal on logout, context switch or access revocation.
 * No default HTTP route, token, storage, polling, approval or mutation exists. */
export function createRegistrationReviewState(options){
 const supplied=options.context,context=parseRegistrationReviewContext(supplied),stamp=JSON.stringify(context);
 const read=options.read,session=options.sessionSignal,onChange=options.onChange;
 if(typeof read!=='function'||!session||typeof session.aborted!=='boolean'||typeof session.addEventListener!=='function'||typeof session.removeEventListener!=='function')throw Error('Consulta do rascunho indisponível.');
 let phase='ready',view=null,epoch=0,flight=null,expiryTimer=null;
 const snapshot=()=>Object.freeze({phase,view});
 const report=()=>{try{const response=onChange?.(snapshot());if(response instanceof Promise)void response.catch(()=>{});}catch{/* Observation cannot change the read outcome. */}};
 const contextCurrent=()=>{try{return JSON.stringify(parseRegistrationReviewContext(supplied))===stamp;}catch{return false;}};
 function clear(){if(phase==='cleared')return;epoch++;phase='cleared';view=null;clearTimeout(expiryTimer);expiryTimer=null;const previous=flight;flight=null;
  if(previous){clearTimeout(previous.timer);previous.controller.abort();previous.resolve(snapshot());}
  session.removeEventListener('abort',clear);report();
 }
 function refresh(){
  if(session.aborted||!contextCurrent())clear();if(phase==='cleared')return Promise.resolve(snapshot());if(flight)return flight.promise;
  const generation=++epoch,started=performance.now(),controller=new AbortController();let resolve;
  const promise=new Promise(r=>{resolve=r;});flight={controller,promise,resolve,timer:null};
  phase='loading';view=null;clearTimeout(expiryTimer);expiryTimer=null;
  const finish=(next,data=null,ttl=0)=>{
   if(phase==='cleared'||generation!==epoch)return;
   if(!contextCurrent()||session.aborted){clear();return;}
   const previous=flight;flight=null;if(previous)clearTimeout(previous.timer);
   phase=next;view=data;
   if(ttl>0)expiryTimer=setTimeout(()=>{if(generation!==epoch||phase==='cleared')return;phase='expired';view=null;report();},ttl);
   report();previous?.resolve(snapshot());
  };
  flight.timer=setTimeout(()=>{controller.abort();finish('error');},15000);
  report();
  void Promise.resolve().then(()=>{
   if(controller.signal.aborted||phase==='cleared')return null;
   return read(context,controller.signal);
  }).then(raw=>{
   if(controller.signal.aborted||generation!==epoch||phase==='cleared')return;
   try{const parsed=parseRegistrationReviewView(raw,context),remaining=Date.parse(parsed.expiresAt)-Date.parse(parsed.observedAt)-(performance.now()-started);
    if(remaining<=0)finish('expired');else finish('loaded',parsed,remaining);
   }catch{finish('error');}
  },()=>{if(!controller.signal.aborted)finish('error');});
  return promise;
 }
 session.addEventListener('abort',clear,{once:true});if(session.aborted)clear();
 return Object.freeze({snapshot,refresh,clear});
}
