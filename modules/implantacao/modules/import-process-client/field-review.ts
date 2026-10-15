import {canonicalJson,copyJson,enumValue,fail,integer,parseField,parseSnapshot,record,text} from '../import-process/canonical.ts';
import type {CanonicalField,CanonicalRecord,Snapshot} from '../import-process/canonical.ts';

export type CorrectionValueType='text'|'number'|'boolean';
export interface FieldCorrection {
 recordId:string;field:string;expectedField:CanonicalField;
 presence:CanonicalField['presence'];value:string;valueType:CorrectionValueType;reason:string;
}
// Compare decimal intent with Number's shortest round-trip representation.
// This rejects rounding/underflow without rejecting ordinary decimals such as 33.1.
function decimalKey(value:string):string {
 const [mantissa,exponent='0']=value.toLowerCase().split('e');
 const negative=mantissa!.startsWith('-'),parts=mantissa!.replace(/^[+-]/,'').split('.');
 let digits=(parts[0]!+(parts[1]??'')).replace(/^0+/,'');
 if(!digits)return '0';
 let power=Number(exponent)-(parts[1]?.length??0);
 while(digits.endsWith('0')){digits=digits.slice(0,-1);power++;}
 return (negative?'-':'')+digits+':'+power;
}
/** Human correction of the final value only. Raw evidence, units and semantics are immutable here.
 * This records a proposal in a draft, NOT approval of a report, execution or server audit identity.
 */
export function correctSnapshotField(input:unknown,command:unknown):Snapshot {
 const s=parseSnapshot(input);
 const c=record(copyJson(command),['recordId','field','expectedField','presence','value','valueType','reason']);
 text(c.recordId,1,2048);text(c.field,1,100);
 const expected=parseField(c.expectedField);
 const presence=enumValue(c.presence,['present','absent','illegible','not_applicable']);
 const valueType=enumValue(c.valueType,['text','number','boolean']);
 const raw=text(c.value,0,4096),reason=text(c.reason,0,1000).trim();
 if(!reason)fail('CORRECTION_REASON_REQUIRED');
 const target=s.records.find(r=>r.id===c.recordId);if(!target)fail('RECORD_NOT_FOUND');
 if(!Object.hasOwn(target.fields,c.field as string))fail('FIELD_NOT_FOUND');
 const field=target.fields[c.field as string]!;
 if(canonicalJson(field)!==canonicalJson(expected))fail('FIELD_CHANGED');
 let value:CanonicalField['value']=null;
 if(presence!=='present'){if(raw!=='')fail('PRESENCE_VALUE_CONFLICT');}
 else {
  if(field.semanticRole==='identifier'&&valueType!=='text')fail('IDENTIFIER_MUST_REMAIN_TEXT');
  const knownType=typeof field.value==='number'?'number':typeof field.value==='boolean'?'boolean':'text';
  if(field.semanticRole!=='identifier'&&field.value!==null&&valueType!==knownType)fail('CORRECTION_TYPE_CONFLICT');
  if(valueType==='number'){
   // No magnitude/unit guessing, grouping separators, exponent or locale ambiguity.
   if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw.trim()))fail('INVALID_CORRECTION_NUMBER');
   const decimal=raw.trim().replace(',','.');
   value=Number(decimal);if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||decimalKey(decimal)!==decimalKey(String(value)))fail('INVALID_CORRECTION_NUMBER');
  }else if(valueType==='boolean'){
   if(raw!=='true'&&raw!=='false')fail('INVALID_CORRECTION_BOOLEAN');value=raw==='true';
  }else {if(raw.trim()==='')fail('INVALID_CORRECTION_TEXT');value=raw;}
 }
 if(presence===field.presence&&value===field.value)fail('NO_FIELD_CHANGE');
 const after=parseField({...field,value,presence,provenance:'operator_corrected'});
 target.fields[c.field as string]=after;
 s.decisions.push({type:'field_correction',recordId:target.id,field:c.field as string,
  before:copyJson(field) as unknown as import('../import-process/canonical.ts').Json,
  after:copyJson(after) as unknown as import('../import-process/canonical.ts').Json,reason});
 return parseSnapshot(s);
}
export const RECORD_KIND_LABELS:Record<CanonicalRecord['kind'],string>={event:'Concretagem',delivery:'Entrega',sample:'Amostra',specimen:'Corpo de prova',result:'Resultado',structure:'Estrutura'};
const PRESENCE:Record<CanonicalField['presence'],string>={present:'Informado',absent:'Ausente',illegible:'Ilegível',not_applicable:'Não se aplica'};
const SEMANTIC:Record<CanonicalField['semanticRole'],string>={measured:'Medido',specified:'Especificado',calculated:'Calculado',identifier:'Identificação',operational_placeholder:'Marcador operacional'};
const ORIGIN:Record<CanonicalField['provenance'],string>={source:'Documento original',normalized:'Normalizado',proposed:'Proposto',customer_confirmed:'Confirmado pelo cliente',operator_corrected:'Corrigido na revisão',operational:'Padrão operacional'};
export function displayScalar(value:CanonicalField['value']):string {return value===null?'—':typeof value==='boolean'?(value?'Sim':'Não'):String(value);}
export function correctionValueType(field:CanonicalField):CorrectionValueType {return field.semanticRole==='identifier'?'text':typeof field.value==='number'?'number':typeof field.value==='boolean'?'boolean':'text';}
export interface ReviewRow {
 recordId:string;kind:CanonicalRecord['kind'];kindLabel:string;name:string;field:CanonicalField;
 valueText:string;rawText:string;sourceText:string;presenceLabel:string;semanticLabel:string;originLabel:string;
}
export interface ReviewQuery {query:string;kind:'all'|CanonicalRecord['kind'];page:number;pageSize:number;}
const searchKey=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
/** Pure bounded view; strings are returned as text, never HTML. Pagination is over fields. */
export function projectReviewFields(input:unknown,q:ReviewQuery):{rows:ReviewRow[];total:number;page:number;pages:number;recordCount:number;} {
 const s=parseSnapshot(input);text(q.query,0,256);integer(q.page,1,100000);integer(q.pageSize,1,100);
 enumValue(q.kind,['all','event','delivery','sample','specimen','result','structure']);
 const query=searchKey(q.query.trim()),rows:ReviewRow[]=[];
 for(const r of s.records){
  if(q.kind!=='all'&&q.kind!==r.kind)continue;
  for(const [name,f] of Object.entries(r.fields)){
   if(query&&!searchKey([r.id,name,displayScalar(f.value),displayScalar(f.rawValue)].join(' ')).includes(query))continue;
   const sourceText=f.locations.map(l=>l.page!==undefined?`Página ${l.page} · ${l.artifactId}`:`${l.sheet} · linha ${l.row} · ${l.artifactId}`).join('; ')||'Sem localização informada';
   rows.push({recordId:r.id,kind:r.kind,kindLabel:RECORD_KIND_LABELS[r.kind],name,field:f,valueText:displayScalar(f.value),rawText:displayScalar(f.rawValue),sourceText,presenceLabel:PRESENCE[f.presence],semanticLabel:SEMANTIC[f.semanticRole],originLabel:ORIGIN[f.provenance]});
  }
 }
 const total=rows.length,pages=Math.max(1,Math.ceil(total/q.pageSize)),page=Math.min(q.page,pages);
 return {rows:rows.slice((page-1)*q.pageSize,page*q.pageSize),total,page,pages,recordCount:s.records.length};
}
