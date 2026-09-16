import {HelpdeskError} from '../domain/errors.ts';

/** A server adapter may provide an empty stream even when the wire has no body. */
export async function requireEmptyBody(req:Request,options:{timeoutMs?:number}={}):Promise<void>{
 const timeoutMs=options.timeoutMs??5000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw Error('Invalid empty-body deadline');
 const invalid=()=>new HelpdeskError(400,'invalid_input','Esta operação não aceita conteúdo no corpo.');
 const declared=req.headers.get('content-length');
 if(declared!==null&&declared!=='0')throw invalid();
 const reader=req.body?.getReader();if(!reader)return;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new HelpdeskError(408,'body_timeout','Tempo limite de recebimento do corpo excedido.')),timeoutMs);});
 try{
  // No content is retained. Bound empty chunks too, so a broken synthetic stream cannot spin.
  for(let chunks=0;chunks<16;chunks++){
   const result=await Promise.race([reader.read(),expired]);
   if(result.done)return;
   if(result.value.byteLength!==0)throw invalid();
  }
  throw invalid();
 }catch(error){
  void reader.cancel().catch(()=>{});
  if(error instanceof HelpdeskError)throw error;
  throw invalid();
 }finally{clearTimeout(timer);reader.releaseLock();}
}
