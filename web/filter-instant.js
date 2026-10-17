/** Wall clocks are explicitly SaoPaulo, never the device timezone. Probe both
 * surrounding days to reject gaps AND ambiguous overlaps by exact round-trip. */
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',era:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const lower=Date.parse('0001-01-01T00:00:00.000Z'),upper=Date.parse('9999-12-31T23:59:59.999Z');
const parts=at=>Object.fromEntries(formatter.formatToParts(new Date(at)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const wall=p=>p.year.padStart(4,'0')+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;
export function saoPauloFilterInstant(raw){
 if(raw==='')return '';
 if(typeof raw!=='string'||! /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))throw Error('Confira o período de criação.');
 const at=Date.parse(raw+':00.000Z');if(!Number.isFinite(at)||new Date(at).toISOString().slice(0,16)!==raw)throw Error('Confira o período de criação.');
 const candidates=new Set();
 for(const delta of [-86400000,0,86400000]){
  const probe=at+delta;if(probe<lower||probe>upper)continue;const p=parts(probe);if(p.era!=='AD')continue;
  const offset=Date.parse(wall(p)+'.000Z')-probe,candidate=at-offset;if(candidate<lower||candidate>upper)continue;
  const check=parts(candidate);if(check.era==='AD'&&wall(check)===raw+':00')candidates.add(candidate);
 }
 if(candidates.size!==1)throw Error('Horário inexistente ou ambíguo em America/Sao_Paulo. Confira o período de criação.');
 return new Date([...candidates][0]).toISOString();
}
