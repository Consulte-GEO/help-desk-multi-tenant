import {operationsUI, attachmentView, attachmentSelectionIssue, transferredText, clearOperationsNode} from './operations-ui.js';

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

/** Optional selector. Names and files stay in memory. Only the original batch/TUS
 * algorithms perform transfers. UI checks are advisory, never scanner approval. */
export function mountAttachments(root, options) {
 const ui = operationsUI(root, 'attachments', 'Anexos privados', 'Selecione as evidências e acompanhe a transferência e a análise. Os arquivos continuam privados.'), {node} = ui;
 let cleared = false, destroyed = false, running = false, chosen = [], metadata = [], rowListeners = [], lastPhase = '';
 const field = ui.field('Selecionar anexos privados', 'files', 'input', 'PNG, JPEG ou PDF. Até 50 arquivos por lote e 100 MiB por arquivo. O servidor verifica o conteúdo e o acesso.');
 const input = field.input; input.type = 'file'; input.multiple = true; input.setAttribute('accept', '.png,.jpg,.jpeg,.pdf'); input.setAttribute('data-ops-action', 'select-files');
 const list = node('ul', undefined, {class: 'hd-ops-file-list', 'aria-label': 'Arquivos selecionados'}), selectionText = node('p', '', {class: 'hd-ops-muted', 'data-attachment-selection': ''});
 const actions = node('div', undefined, {class: 'hd-ops-actions'});
 const start = ui.button('Enviar arquivos selecionados', 'send-files', () => act(() => {
  const issue = attachmentSelectionIssue(chosen);
  if (issue) { field.feedback(issue); input.focus(); return; }
  batch.select(chosen.map(blob => ({name: blob.name, blob}))); chosen = []; input.value = ''; field.feedback('');
  return batch.start();
 }), true);
 const retry = ui.button('Conciliar transferência', 'reconcile-files', () => act(() => batch.reconcile()), true);
 const refresh = ui.button('Consultar análise', 'read-analysis', () => act(() => batch.refreshStatus()));
 actions.append(start, retry, refresh);
 const notice = node('p', '100% dos bytes transferidos não significa análise aprovada. O servidor revalida o arquivo e sua vinculação antes de aceitar uma evidência.', {class: 'hd-ops-notice'});
 ui.section.append(field.box, selectionText, list, notice, actions);
 // These wrappers only refresh the presentation at existing call boundaries.
 // They preserve arguments, call count, return values, errors and adapter receiver.
 const api = {};
 for (const name of ['start', 'saveSelection', 'bind', 'finish']) api[name] = (...args) => { draw(); return options.api[name](...args); };
 const transfer = (grant, file) => {
  const original = options.transfer ? options.transfer(grant, file) : createTusTransfer({grant, file, onProgress: () => draw()});
  return {state: () => original.state(), clear: () => original.clear(), async resume() { draw(); try { return await original.resume(); } finally { draw(); } }};
 };
 const batch = createAttachmentBatch({...options, api, transfer});
 function clearRows() {
  for (const [button, handler] of rowListeners) button.removeEventListener('click', handler);
  rowListeners = []; clearOperationsNode(list);
 }
 function draw() {
  if (cleared || destroyed) return;
  const s = batch.state(), idle = s.phase === 'idle', items = idle ? metadata.map(m => ({name: m.name, status: 'selected', progress: 0})) : s.items;
  input.disabled = !idle || running;
  start.hidden = !idle; start.disabled = running || !chosen.length;
  retry.hidden = s.phase !== 'unknown'; retry.disabled = running;
  refresh.hidden = !['pending_scan', 'ready', 'attention'].includes(s.phase); refresh.disabled = running;
  selectionText.textContent = items.length ? items.length + ' arquivo(s) neste lote.' : 'Nenhum arquivo selecionado.';
  ui.section.setAttribute('aria-busy', String(running)); clearRows();
  items.forEach((file, index) => {
   const row = node('li', undefined, {class: 'hd-ops-file'}), top = node('div', undefined, {class: 'hd-ops-file-top'}), view = attachmentView(file.status);
   top.append(node('h3', file.name), ui.badge(view)); row.append(top);
   if (idle) {
    const remove = node('button', 'Remover da seleção', {type: 'button', class: 'hd-ops-secondary', 'data-attachment-remove': String(index), 'aria-label': 'Remover da seleção: ' + file.name});
    remove.disabled = running;
    const handler = () => { if (cleared || destroyed || running || batch.state().phase !== 'idle') return; chosen.splice(index, 1); metadata.splice(index, 1); field.feedback(''); draw(); input.focus(); };
    remove.addEventListener('click', handler); rowListeners.push([remove, handler]); row.append(remove);
   } else {
    const total = metadata[index]?.size, text = transferredText(file.progress, total);
    if (text !== 'Progresso indisponível') {
     const meter = node('progress', '', {max: String(total), value: String(file.progress), 'aria-label': 'Bytes confirmados de ' + file.name}); row.append(meter);
    }
    row.append(node('p', text, {class: 'hd-ops-muted'}));
   }
   list.append(row);
  });
  const texts = {
   idle: 'A seleção ainda não foi enviada. Remova os arquivos que não devem fazer parte deste lote.',
   preparing: 'Preparando a transferência privada…', saving: 'Vinculando a seleção ao rascunho…', uploading: 'Transferindo os arquivos. O progresso indica apenas bytes confirmados.',
   finalizing: 'Conferindo a conclusão da transferência…', checking: 'Consultando o resultado da análise…',
   pending_scan: 'Transferência concluída. Consulte a análise; os bytes enviados não confirmam que o arquivo pode ser usado.',
   ready: 'Análise concluída. O servidor conferirá acesso e revisão no envio da solicitação.',
   attention: 'Um arquivo exige atenção. Arquivos rejeitados ou sem análise concluída não atendem uma evidência obrigatória.',
   unknown: 'Confirmação desconhecida. Preserve este lote e concilie a mesma transferência antes de iniciar outra.', cleared: '',
  };
  ui.report(texts[s.phase] ?? 'Estado indisponível.', ['attention', 'unknown', 'pending_scan'].includes(s.phase) ? 'warning' : s.phase === 'ready' ? 'success' : 'neutral');
  if (lastPhase && lastPhase !== s.phase && s.phase === 'unknown' && !running) retry.focus();
  lastPhase = s.phase;
 }
 async function act(fn) {
  if (cleared || destroyed || running) return;
  running = true;
  let failed = false;
  try { const result = fn(); draw(); await result; } catch { failed = true; }
  finally {
   running = false;
   if (!cleared && !destroyed) {
    draw();
    if (batch.state().phase === 'unknown') retry.focus();
    else if (failed) { ui.report('Não foi possível concluir esta operação. Confira os arquivos e o estado do lote.', 'warning'); ui.status.focus(); }
   }
  }
 }
 ui.listen(input, 'change', () => {
  if (cleared || destroyed || running || batch.state().phase !== 'idle') return;
  const files = Array.from(input.files ?? []); input.value = '';
  if (!files.length) return;
  const issue = attachmentSelectionIssue(files);
  if (issue) { field.feedback(issue + (chosen.length ? ' A seleção anterior foi preservada.' : '')); return; }
  chosen = files; metadata = files.map(file => ({name: file.name, size: file.size})); field.feedback(''); draw();
 });
 function clear() {
  if (cleared) return; cleared = true; running = false; chosen = []; metadata = []; input.value = ''; batch.clear(); clearRows();
  field.feedback(''); selectionText.textContent = ''; ui.report(''); ui.section.setAttribute('aria-busy', 'false');
  input.disabled = start.disabled = retry.disabled = refresh.disabled = true;
 }
 ui.mount(); draw();
 return Object.freeze({batch, clear, destroy() { if (destroyed) return; clear(); destroyed = true; ui.destroy(); }});
}
