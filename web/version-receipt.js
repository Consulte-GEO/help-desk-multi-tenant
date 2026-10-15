const canonical=tag=>typeof tag==='string'&&tag.length<=20&&/^"(0|[1-9]\d*)"$/.test(tag)&&Number.isSafeInteger(Number(tag.slice(1,-1)));
const unavailable=()=>new Error('Confirmação da revisão indisponível.');
/** Business revision receipt, distinct from the host's representation ETag.
 * Legacy responses retain their strict original behavior. Every caller still
 * checks the returned body, identity and exact expected revision. */
export function readVersionReceiptHeader(response){
 const native=response.headers.get('etag'),carrier=response.headers.get('x-helpdesk-etag');
 if(carrier===null)return native;if(!canonical(carrier))throw unavailable();
 const comparison=native?.startsWith('W/')?native.slice(2):native;
 if(canonical(comparison)&&comparison!==carrier)throw unavailable();
 return carrier;
}
