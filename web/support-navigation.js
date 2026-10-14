/** A URL is navigation metadata only. It never supplies identity, permission or
 * an approval action. Target stays in memory until authenticated ticket GET.
 * Ticket IDs are removed before login and never enter persistent storage. */
export function captureSupportNavigation(location,history){
 let target=null,discarded=false;
 try{
  const raw=location.href,url=new URL(raw);
  if(url.pathname.startsWith('/support/')){
   discarded=true;
   const match=/^\/support\/tickets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(url.pathname);
   // No search, fragment, credentials, escaped path or pre-normalization alias.
   const clean=match&&url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash
    &&raw===url.origin+url.pathname;
   history.replaceState(null,'','/');
   if(clean){target=match[1];discarded=false;}
  }
 }catch{target=null;discarded=true;}
 return Object.freeze({discarded,hasTicket:()=>target!==null,takeTicket(){const id=target;target=null;return id;},clear(){target=null;}});
}
