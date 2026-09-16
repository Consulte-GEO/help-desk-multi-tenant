/** Offline operator tool. Never opens the database or a network connection. */
import {createReadStream} from 'node:fs';import {stat} from 'node:fs/promises';
import {HttpLogSummary,summarizeChunks} from '../src/observability/summary.ts';
try {
 const args=process.argv.slice(2);if(args.length!==1||!args[0]||args[0].startsWith('--'))throw Error('Uso: npm run logs:summary -- arquivo.jsonl');
 const info=await stat(args[0]);if(!info.isFile()||info.size>256*1024*1024)throw Error('Informe um arquivo regular JSONL de até 256 MiB.');
 const summary=new HttpLogSummary();await summarizeChunks(createReadStream(args[0]),summary);
 console.log(JSON.stringify(summary.snapshot(),null,2));
}catch{console.error('Resumo não concluído. Informe um arquivo JSONL legível de até 256 MiB; o conteúdo e o caminho não foram registrados.');process.exitCode=1;}
