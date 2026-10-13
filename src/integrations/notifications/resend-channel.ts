import type {NotificationChannel} from '../../application/outbox-dispatch.ts';
import {deliveryFailure,notificationRef} from '../../domain/notification-delivery.ts';
const endpoint='https://api.resend.com/emails';
const invalidConfig=()=>deliveryFailure('resend_configuration_required');
const unknown=()=>deliveryFailure('resend_delivery_unknown');
const safeText=(s:unknown,max:number)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\p{Cc}\p{Cs}]/u.test(s);
const email=(s:unknown)=>safeText(s,254)&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(s as string);
const providerId=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
async function responseJson(response:Response):Promise<Record<string,unknown>>{
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')||!response.body)throw unknown();
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let count=0;
 try{for(;;){const next=await reader.read();if(next.done)break;count+=next.value.byteLength;if(count>32768)throw unknown();parts.push(next.value);}}
 catch{await reader.cancel().catch(()=>{});throw unknown();}finally{reader.releaseLock();}
 const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw unknown();return value;}catch{throw unknown();}
}
/** Resend transport only. The existing dispatcher owns ACL, durable identity, leases and retries.
 * Native API responses do not invent delivery sequence/time. lookupEvidence must read correlated
 * authenticated evidence; absence remains unknown, including when an acceptance ID was lost.
 */
export function createResendNotificationChannel(input:{id:string;apiKey:string;from:string;fetch?:typeof fetch;lookupEvidence?:NotificationChannel['lookup']}):NotificationChannel{
 try{notificationRef(input.id);if(!safeText(input.apiKey,512)||!safeText(input.from,320))throw invalidConfig();
  const address=/<([^<>]+)>$/.exec(input.from)?.[1]??input.from;if(!email(address)||/[;,]/.test(input.from))throw invalidConfig();
 }catch{throw invalidConfig();}
 const id=input.id,key=input.apiKey,from=input.from,transport=input.fetch??globalThis.fetch,evidence=input.lookupEvidence;
 const channel:NotificationChannel={id,
  async send(message,signal){
   if(!email(message.to)||!safeText(message.subject,160)||typeof message.text!=='string'||!message.text.trim()||message.text.length>20000||typeof message.html!=='string'||!message.html.trim()||message.html.length>64000||!/^[a-f0-9]{64}$/.test(message.idempotencyKey))throw deliveryFailure('invalid_resend_message',400);
   if(signal.aborted)throw unknown();
   let response:Response;try{response=await transport(endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text,html:message.html}),signal});}catch{throw unknown();}
   if(signal.aborted||response.status>=500||response.status===409)throw unknown();
   const body=await responseJson(response);if(signal.aborted)throw unknown();
   if(response.ok&&providerId(body.id))return Object.freeze({state:'accepted',providerMessageId:(body.id as string).toLowerCase()});
   if(response.status===429&&body.name==='rate_limit_exceeded'&&!Object.hasOwn(body,'id'))return Object.freeze({state:'not_accepted',retryable:true,reason:'rate_limited'});
   if([400,401,403,422].includes(response.status)&&['validation_error','missing_api_key','invalid_api_key','restricted_api_key'].includes(String(body.name))&&!Object.hasOwn(body,'id'))return Object.freeze({state:'not_accepted',retryable:false,reason:'rejected'});
   throw unknown();
  },
  async lookup(intent,signal){if(signal.aborted)throw unknown();return evidence?await evidence(intent,signal):null;}
 };
 return Object.freeze(channel);
}
