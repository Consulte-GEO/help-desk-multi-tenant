import {readFile,lstat} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {sourceFingerprint,validateReport,verifyLogs} from './homologation-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),directory=join(root,'evidence/homologation');
try{
 const path=join(directory,'latest.json');if((await lstat(path)).isSymbolicLink())throw Error('Relatório simbólico não é aceito.');
 const report=JSON.parse(await readFile(path,'utf8'));validateReport(report,await sourceFingerprint(root));await verifyLogs(report,directory);
 console.log('Evidências locais verificadas para este código. Este relatório não autoriza publicação nem comprova Supabase/Netlify reais.');
}catch{console.error('PUBLICAÇÃO BLOQUEADA: execute e revise npm run homologate:local. Evidência local ausente, incompleta, alterada ou vencida.');process.exitCode=1;}
