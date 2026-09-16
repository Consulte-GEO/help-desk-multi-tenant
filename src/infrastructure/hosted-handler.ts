import {HelpdeskError} from '../domain/errors.ts';
import {problemResponse,diagnosticProblemCode} from '../http/handler.ts';
import {httpObservation,notifyObserver,requestIdFor} from '../observability/http.ts';
import type {HttpObserver} from '../observability/http.ts';
import type {TrustedRequestContext} from './rate-limit.ts';
type Runtime=(request:Request,context?:TrustedRequestContext)=>Promise<Response>;
/** Lazy host boundary: one shared initialization, failed startup can be retried, no duplicate success log. */
export function createHostedHandler(factory:()=>Promise<Runtime>,observe?:HttpObserver):Runtime {
 let pending:Promise<Runtime>|undefined;
 const getRuntime=()=>{
  if(!pending){const created=Promise.resolve().then(factory);pending=created;
   void created.catch(()=>{if(pending===created)pending=undefined;});}
  return pending;
 };
 return async(request,context={})=>{
  const started=performance.now();let phase:'bootstrap'|'dispatch'='bootstrap';
  try{const runtime=await getRuntime();phase='dispatch';return await runtime(request,context);}
  catch(error){const requestId=requestIdFor(request);
   const safe=error instanceof HelpdeskError?error:new HelpdeskError(503,'backend_unavailable','Backend ainda indisponível. Nenhum dado de demonstração foi carregado.');
   const response=problemResponse(safe,requestId);
   notifyObserver(observe,httpObservation({request,requestId,status:response.status,errorCode:diagnosticProblemCode(response),phase,started,finished:performance.now()}));
   return response;
  }
 };
}
