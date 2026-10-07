import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
/** Offline input only: bounded regular UTF-8 JSON, no symlink, credentials or network discovery. */
export async function readOperationalJson(path:string):Promise<unknown>{
 const limit=16*1024,metadata=await lstat(path);
 if(!metadata.isFile()||metadata.isSymbolicLink()||metadata.size<1||metadata.size>limit)throw Error('Invalid operational input');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const opened=await file.stat();
  if(!opened.isFile()||opened.dev!==metadata.dev||opened.ino!==metadata.ino)throw Error('Operational input changed');
  const buffer=Buffer.alloc(limit+1);let bytes=0;
  while(bytes<buffer.length){const result=await file.read(buffer,bytes,buffer.length-bytes,bytes);if(!result.bytesRead)break;bytes+=result.bytesRead;}
  if(!bytes||bytes>limit)throw Error('Invalid operational input');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytes)));
 }finally{await file.close();}
}
