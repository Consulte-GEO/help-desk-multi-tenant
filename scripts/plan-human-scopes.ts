import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {planHumanScopeChange} from '../src/application/human-scope-change.ts';

// Offline only: bounded, regular UTF-8 JSON; never loads a DB driver or environment credentials.
const MAX_BYTES=16*1024;
try{
 const args=process.argv.slice(2);
 if(args.length!==1||!args[0])throw Error();
 const metadata=await lstat(args[0]);
 if(!metadata.isFile()||metadata.isSymbolicLink()||metadata.size<1||metadata.size>MAX_BYTES)throw Error();
 const file=await open(args[0],constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 let value:unknown;
 try{
  const opened=await file.stat();
  if(!opened.isFile()||opened.dev!==metadata.dev||opened.ino!==metadata.ino)throw Error();
  const buffer=Buffer.alloc(MAX_BYTES+1);let bytes=0;
  while(bytes<buffer.length){const r=await file.read(buffer,bytes,buffer.length-bytes,bytes);if(!r.bytesRead)break;bytes+=r.bytesRead;}
  if(!bytes||bytes>MAX_BYTES)throw Error();
  value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytes)));
 }finally{await file.close();}
 console.log(JSON.stringify(planHumanScopeChange(value),null,2));
}catch{
 console.error('Plano recusado. Informe um único arquivo JSON UTF-8 regular de até 16 KiB, sem segredos e com os campos exigidos. Nenhum SQL foi executado.');
 process.exitCode=1;
}
