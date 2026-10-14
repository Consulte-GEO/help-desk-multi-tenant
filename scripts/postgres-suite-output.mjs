import {testCounts} from './homologation-core.mjs';
/** Both real clusters must pass independently before their single gate summary is emitted. */
export function combinePostgresSuites(outputs){
 if(!Array.isArray(outputs)||outputs.length!==2)throw Error('Both isolated PostgreSQL suites are required.');
 let total=0,rootTotal=0;const evidence=[];
 for(const [index,output] of outputs.entries()){
  const counts=testCounts(output);
  if(!counts||!Number.isSafeInteger(counts.tests)||counts.tests<1||counts.pass!==counts.tests
   ||counts.fail||counts.cancelled||counts.skipped||counts.todo)throw Error('PostgreSQL suite assertions are incomplete or failed.');
  const plans=[...output.matchAll(/^1\.\.(\d+)\r?$/gm)];
  if(plans.length!==1||Number(plans[0][1])<1||Number(plans[0][1])>counts.tests)throw Error('PostgreSQL root TAP plan is incomplete.');
  const offset=rootTotal;rootTotal+=Number(plans[0][1]);total+=counts.tests;
  evidence.push(`# PostgreSQL isolated cluster ${index+1}\n`+output
   .replace(/^TAP version 13\r?\n/gm,'').replace(/^1\.\.\d+\r?\n/gm,'')
   .replace(/^# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) [^\n]*\n?/gm,'')
   .replace(/^(ok|not ok) (\d+)/gm,(_,prefix,n)=>prefix+' '+(Number(n)+offset)));
 }
 return 'TAP version 13\n'+evidence.join('\n')+`\n1..${rootTotal}\n# tests ${total}\n# suites 0\n# pass ${total}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
}
