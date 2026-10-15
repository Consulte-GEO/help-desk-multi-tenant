/** Menu visibility only. Every protected operation also checks the live server principal. */
export function isImplementationSupportStaff(principal){
 return principal?.kind==='human'&&(principal.workspace_role==='admin'||Array.isArray(principal.grants)&&principal.grants.some(grant=>grant?.role==='agent'));
}

/** Owns the Help Desk lifecycle; the native application owns everything inside its root. */
export function mountImplementationSupport(root,options){
 const doc=root.ownerDocument;
 let disposed=false,generation=0,abort=null,application=null,ready=Promise.resolve(false);
 const currentPrincipal=()=>options.getPrincipal?options.getPrincipal():options.principal;
 const permitted=()=>!disposed&&isImplementationSupportStaff(currentPrincipal())&&(!options.isCurrent||options.isCurrent());
 const session=Object.freeze({id:options.session.id,workspaceId:options.session.workspaceId});
 const loader=options.loadApplication??(()=>import('/implantacao/support-app.js'));
 function disposeApplication(value){try{value?.destroy();}catch{/* Local cleanup must never interrupt the host's session cleanup. */}}
 function teardown(){abort?.abort();abort=null;const previous=application;application=null;disposeApplication(previous);root.replaceChildren();}
 function node(tag,text,className){const n=doc.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
 async function load(){
  const stamp=++generation;teardown();if(!permitted())return false;
  const controller=new AbortController();abort=controller;
  const current=()=>stamp===generation&&permitted()&&!controller.signal.aborted;
  const request=async(path,init={})=>{
   if(!current())throw Error('stale_session');
   const signal=init.signal?AbortSignal.any([init.signal,controller.signal]):controller.signal;
   try{const response=await options.request(path,{...init,signal});if(!current())throw Error('stale_session');return response;}
   catch(error){if(!current())throw Error('stale_session');throw error;}
  };
  const status=node('p','Carregando Apoio Implantação…','fine');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
  const mountRoot=node('div','','implementation-support-application');
  try{
   const module=await loader();if(!current())return false;
   if(typeof module.mountImplementationSupportApplication!=='function')throw Error('invalid_application');
   root.replaceChildren(mountRoot);
   const mounted=await module.mountImplementationSupportApplication({root:mountRoot,request,session,signal:controller.signal});
   if(!mounted||typeof mounted.destroy!=='function')throw Error('invalid_application');
   if(!current()){disposeApplication(mounted);if(stamp===generation){controller.abort();root.replaceChildren();}return false;}
   application=mounted;return true;
  }catch{
   if(!current())return false;
   controller.abort();mountRoot.remove();
   const message=node('p','Não foi possível abrir o Apoio Implantação. Tente novamente.','fine');message.setAttribute('role','status');
   const retry=node('button','Tentar novamente','secondary');retry.type='button';retry.addEventListener('click',()=>{ready=load();});root.replaceChildren(message,retry);return false;
  }
 }
 ready=load();
 return Object.freeze({get ready(){return ready;},retry(){ready=load();return ready;},destroy(){if(disposed)return;disposed=true;generation++;teardown();}});
}
