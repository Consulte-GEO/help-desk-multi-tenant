/** Wait for a real query through the same host endpoint used by the SQL suite. */
export async function waitForPostgresConnection(probe,{attempts=40,sleep=()=>new Promise(resolve=>setTimeout(resolve,500))}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const result=await probe();
   if(result?.version<170000||result?.version>=180000||result?.database!=='helpdesk_test')
    throw Object.assign(Error('Local PostgreSQL 17 helpdesk_test database required.'),{wrongServer:true});
   return;
  }catch(error){
   if(error?.wrongServer)throw error;
   if(attempt===attempts-1)throw Error('Local PostgreSQL did not become ready through its loopback host port.');
   await sleep();
  }
 }
}
