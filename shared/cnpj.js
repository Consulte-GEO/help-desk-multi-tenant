/** Pure syntax/DV validation. Does NOT prove registration, ownership or standing.
 * Algorithm: Receita Federal/SERPRO, Manual DV CNPJ, pp.3-4, accessed 2026-10-09.
 * Accept only the exact display mask or canonical form; never strip arbitrary input.
 */
export function normalizeCnpj(value) {
 const fail=()=>Object.assign(new Error('CNPJ inválido. Confira os caracteres e dígitos verificadores.'),{code:'invalid_cnpj'});
 if(typeof value!=='string'||value.length>18||!(/^[0-9A-Za-z]{12}[0-9]{2}$/.test(value)||/^[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-[0-9]{2}$/.test(value)))throw fail();
 const canonical=value.replace(/[./-]/g,'').toUpperCase();
 if(/^0{14}$/.test(canonical))throw fail();
 const digit=base=>{let total=0,weight=2;for(let i=base.length-1;i>=0;i--){total+=(base.charCodeAt(i)-48)*weight;weight=weight===9?2:weight+1;}const rest=total%11;return String(rest<2?0:11-rest);};
 const base=canonical.slice(0,12),first=digit(base),second=digit(base+first);
 if(canonical.slice(12)!==first+second)throw fail();
 return canonical;
}
