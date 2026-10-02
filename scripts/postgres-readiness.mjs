/** Wait for a real query through the same host endpoint used by the SQL suite. */
export async function waitForPostgresConnection(probe,options={}){
 if(typeof probe!=='function'||options===null||typeof options!=='object'||Array.isArray(options))
  throw Error('Invalid local PostgreSQL readiness options.');
 let attempts,sleep;
 try{({attempts=40,sleep=()=>new Promise(resolve=>setTimeout(resolve,500))}=options);}
 catch{throw Error('Invalid local PostgreSQL readiness options.');}
 if(!Number.isSafeInteger(attempts)||attempts<1||typeof sleep!=='function')
  throw Error('Invalid local PostgreSQL readiness options.');
 for(let attempt=0;attempt<attempts;attempt++){
  let result;
  try{result=await probe();}
  catch{
   // Probe exceptions are untrusted: do not inspect flags or expose driver details.
   if(attempt===attempts-1)throw Error('Local PostgreSQL did not become ready through its loopback host port.');
   try{await sleep();}catch{throw Error('Local PostgreSQL readiness wait failed.');}
   continue;
  }
  let compatible=false;
  try{
   if(result!==null&&typeof result==='object'&&!Array.isArray(result)){
    const {version,database}=result;
    compatible=Number.isSafeInteger(version)&&version>=170000&&version<180000&&database==='helpdesk_test';
   }
  }catch{/* Broken metadata is incompatible, not a transient connection failure. */}
  if(!compatible)throw Error('Local PostgreSQL 17 helpdesk_test database required.');
  return;
 }
}
