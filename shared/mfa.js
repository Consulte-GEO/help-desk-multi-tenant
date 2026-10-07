/** Transport/catalog hygiene. JWT parsing here never verifies a signature or grants access. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function verifiedMfaFactors(value){
 if(value===undefined)return Object.freeze([]);
 if(!Array.isArray(value)||value.length>20)throw Error('Invalid factor catalog');
 const seen=new Set(),result=[];
 for(const factor of value){
  if(!factor||typeof factor!=='object'||Array.isArray(factor)||typeof factor.id!=='string'||!UUID.test(factor.id)||!['verified','unverified'].includes(factor.status)||!['totp','phone','webauthn','recovery_code'].includes(factor.factor_type))throw Error('Invalid factor catalog');
  const id=factor.id.toLowerCase();if(seen.has(id))throw Error('Duplicate factor');seen.add(id);
  if(factor.status==='verified')result.push(Object.freeze({id,type:factor.factor_type}));
 }
 return Object.freeze(result);
}
/** Backend may use these claims only AFTER the exact bearer is validated by Auth /user. */
function matchingClaims(token,userId,at){
 try{
  if(typeof token!=='string'||token.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||!Number.isFinite(at))return false;
  const part=token.split('.')[1],base64=part.replaceAll('-','+').replaceAll('_','/');
  const bytes=Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return payload&&typeof payload==='object'&&!Array.isArray(payload)&&typeof payload.sub==='string'&&payload.sub.toLowerCase()===userId&&Number.isSafeInteger(payload.exp)&&payload.exp>Math.floor(at/1000)?payload:null;
 }catch{return null;}
}
export function hasAal2Claims(token,userId,at){return matchingClaims(token,userId,at)?.aal==='aal2';}
/** Hygiene for own-credential cleanup only; never substitutes authentication. */
export function sameUserClaims(token,userId,at){return !!matchingClaims(token,userId,at);}

/** Advisory UI snapshot only; parsing does not verify a signature. */
export function sessionAssuranceLevel(token,userId,at){const aal=matchingClaims(token,userId,at)?.aal;return ['aal1','aal2'].includes(aal)?aal:'unknown';}
