import {HelpdeskError} from '../domain/errors.ts';
const mutations=new Set(['POST','PUT','PATCH','DELETE']);
const refuse=()=>new HelpdeskError(428,'precondition_required','Confirme uma única versão válida antes de enviar a solicitação.');
/** Transport compatibility only. The existing route still validates its own
 * version range, caller, scope and atomic compare-and-swap. Never infer a version
 * from a body, database or current state; never retry a mutation here. */
export function restoreHostedVersionPrecondition(request:Request):Request{
 if(!mutations.has(request.method)||!new URL(request.url).pathname.startsWith('/v1/'))return request;
 const carrier=request.headers.get('x-helpdesk-if-match');if(carrier===null)return request;
 const match=/^"(0|[1-9]\d*)"$/.exec(carrier),native=request.headers.get('if-match');
 if(carrier.length>20||!match||!Number.isSafeInteger(Number(match[1]))||native!==null&&native!==carrier)throw refuse();
 const headers=new Headers(request.headers);headers.set('if-match',carrier);headers.delete('x-helpdesk-if-match');
 return new Request(request,{headers});
}
