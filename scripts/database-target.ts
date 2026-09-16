/** Guard before importing a driver or opening any connection. Never prints passwords. */
export function validateDatabaseTestTargets(env:Record<string,string|undefined>):{adminUrl:string;appUrl:string}{
 if(env.ALLOW_DATABASE_TESTS!=='1')throw Error('Database tests NOT EXECUTED: explicit ALLOW_DATABASE_TESTS=1 is required.');
 function target(value:string|undefined,role:string):URL{
  if(!value)throw Error('Local test connection missing');
  let u:URL;try{u=new URL(value);}catch{throw Error('Invalid local test connection');}
  if(!['postgres:','postgresql:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)
   ||u.pathname!=='/helpdesk_test'||u.search||u.hash||!u.password||decodeURIComponent(u.username)!==role)
   throw Error('Database tests require matching local helpdesk_test targets and dedicated roles, without URL overrides.');
  return u;
 }
 const admin=target(env.HELPDESK_TEST_ADMIN_URL,'postgres'),app=target(env.HELPDESK_TEST_APP_URL,'helpdesk_app');
 const endpoint=(u:URL)=>`${u.hostname}:${u.port||5432}`;
 if(endpoint(admin)!==endpoint(app))throw Error('Database test endpoints must match.');
 return {adminUrl:env.HELPDESK_TEST_ADMIN_URL!,appUrl:env.HELPDESK_TEST_APP_URL!};
}
