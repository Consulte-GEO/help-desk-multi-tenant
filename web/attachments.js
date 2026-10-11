/** Direct transfer to an already-created, private TUS resource. The trusted server
 * adapter must reserve a create-only object and return a version-sealable resource.
 * No upload creation POST, public bucket, localStorage or automatic retry here. */
export function createTusTransfer(options){
 let grant={...options.grant},file=options.file,phase='idle',offset=0,epoch=0,busy=false,active=null;const total=file?.size,clock=options.clock??(()=>Date.now()),fetcher=options.fetcher??fetch,chunkBytes=options.chunkBytes??6*1024*1024,timeoutMs=options.timeoutMs??30000;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw Error('Prazo inválido.');
 if(!(file instanceof Blob)||!Number.isSafeInteger(total)||total<1||total>104857600||!Number.isSafeInteger(chunkBytes)||chunkBytes<1||chunkBytes>6*1024*1024)throw Error('Arquivo inválido.');
 const u=new URL(grant.endpoint);if(grant.protocol!=='tus'||u.protocol!=='https:'||u.username||u.password||u.search||u.hash||typeof grant.token!=='string'||grant.token.length<16||grant.token.length>4096||/[\r\n]/.test(grant.token)||typeof grant.objectKey!=='string'||!Number.isFinite(Date.parse(grant.expiresAt)))throw Error('Destino de upload inválido.');
 const header=options.authenticationHeader??'x-signature';if(!['x-signature','authorization'].includes(header))throw Error('Configuração inválida.');
 const state=()=>Object.freeze({phase,bytesUploaded:offset,totalBytes:phase==='cleared'?0:total});
 function check(stamp){if(epoch!==stamp||phase==='cleared'||!grant||clock()>=Date.parse(grant.expiresAt)||active?.signal.aborted)throw Error('Transferência encerrada ou expirada.');}
 async function request(method,body,stamp){check(stamp);const deadline=performance.now()+timeoutMs;const child=new AbortController();let rejectStop=()=>{};const stopped=new Promise((_,reject)=>{rejectStop=reject;});const abort=()=>{child.abort();rejectStop(Error('Transferência interrompida.'));};active.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);
  try{const response=await Promise.race([fetcher(grant.endpoint,{method,body,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:child.signal,headers:{'tus-resumable':'1.0.0',[header]:header==='authorization'?'Bearer '+grant.token:grant.token,...(method==='PATCH'?{'upload-offset':String(offset),'content-type':'application/offset+octet-stream'}:{})}}),stopped]);check(stamp);if(child.signal.aborted||performance.now()>=deadline||!response.ok||response.headers.get('tus-resumable')!=='1.0.0')throw Error('Transferência não confirmada.');return response;}finally{clearTimeout(timer);active?.signal.removeEventListener('abort',abort);child.abort();}}
 const number=(s)=>{if(typeof s!=='string'||!/^(0|[1-9]\d*)$/.test(s)||!Number.isSafeInteger(Number(s)))throw Error('Offset inválido.');return Number(s);};
 async function resume(){if(busy||phase==='cleared'||phase==='uploaded')throw Error('Transferência indisponível.');const stamp=epoch;busy=true;active=new AbortController();phase='uploading';try{
  const head=await request('HEAD',undefined,stamp),length=number(head.headers.get('upload-length')),remote=number(head.headers.get('upload-offset'));if(length!==total||remote>total||remote<offset)throw Error('Objeto incompatível.');offset=remote;
  while(offset<total){check(stamp);const next=Math.min(total,offset+chunkBytes),r=await request('PATCH',file.slice(offset,next),stamp);if(r.status!==204||number(r.headers.get('upload-offset'))!==next)throw Error('Confirmação incompatível.');offset=next;try{options.onProgress?.(state());}catch{/* advisory only */}}
  check(stamp);phase='uploaded';grant=null;file=null;return state();
 }catch{if(epoch===stamp)phase='unknown';throw Error('Transferência não confirmada. Retome explicitamente para consultar o progresso no servidor.');}finally{busy=false;active?.abort();active=null;}}
 function clear(){epoch++;active?.abort();grant=null;file=null;offset=0;phase='cleared';}
 return Object.freeze({resume,clear,state});
}
/** Memory-only batch. Save all selected IDs once, bind to that draft revision,
 * then transfer and queue scan. Progress100% is NOT a clean attachment receipt.
 * saveSelection must reconcile an ambiguous save with the SAME expected revision
 * and exact answers, using the server's draft CAS/idempotent-save contract. */
export function createAttachmentBatch(options){let phase='idle',entries=[],revision=null,epoch=0,busy=false,active=null;
 const state=()=>Object.freeze({phase,items:Object.freeze(entries.map(e=>Object.freeze({name:e.name,uploadId:e.uploadId,status:e.status,progress:e.transfer?.state().bytesUploaded??0})))});
 function select(files){if(phase!=='idle'||!Array.isArray(files)||!files.length||files.length>50)throw Error('Seleção indisponível.');entries=files.map(v=>{if(!(v.blob instanceof Blob)||typeof v.name!=='string')throw Error('Arquivo inválido.');return {name:v.name,blob:v.blob,uploadId:null,status:'selected',upload:null,transfer:null,startKey:crypto.randomUUID(),finishKey:crypto.randomUUID(),bound:false,transferred:false,finished:false};});}
 async function run(){const stamp=epoch;busy=true;active=new AbortController();const signal=active.signal;const check=()=>{if(stamp!==epoch||signal.aborted)throw Error('Audiência encerrada.');};try{
  phase='preparing';for(const e of entries){if(!e.uploadId){const r=await options.api.start({filename:e.name,mime:e.blob.type,bytes:e.blob.size},e.startKey,signal);check();if(!r||typeof r.uploadId!=='string'||r.status!=='uploading'||!r.upload)throw Error('Upload indisponível.');e.uploadId=r.uploadId;e.upload=r.upload;e.status='uploading';}}
  if(revision===null){phase='saving';const r=await options.api.saveSelection(Object.freeze(entries.map(e=>e.uploadId)),signal);check();if(!Number.isSafeInteger(r?.revision)||r.revision<1)throw Error('Rascunho não confirmado.');revision=r.revision;}
  for(const e of entries){if(!e.bound){await options.api.bind(e.uploadId,revision,signal);check();e.bound=true;}if(!e.transferred){phase='uploading';if(!e.transfer)e.transfer=(options.transfer??((grant,file)=>createTusTransfer({grant,file})))(e.upload,e.blob);await e.transfer.resume();check();e.transferred=true;e.upload=null;e.blob=null;}
   if(!e.finished){phase='finalizing';const r=await options.api.finish(e.uploadId,e.finishKey,signal);check();if(!r||r.uploadId!==e.uploadId||!['pending_scan','scanning','clean','rejected','unsupported','scan_error'].includes(r.status))throw Error('Análise não confirmada.');e.status=r.status;e.finished=true;}}
  phase='pending_scan';return state();
 }catch{if(epoch===stamp)phase='unknown';throw Error('Operação não confirmada. Concilie a mesma seleção.');}finally{busy=false;active?.abort();active=null;}}
 async function refreshStatus(){if(busy||!entries.length||!entries.every(e=>e.finished)||!['pending_scan','ready','attention','unknown'].includes(phase))throw Error('Consulta de análise indisponível.');const stamp=epoch;busy=true;active=new AbortController();phase='checking';try{
  for(const e of entries){const r=await options.api.finish(e.uploadId,e.finishKey,active.signal);if(stamp!==epoch) return;if(!r||r.uploadId!==e.uploadId||!['pending_scan','scanning','clean','rejected','unsupported','scan_error'].includes(r.status))throw Error('Estado inválido.');e.status=r.status;}
  phase=entries.every(e=>e.status==='clean')?'ready':entries.some(e=>['rejected','unsupported','scan_error'].includes(e.status))?'attention':'pending_scan';return state();
 }catch{if(stamp===epoch)phase='unknown';throw Error('Análise não confirmada. Consulte novamente.');}finally{busy=false;active?.abort();active=null;}}
 async function start(){if(phase!=='idle'||!entries.length||busy)throw Error('Selecione os arquivos.');return run();}
 async function reconcile(){if(phase!=='unknown'||busy)throw Error('Não há intenção para conciliar.');return entries.every(e=>e.finished)?refreshStatus():run();}
 function clear(){epoch++;active?.abort();for(const e of entries){e.transfer?.clear();e.blob=null;e.upload=null;e.name='';}entries=[];revision=null;phase='cleared';}
 return Object.freeze({select,start,reconcile,refreshStatus,clear,state});
}

/** Optional attachment selector with explicit progress/analysis refresh. No remote
 * URL/token is put in DOM, form values, clipboard or durable browser storage. */
export function mountAttachments(root,options){const doc=root.ownerDocument,n=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};const batch=createAttachmentBatch(options);let cleared=false;
 const input=n('input');input.type='file';input.multiple=true;input.setAttribute('aria-label','Selecionar anexos privados');input.setAttribute('accept','.png,.jpg,.jpeg,.pdf');
 const start=n('button','Enviar arquivos selecionados'),retry=n('button','Conciliar transferência'),refresh=n('button','Consultar análise'),list=n('ul'),status=n('p');for(const b of [start,retry,refresh])b.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 function draw(){const s=batch.state();list.replaceChildren();for(const r of s.items)list.append(n('li',r.name+' — '+({selected:'selecionado',uploading:'em transferência',pending_scan:'aguardando análise',scanning:'em análise',clean:'análise concluída',rejected:'rejeitado',unsupported:'formato não suportado',scan_error:'análise indisponível'}[r.status]??'não confirmado')));input.disabled=s.phase!=='idle';start.disabled=s.phase!=='idle';retry.disabled=s.phase!=='unknown';refresh.disabled=!['pending_scan','ready','attention'].includes(s.phase);status.textContent=s.phase==='unknown'?'Confirmação desconhecida. Preserve esta seleção e concilie.':s.phase==='ready'?'Análise concluída. O servidor conferirá acesso e revisão no envio.':s.phase==='pending_scan'?'Transferência concluída. Análise ainda pendente.':s.phase==='attention'?'Um arquivo exige atenção e não pode satisfazer evidência obrigatória.':'';}
 const act=f=>async()=>{try{const promise=f();draw();await promise;}catch{if(!cleared)status.textContent='Operação não confirmada.';}finally{if(!cleared)draw();}};
 start.addEventListener('click',act(()=>{batch.select(Array.from(input.files??[]).map(blob=>({name:blob.name,blob})));input.value='';return batch.start();}));retry.addEventListener('click',act(()=>batch.reconcile()));refresh.addEventListener('click',act(()=>batch.refreshStatus()));root.replaceChildren(n('h3','Anexos privados'),input,start,retry,refresh,list,status);draw();
 return Object.freeze({batch,clear:()=>{cleared=true;input.value='';batch.clear();list.replaceChildren();status.textContent='';input.disabled=true;start.disabled=true;retry.disabled=true;refresh.disabled=true;},destroy:()=>{cleared=true;input.value='';batch.clear();root.replaceChildren();}});
}
