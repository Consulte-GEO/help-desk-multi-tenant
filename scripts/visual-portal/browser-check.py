#!/usr/bin/env python3
"""UX03-C/UX04 native DOM bench. Actual modules/controllers/parser; synthetic API ports.
No production Auth, SQL, HTTP/CSP or automatic application mounting is claimed.
"""
import argparse,base64,json,re,shutil,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser(description=__doc__);P.add_argument('--output',type=Path,required=True);P.add_argument('--web-root',type=Path,default=Path(__file__).resolve().parents[2]/'web');P.add_argument('--baseline',action='store_true');a=P.parse_args();root=a.web_root.resolve();a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];cache={}
def ck(name,passed,detail=None):
 checks.append({'name':name,'passed':bool(passed),'detail':detail})
 if not passed: print('FAIL:',name,detail)
def module(file):
 file=file.resolve()
 if file not in cache:
  s=file.read_text();s=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",lambda m:m[1]+repr(module(file.parent/m[3])),s);cache[file]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
 return cache[file]
def setup(page,kind):
 css='\n'.join(re.sub(r'@import[^;]+;','',(root/n).read_text()) for n in ['design-tokens.css','consulte-theme.css','dynamic-form.css','form-experience.css','portal.css','support-intake.css'] if (root/n).exists())
 page.set_content('<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--hd-paper);color:var(--hd-ink);font:14px/1.6 var(--hd-font)}main{max-width:1200px;padding:16px;margin:auto}*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}button,input,textarea,select{font:inherit}#outside{margin:16px;min-height:44px}</style><style>'+css+'</style></head><body class="hd-ui"><button id="outside">Fora do painel</button><main><div id="root" class="host-owned"></div></main></body></html>')
 # about:blank is not a secure origin. This fixture supplies IDs ONLY for the
 # offline bench; production still uses native crypto.randomUUID unchanged.
 page.add_script_tag(content="if(!crypto.randomUUID){let n=0;crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');}")
 if kind=='intake':
  page.add_script_tag(type='module',content=f"import {{mountSupportIntake}} from {module(root/'support-intake.js')!r};\n"+'''
const f=(key,type,required,config)=>({key,type,label:({name:'Nome para contato',flag:'Conferiu as informações?',rows:'Pessoas envolvidas',ref:'Referência autorizada'})[key]??key,required,public:true,config});
window.SCHEMA={id:'ux04-request',version:1,status:'published',title:'Informações complementares',fields:[f('name','text',true,{maxLength:80}),f('flag','boolean',true,{}),f('rows','repeater',false,{minRows:0,maxRows:2,fields:[f('name','text',true,{maxLength:80})]}),f('ref','lookup',false,{resolver:'reference'}),{...f('private','text',false,{maxLength:80}),public:false}]};
window.MOUNT=()=>{window.PANEL?.destroy();window.CALLS=[];window.FAIL_CREATE=false;window.REJECT_SAVE=false;window.WAIT_SAVE=false;window.WAIT_PREVIEW=false;window.WAIT_LOOKUP=false;window.PORTS={
 save:async(p,r)=>{CALLS.push({op:'save',p:structuredClone(p),r});if(WAIT_SAVE)await new Promise(done=>window.SAVE_DONE=done);return REJECT_SAVE?{kind:'rejected'}:{kind:'confirmed',value:{id:'draft-fixture',revision:r+1}};},
 preview:async p=>{CALLS.push({op:'preview',p:structuredClone(p)});if(WAIT_PREVIEW)await new Promise(done=>window.PREVIEW_DONE=done);return {valid:true,commitAuthorized:false,draftId:'draft-fixture',draftRevision:p.expectedDraftRevision,previewHash:'a'.repeat(64),priority:'high',attachmentCount:0,privatePayload:'NEVER_RENDER_PRIVATE'};},
 create:async(p,key)=>{CALLS.push({op:'create',p:structuredClone(p),key});if(FAIL_CREATE)throw Error('uncertain');return {kind:'confirmed',value:{ticketId:'ticket-fixture',protocol:'CG-12345',notification:'pending'}};}
};window.PANEL=mountSupportIntake(document.getElementById('root'),{schema:SCHEMA,draft:{id:'draft-fixture'},api:PORTS,chooseLookup:async()=>{if(WAIT_LOOKUP)await new Promise(done=>window.LOOKUP_DONE=done);return 'reference-scoped';}});};MOUNT();
''');page.wait_for_function('!!window.PANEL')
 else:
  page.add_script_tag(type='module',content='\n'.join(f"import {{{name}}} from {module(root/file)!r};" for name,file in [('renderCustomerPortal','customer-portal.js'),('renderSupportQueue','support-queue.js'),('renderTicketDetail','ticket-detail.js'),('renderOperationalReport','reports.js')])+'''
window.OPENED=[];window.VIEW={audience:'customer-fixture',pending:false,error:null,cockpit:{total:120,open:4,waitingCustomer:0,resolvedOrClosed30d:3},page:{total:120,nextCursor:'cursor-private',items:[{id:'t1',subject:'Como conferir a solicitação antes de enviar?',protocol:'CG-12345',status:'received',priority:'normal',updatedAt:'2026-10-13T16:00:00.123456Z',assignedTo:'PRIVATE_USER',internalStatus:'PRIVATE_STATUS',notes:'PRIVATE_NOTES'},{id:'t2',subject:'Documento com nome longo '+ 'semEspacos'.repeat(24),protocol:null,status:'resolved',priority:'high',updatedAt:'invalid'}]}};
window.PORTAL=()=>renderCustomerPortal(document.getElementById('root'),VIEW,id=>OPENED.push(id));window.QUEUE=()=>renderSupportQueue(document.getElementById('root'),VIEW,id=>OPENED.push(id));
window.REPORT=(v)=>renderOperationalReport(document.getElementById('root'),v);window.DETAIL=(v)=>renderTicketDetail(document.getElementById('root'),v);PORTAL();
''');page.wait_for_function('!!window.PORTAL')
def fill(page):
 page.get_by_label('Assunto',exact=True).fill('Dúvida de teste');page.get_by_label('Descrição',exact=True).fill('Descrição fictícia para conferir o fluxo.');page.locator('[data-field="name"]').fill('Pessoa fictícia');page.locator('[data-field="flag"]').select_option('false')
def to_review(page):
 page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="saved"');page.get_by_role('button',name='Revisar solicitação',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="review"')
def intake(page):
 setup(page,'intake');ck('intake uses themed host without auto-request',page.locator('.hd-intake').count()==1 and page.evaluate('CALLS.length===0'))
 page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_timeout(30)
 ck('invalid general/dynamic fields never call save port',page.evaluate('CALLS.length===0'))
 if a.baseline:return
 ck('invalid entry exposes focused error summary',page.evaluate('document.activeElement.classList.contains("hd-intake-errors")'))
 page.evaluate('MOUNT()');fill(page)
 refs=page.locator('#root input,#root textarea,#root select').evaluate_all('(nodes)=>{window.INPUTS=nodes;return nodes.length}');to_review(page)
 ck('review shows human priority and zero evidence', 'Alta' in page.locator('.hd-intake-review').inner_text() and '0' in page.locator('.hd-intake-review').inner_text())
 ck('review never displays private preview payload or confirms on load', 'NEVER_RENDER_PRIVATE' not in page.locator('#root').inner_text() and page.evaluate('!CALLS.some(x=>x.op==="create")'))
 ck('original controls survive all state transitions',page.evaluate('INPUTS.every(n=>n.isConnected)'))
 ck('public host does not render internal field',page.locator('[data-field="private"]').count()==0)
 ck('explicit false reaches save as boolean',page.evaluate('CALLS.find(x=>x.op==="save").p.answers.flag===false'))
 page.get_by_role('button',name='Voltar para editar',exact=True).click();ck('return invalidates old preview and preserves draft',page.evaluate('PANEL.state.snapshot().phase==="editing"') and page.get_by_label('Assunto',exact=True).input_value()=='Dúvida de teste')
 to_review(page)
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':820});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'intake review reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   ck(f'intake primary touch target {width}/{theme}',page.get_by_role('button',name='Confirmar abertura',exact=True).bounding_box()['height']>=44)
   if width in [390,1440]:page.locator('main').screenshot(path=str(a.output/f'intake-review-{width}-{theme}.png'))
 page.evaluate('FAIL_CREATE=true');page.get_by_role('button',name='Confirmar abertura',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="unknown"')
 ck('uncertain result offers reconciliation, no new confirmation',page.get_by_role('button',name='Conciliar mesma intenção',exact=True).is_visible() and page.get_by_role('button',name='Confirmar abertura',exact=True).is_hidden())
 page.evaluate('FAIL_CREATE=false');page.get_by_role('button',name='Conciliar mesma intenção',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="confirmed"')
 ck('reconciliation preserves exact body/key',page.evaluate('(()=>{const a=CALLS.filter(x=>x.op==="create");return a.length===2&&a[0].key===a[1].key&&JSON.stringify(a[0].p)===JSON.stringify(a[1].p)})()'))
 ck('receipt distinguishes creation from notification', 'CG-12345' in page.locator('#root').inner_text() and 'Notificação pendente' in page.locator('#root').inner_text())
 ck('confirmed clears original inputs and duplicate review texts',page.evaluate('INPUTS.every(n=>!n.value)') and 'Descrição fictícia' not in page.locator('#root').inner_text())
 page.evaluate('MOUNT()');fill(page);page.evaluate('REJECT_SAVE=true');page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_timeout(30)
 ck('explicit refusal is not shown as successful save', 'recus' in page.locator('[data-intake-status]').inner_text().lower() and page.evaluate('PANEL.state.snapshot().phase==="editing"'))
 page.evaluate('MOUNT()');fill(page);to_review(page)
 page.evaluate('document.querySelector("[data-intake-subject]").value="Alterado sem evento"');page.get_by_role('button',name='Confirmar abertura',exact=True).click()
 ck('programmatic edit invalidates review before send',page.evaluate('!CALLS.some(x=>x.op==="create") && PANEL.state.snapshot().phase==="editing"'))
 page.evaluate('MOUNT()');fill(page);page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="saved"');page.locator('[data-form-add="rows"]').click()
 ck('adding repeater row invalidates saved host state without input event',page.evaluate('PANEL.state.snapshot().phase==="editing"'))
 page.locator('[data-field="rows.0.name"]').fill('Outra pessoa');page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="saved"')
 page.get_by_role('button',name='Consultar opções autorizadas').click();page.wait_for_timeout(40)
 ck('accepted lookup invalidates preview eligibility',page.evaluate('PANEL.state.snapshot().phase==="editing" && PANEL.state.snapshot().answers.ref==="reference-scoped"'))
 page.evaluate('MOUNT()');fill(page);page.evaluate('WAIT_LOOKUP=true');page.get_by_role('button',name='Consultar opções autorizadas').click();page.wait_for_timeout(20)
 ck('save waits for pending reference selection',page.get_by_role('button',name='Salvar rascunho',exact=True).is_disabled())
 page.evaluate('PANEL.clear();LOOKUP_DONE()');page.wait_for_timeout(30)
 ck('late picker cannot revive cleared panel',page.locator('#root').inner_text()=='' and page.evaluate('PANEL.state.snapshot().phase==="cleared"'))
 page.evaluate('MOUNT()');fill(page);page.evaluate('WAIT_SAVE=true');page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_timeout(20);page.evaluate('PANEL.destroy();SAVE_DONE()');page.wait_for_timeout(30)
 ck('late save cannot restore destroyed UI',page.locator('#root').inner_text()=='')
 ck('destroy releases owned busy and theme attributes for root reuse',page.evaluate('!document.getElementById("root").hasAttribute("aria-busy") && !document.getElementById("root").classList.contains("hd-intake")'))
 page.evaluate('MOUNT()');fill(page);page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.wait_for_function('PANEL.state.snapshot().phase==="saved"');page.evaluate('WAIT_PREVIEW=true');page.get_by_role('button',name='Revisar solicitação',exact=True).click();page.wait_for_timeout(20);page.locator('#outside').focus();page.evaluate('PREVIEW_DONE()');page.wait_for_timeout(30)
 ck('async completion does not steal external focus',page.evaluate('document.activeElement.id==="outside"'))
 page.evaluate('PANEL.clear()');ck('clear removes schema title and review copies',page.locator('#root').inner_text()=='')
def portal(page):
 setup(page,'portal');ck('portal cards use shared presentation classes',page.locator('.hd-portal-stats').count()==1)
 if a.baseline:return
 ck('server total not page length', '120' in page.locator('[data-portal-count="total"]').inner_text() and '2 carregados de 120' in page.locator('#root').inner_text())
 ck('zero counter stays zero',page.locator('[data-portal-count="waitingCustomer"] strong').inner_text()=='0')
 ck('public list never leaks internal extras',all(x not in page.locator('#root').inner_text() for x in ['PRIVATE_USER','PRIVATE_STATUS','PRIVATE_NOTES','cursor-private']))
 page.locator('[data-portal-ticket="t1"]').click();ck('row callback uses exact id',page.evaluate('OPENED[0]==="t1"'))
 page.locator('[data-portal-ticket="t1"]').focus();page.evaluate('PORTAL()');ck('same row retains focus across rerender',page.evaluate('document.activeElement.getAttribute("data-portal-ticket")==="t1"'))
 page.evaluate('QUEUE()');ck('queue has team-specific labels without nuking header',page.get_by_role('heading',name='Fila de atendimento').count()==1 and 'Aguardando cliente' in page.locator('#root').inner_text())
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'portal reflow long words {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   ck(f'portal button touch target {width}/{theme}',page.locator('[data-portal-ticket="t1"]').bounding_box()['height']>=44)
   if width in [390,1440]:page.locator('main').screenshot(path=str(a.output/f'queue-{width}-{theme}.png'))
 page.evaluate('VIEW.pending=true;PORTAL()');ck('loading is explicit and row is disabled', 'Consultando' in page.locator('[role="status"]').inner_text() and page.locator('[data-portal-ticket="t1"]').is_disabled())
 page.evaluate('VIEW.pending=false;VIEW.error="Consulta indisponível";PORTAL()');ck('error is distinct from an empty result',page.locator('.hd-portal-state--error').count()==1 and 'Nenhum chamado encontrado' not in page.locator('#root').inner_text())
 page.evaluate('VIEW.error=null;VIEW.page={items:[],total:0,nextCursor:null};PORTAL()');ck('empty result is explicit', 'Nenhum chamado encontrado' in page.locator('#root').inner_text())
 page.evaluate('VIEW.audience=null;VIEW.cockpit={total:999};PORTAL()');ck('no audience removes all counts and ticket data',page.locator('.hd-portal-stats').count()==0 and '999' not in page.locator('#root').inner_text())
 page.evaluate('DETAIL({subject:"<img src=x onerror=alert(1)>",description:"Descrição pública",status:"in_progress",priority:"normal",protocol:"CG-12345",notes:[{body:"SECRET_NOTE"}],messages:[{body:"Resposta pública",createdAt:"invalid",internalText:"SECRET_INTERNAL"}]})')
 ck('detail inserts text, never markup',page.locator('#root img').count()==0 and '<img' in page.locator('#root').inner_text())
 ck('detail omits notes and unknown nested fields', 'SECRET' not in page.locator('#root').inner_text())
 ck('invalid instant is labelled not assigned false timestamp','Data indisponível' in page.locator('#root').inner_text() and page.locator('time[datetime]').count()==0)
 for theme in ['light','dark']:
  page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);page.set_viewport_size({'width':390,'height':900});ck('detail reflow '+theme,page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 page.evaluate('REPORT({total:120,open:0,waitingCustomer:null,resolvedOrClosed30d:3,asOf:"2026-10-13T16:00:00.123456Z",metrics:{firstHumanResponse:{availability:"unavailable",value:null},csat:{availability:"available",value:0},solutionTime:{availability:"available",value:{}},privateMetric:{availability:"available",value:"SECRET"}}})')
 ck('report keeps zero distinct from unavailable',page.locator('[data-portal-count="open"] strong').inner_text()=='0' and page.locator('[data-portal-count="waitingCustomer"] strong').inner_text()=='Indisponível')
 ck('report ignores unknown metric keys and objects','SECRET' not in page.locator('#root').inner_text() and '[object Object]' not in page.locator('#root').inner_text())
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);ck(f'report reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if width in [390,1440]:page.locator('main').screenshot(path=str(a.output/f'report-{width}-{theme}.png'))
 page.evaluate('REPORT(null)');ck('unavailable report is not a fake zero dashboard','Relatório indisponível' in page.locator('#root').inner_text() and page.locator('.hd-portal-stats').count()==0)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':900},reduced_motion='reduce');page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
  for name,fn in [('intake',intake),('portal',portal)]:
   try:fn(page)
   except Exception as e:checks.append({'name':name+' bench completed','passed':False,'detail':str(e)});print(traceback.format_exc())
  ck('no uncaught browser exception',not errors,errors);version=browser.version;browser.close()
finally:
 result={'suite':'UX03-C/UX04','browser':locals().get('version'),'scope':'Native modules/controller/parser; synthetic API ports, no real Auth/SQL/HTTP/CSP','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'pageErrors':errors}
 (a.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['passed'],'passed,',result['failed'],'failed')
raise SystemExit(1 if result['failed'] else 0)
