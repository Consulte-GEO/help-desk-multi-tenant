/** Real TLS transport fixture only. No PostgreSQL protocol, SQL, credentials or remote target. */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer,connect} from 'node:tls';
import type {TLSSocket,ConnectionOptions} from 'node:tls';
import type {Socket} from 'node:net';
export async function loopbackTls(){
 const dir=await mkdtemp(join(tmpdir(),'helpdesk-tls-'));
 const sockets=new Set<Socket>();let server:ReturnType<typeof createServer>|undefined;
 const close=async()=>{
  for(const socket of sockets)socket.destroy();
  if(server?.listening)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));
  await rm(dir,{recursive:true,force:true});
 };
 try{
  const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
  const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1',
   '-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',key,'-out',cert],
   {stdio:'pipe',timeout:10_000});
  if(generated.error||generated.status!==0)throw Error('OpenSSL is required to generate ephemeral TLS test certificates.');
  const ca=await readFile(cert);
  server=createServer({key:await readFile(key),cert:ca},socket=>{
   sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
  });
  server.on('tlsClientError',()=>{});
  server.on('connection',socket=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));});
  await new Promise<void>((resolve,reject)=>{
   const fail=(error:Error)=>reject(error);server!.once('error',fail);
   server!.listen(0,'127.0.0.1',()=>{server!.removeListener('error',fail);resolve();});
  });
  const address=server.address();if(!address||typeof address==='string')throw Error('Expected loopback TCP address');
  const open=(options:Pick<ConnectionOptions,'ca'|'servername'|'rejectUnauthorized'>={}):Promise<TLSSocket>=>new Promise((resolve,reject)=>{
   const socket=connect({host:'127.0.0.1',port:address.port,ca,servername:'localhost',rejectUnauthorized:true,...options});
   sockets.add(socket);
   const timer=setTimeout(()=>socket.destroy(Error('Loopback TLS handshake timeout')),5_000);
   socket.once('secureConnect',()=>{clearTimeout(timer);resolve(socket);});
   socket.on('error',error=>{clearTimeout(timer);reject(error);});
   socket.once('close',()=>{clearTimeout(timer);sockets.delete(socket);});
  });
  return {open,close};
 }catch(error){await close();throw error;}
}
