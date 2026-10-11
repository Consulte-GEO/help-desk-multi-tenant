/** Presentation only. Persisted values and cursors keep their original UTC
 * microseconds; Date is used solely to label a moment to the human reader. */
const formatter=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'});
export function formatPortalInstant(value){
 if(typeof value!=='string'||!/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(value))return 'Data indisponível';
 const canonical=value.slice(0,23)+'Z',date=new Date(canonical);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==canonical)return 'Data indisponível';
 return formatter.format(date)+' (São Paulo)';
}
