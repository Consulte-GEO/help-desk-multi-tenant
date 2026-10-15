import {registrationFailure} from '../../domain/registration-canonical.ts';
/** Transport limits, not the canonical business-JSON profile. Provider costs may
 * be finite decimals. Duplicate decoded members are rejected BEFORE JSON decoding
 * can silently discard them, including members in provider metadata. */
export const CLAUDE_JSON_LIMITS=Object.freeze({bytes:262144,depth:24,nodes:8192,members:128,items:1024,stringBytes:65536});
export function decodeClaudeJson(input:Uint8Array):unknown {
 const fail=():never=>{throw registrationFailure('registration_cli_output_invalid',422);};
 try {
  if(!(input instanceof Uint8Array)||input.byteLength===0||input.byteLength>CLAUDE_JSON_LIMITS.bytes)return fail();
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new Uint8Array(input));
  let i=0,nodes=0;
  const space=()=>{while(i<text.length&&/[\x20\x09\x0a\x0d]/.test(text[i]!))i++;};
  const string=():string=>{
   if(text[i]!== '"')return fail();const start=i++;
   while(i<text.length){
    const ch=text[i++];if(ch==='\\'){i++;continue;}
    if(ch==='"'){
     const value:unknown=JSON.parse(text.slice(start,i));
     if(typeof value!=='string'||/[\u0000\p{Cs}]/u.test(value)||Buffer.byteLength(value)>CLAUDE_JSON_LIMITS.stringBytes)return fail();
     return value;
    }
   }
   return fail();
  };
  const value=(depth:number):unknown=>{
   if(++nodes>CLAUDE_JSON_LIMITS.nodes||depth>CLAUDE_JSON_LIMITS.depth)return fail();space();const ch=text[i];
   if(ch==='"')return string();
   if(ch==='{'){
    i++;space();const result:Record<string,unknown>=Object.create(null),seen=new Set<string>();
    if(text[i]==='}'){i++;return result;}
    while(i<text.length){
     space();const key=string();if(seen.has(key)||['__proto__','prototype','constructor'].includes(key)||seen.size>=CLAUDE_JSON_LIMITS.members)return fail();seen.add(key);
     space();if(text[i++]!==':')return fail();result[key]=value(depth+1);space();const separator=text[i++];
     if(separator==='}')return result;if(separator!==',')return fail();
    }
    return fail();
   }
   if(ch==='['){
    i++;space();const result:unknown[]=[];if(text[i]===']'){i++;return result;}
    while(i<text.length){if(result.length>=CLAUDE_JSON_LIMITS.items)return fail();result.push(value(depth+1));space();const separator=text[i++];if(separator===']')return result;if(separator!==',')return fail();}
    return fail();
   }
   for(const [token,v] of [['true',true],['false',false],['null',null]] as const)if(text.startsWith(token,i)){i+=token.length;return v;}
   const number=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;number.lastIndex=i;const match=number.exec(text);
   if(!match)return fail();i=number.lastIndex;const n=Number(match[0]);return Number.isFinite(n)?n:fail();
  };
  const result=value(0);space();if(i!==text.length||result===null||typeof result!=='object'||Array.isArray(result))return fail();return result;
 }catch{return fail();}
}
