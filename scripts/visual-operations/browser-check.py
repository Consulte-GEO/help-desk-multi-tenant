#!/usr/bin/env python3
"""UX06 native components + real controllers with SYNTHETIC adapters, no remote writes.
Local HTTP/CSP harness: not the production host, real Auth, scanner or PostgreSQL.
"""
import argparse, json, threading, traceback, shutil, mimetypes, base64, re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--offline',action='store_true',help='Use data modules and set_content when local HTTP is blocked; does NOT validate HTTP/CSP.');p.add_argument('--output',type=Path,required=True);p.add_argument('--web-root',type=Path,default=Path(__file__).resolve().parents[2]/'web');a=p.parse_args();root=a.web_root.resolve();source=root.parent;a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];http=[]
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok: print('FAIL',name,detail)
html='''<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consulte GEO · Bancada UX06</title><link rel="stylesheet" href="/web/design-tokens.css"><link rel="stylesheet" href="/web/consulte-theme.css"><link rel="stylesheet" href="/web/operations-experience.css"><link rel="stylesheet" href="/web/execution-checklist.css"><link rel="stylesheet" href="/harness.css"><script type="module" src="/scripts/visual-operations/fixture.js"></script></head><body class="hd-ui"><button id="outside">Fora do painel</button><main><div id="root" data-host="preservar"></div><div id="second"></div></main></body></html>'''
css='body{margin:0;background:var(--hd-paper);color:var(--hd-ink);font:14px/1.65 var(--hd-font)}main{max-width:1100px;margin:24px auto;padding:0 16px}#outside{margin:16px;min-height:44px;border:1px solid var(--hd-control-line);border-radius:12px;padding:10px;background:var(--hd-surface);color:var(--hd-muted)}*{box-sizing:border-box}[hidden]{display:none!important}'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=urlsplit(self.path).path;data=None;mime=None
  if path=='/':data=html.encode();mime='text/html; charset=utf-8'
  elif path=='/harness.css':data=css.encode();mime='text/css; charset=utf-8'
  elif path.startswith(('/web/','/shared/','/scripts/visual-operations/')):
   target=(source/path.lstrip('/')).resolve()
   if target.is_relative_to(source) and target.is_file() and target.suffix in ['.js','.css']:
    data=target.read_bytes();mime='text/javascript; charset=utf-8' if target.suffix=='.js' else 'text/css; charset=utf-8'
  status=200 if data is not None else 404;http.append({'path':path,'status':status,'mime':mime})
  self.send_response(status);self.send_header('Content-Type',mime or 'text/plain');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
  self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'");self.end_headers();self.wfile.write(data or b'Not found')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();url='http://127.0.0.1:'+str(server.server_port)
cache={}
def module(file):
 file=file.resolve()
 if file not in cache:
  text=file.read_text();text=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",lambda m:m[1]+repr(module(file.parent/m[3])),text)
  cache[file]='data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
 return cache[file]
def setup(page,kind):
 if a.offline:
  styles='\n'.join(re.sub(r'@import[^;]+;', '', (root/n).read_text()) for n in ['design-tokens.css','consulte-theme.css','operations-experience.css','execution-checklist.css'])+'\n'+css
  page.goto('about:blank')
  page.set_content('<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body class="hd-ui"><button id="outside">Fora do painel</button><main><div id="root" data-host="preservar"></div><div id="second"></div></main></body></html>')
  page.add_script_tag(content="if(!crypto.randomUUID){let n=100;crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');}")
  page.add_script_tag(type='module',content='import '+repr(module(Path(__file__).parent/'fixture.js'))+';')
 else:page.goto(url)
 page.wait_for_function('window.READY===true');page.evaluate('(k)=>setup(k)',kind)

def action(page,name):return page.locator('[data-ops-action="'+name+'"]')
def reflow(page,label,dialog=False):
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'{label} page reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if dialog:ck(f'{label} dialog fits {width}/{theme}',page.locator('dialog[open]').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
   bad=page.locator('#root button').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent)')
   ck(f'{label} touch targets {width}/{theme}',not bad,bad)
   if width<=390:
    small=page.locator('#root input:not([type=checkbox]),#root textarea,#root select').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)')
    ck(f'{label} input readability {width}/{theme}',not small,small)
   if width in [390,1440]:page.screenshot(path=str(a.output/f'{label}-{width}-{theme}.png'),full_page=not dialog)
def checklist(page):
 setup(page,'checklist');ck('checklist no auto-call',page.evaluate('CALLS.length===0'));ck('checklist unloaded progress hidden',page.locator('[data-checklist-meter]').is_hidden())
 page.get_by_role('button',name='Atualizar checklist').click();page.wait_for_function('P.view().phase==="ready"')
 ck('checklist actual required count',page.locator('[data-checklist-meter]').get_attribute('max')=='2');reflow(page,'checklist')
 page.locator('[data-checklist-item="check"]').get_by_role('button',name='Registrar item').click();ck('checklist modal focus',page.evaluate('document.activeElement.getAttribute("data-checklist-field")==="status"'))
 ck('checklist exemption forbidden',page.locator('[data-checklist-field="status"] option[value="not_applicable"]').is_disabled())
 ck('checklist missing evidence/risk blocked',page.evaluate('P.review()===false && P.view().phase==="editing"'))
 page.get_by_role('button',name='Consultar minhas notas').click();page.wait_for_function('P.view().evidence.phase==="ready"')
 ck('same-time evidence has distinguishable labels',page.locator('.checklist__evidence-option label').evaluate_all('(xs)=>new Set(xs.map(x=>x.textContent)).size===xs.length'));ck('evidence no note bodies', 'DO_NOT_RENDER' not in page.locator('#root').inner_text())
 page.locator('[data-checklist-note]').first.check();ck('evidence checkbox retains focus',page.evaluate('document.activeElement.hasAttribute("data-checklist-note")'))
 page.get_by_label('Reconheço o risco e conferi a execução').check();reason=page.get_by_label('Motivo ou observação');reason.fill('Conferência com evidência registrada.');reason.press('ArrowLeft');before=reason.evaluate('(e)=>{window.OLD=e;return e.selectionStart}');reason.press('x');ck('checklist reason node/caret stable',reason.evaluate('(e)=>e===OLD') and reason.evaluate('(e)=>e.selectionStart')==before+1)
 reflow(page,'checklist-edit',True)
 page.get_by_role('button',name='Revisar marcação').click();ck('checklist review sends nothing',page.evaluate('CALLS.filter(c=>c.path?.endsWith("/marks")).length===0'))
 page.get_by_role('button',name='Voltar',exact=True).click();ck('checklist back preserves reason','evidência' in reason.input_value())
 page.locator('[data-checklist-selected-note]').first.click();ck('checklist removed evidence focus has destination',page.evaluate('document.activeElement.hasAttribute("data-checklist-note")||document.activeElement.hasAttribute("data-checklist-load-notes")'))
 page.locator('[data-checklist-note]').first.check();page.get_by_role('button',name='Revisar marcação').click();reflow(page,'checklist-review',True)
 page.evaluate('MODE="unknown"');page.get_by_role('button',name='Confirmar marcação').click();page.wait_for_function('P.view().phase==="unknown"');ck('unknown checklist cannot start another mark',page.evaluate('P.editItem("ordinary")===false'));ck('unknown focus reconciliation',page.evaluate('document.activeElement.hasAttribute("data-checklist-reconcile")'))
 page.evaluate('MODE="ok"');page.get_by_role('button',name='Conciliar marcação').click();page.wait_for_function('P.view().phase==="refresh_required"')
 ck('checklist reconcile same exact key/body',page.evaluate('(()=>{const c=CALLS.filter(c=>c.path?.endsWith("/marks"));return c.length===2&&c[0].body===c[1].body&&c[0].headers["idempotency-key"]===c[1].headers["idempotency-key"]})()'))
 page.get_by_role('button',name='Atualizar checklist').click();page.wait_for_function('P.view().phase==="ready"');ck('checklist confirmed mark only updates progress',page.locator('[data-checklist-meter]').get_attribute('value')=='1' and 'resolução exige nova validação' in page.locator('#root').inner_text())
 page.locator('[data-checklist-item="ordinary"]').get_by_role('button',name='Registrar item').click();page.keyboard.press('Escape');ck('checklist Escape returns focus',page.evaluate('document.activeElement.textContent==="Registrar item"'))
 page.evaluate('MODE="delay";window.WAIT=P.load()');page.wait_for_function('!!DEFERRED');page.evaluate('P.clear();DEFERRED()');page.wait_for_timeout(40);ck('checklist late read discarded',page.evaluate('P.view().phase==="empty"&&P.view().record===null'));ck('checklist private fields cleared',not page.locator('[data-checklist-item]').count())
 page.evaluate('P.destroy()');ck('checklist destroy empty root/host preserved',page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('data-host')=='preservar')
def attachments(page):
 setup(page,'attachments');ck('attachments no automatic request',page.evaluate('CALLS.length===0'));ck('attachments empty submission disabled',action(page,'send-files').is_disabled())
 files=action(page,'select-files');files.set_input_files([{'name':'evidencia.pdf','mimeType':'application/pdf','buffer':b'fixture pdf'}, {'name':'outra.png','mimeType':'image/png','buffer':b'fixture image'}]);ck('selection visible before transfer',page.locator('.hd-ops-file').count()==2 and page.evaluate('CALLS.length===0'))
 page.locator('[data-attachment-remove]').nth(1).click();ck('remove before sending no call',page.locator('.hd-ops-file').count()==1 and page.evaluate('CALLS.length===0'))
 files.set_input_files({'name':'invalid.exe','mimeType':'application/octet-stream','buffer':b'bad'});ck('invalid extension preserves prior selection','seleção anterior' in page.locator('#root').inner_text() and 'evidencia.pdf' in page.locator('#root').inner_text())
 reflow(page,'attachments-selection')
 page.evaluate('MODE="finish-unknown"');action(page,'send-files').click();page.wait_for_function('P.batch.state().phase==="unknown"');ck('private grant excluded from DOM',page.evaluate('!document.querySelector("#root").innerHTML.includes("private-fixture-token")&&!document.querySelector("#root").innerHTML.includes("upload.example")'))
 page.evaluate('MODE="ok"');action(page,'reconcile-files').click();page.wait_for_function('P.batch.state().phase==="pending_scan"')
 ck('finished transfer is not approved evidence','100%' in page.locator('#root').inner_text() and 'Aguardando análise' in page.locator('#root').inner_text());ck('same batch and finalize key after uncertainty',page.evaluate('(()=>{const f=CALLS.filter(c=>c.op==="file-finish");return f.length===2&&f[0].key===f[1].key&&CALLS.filter(c=>c.op==="file-start").length===1&&CALLS.filter(c=>c.op==="file-save").length===1})()'))
 count=page.evaluate('CALLS.length');page.wait_for_timeout(70);ck('no automatic scan polling',page.evaluate('CALLS.length')==count)
 page.evaluate('FILE_STATUS="scan_error"');action(page,'read-analysis').click();page.wait_for_function('P.batch.state().phase==="attention"');ck('scan error is attention not ready','Análise indisponível' in page.locator('#root').inner_text());reflow(page,'attachments-analysis')
 page.evaluate('FILE_STATUS="clean"');action(page,'read-analysis').click();page.wait_for_function('P.batch.state().phase==="ready"');ck('clean still requires server binding check','servidor conferirá acesso' in page.locator('#root').inner_text())
 page.evaluate('window.OLD=[...document.querySelectorAll("#root li,#root input")];P.clear()');ck('attachments clear scrubs old DOM references',page.evaluate('OLD.every(e=>!e.textContent.includes("evidencia.pdf")&&(!("value" in e)||!e.value))'));page.evaluate('P.destroy()');ck('attachments destroy root',page.locator('#root').inner_text()=='')
 setup(page,'attachments');action(page,'select-files').set_input_files({'name':'evidencia.pdf','mimeType':'application/pdf','buffer':b'fixture'});page.evaluate('MODE="tus-delay"');action(page,'send-files').click();page.wait_for_function('!!DEFERRED');page.evaluate('P.destroy();DEFERRED()');page.wait_for_timeout(40);ck('late TUS answer after destroy creates no finalization',page.evaluate('CALLS.filter(c=>c.op==="file-finish").length===0') and page.locator('#root').inner_text()=='')
def approval(page):
 setup(page,'approval');ck('approval no decision on mount',page.evaluate('CALLS.length===0'));action(page,'prepare-approval').click();page.wait_for_function('P.state.snapshot().phase==="decision"');ck('approval no preselected decision',page.locator('[data-ops-decision]').input_value()=='')
 action(page,'review-decision').click();ck('approval invalid choice focuses input',page.evaluate('document.activeElement.hasAttribute("data-ops-decision")'))
 page.get_by_label('Sua decisão',exact=True).select_option('reject');reason=page.get_by_label('Justificativa da decisão',exact=True);reason.fill('A documentação precisa de uma correção antes da aprovação.');action(page,'review-decision').click();ck('approval review is local only',page.evaluate('CALLS.filter(c=>c.op==="commit").length===0'));reflow(page,'approval-review')
 action(page,'back-decision').click();ck('approval back preserves typed reason','correção' in reason.input_value());action(page,'review-decision').click();page.evaluate('NOW="2026-10-13T14:00:00.000Z"');action(page,'confirm-decision').click();page.wait_for_timeout(30);ck('expired invitation does not decide',page.evaluate('CALLS.filter(c=>c.op==="commit").length===0'))
 page.evaluate('NOW="2026-10-13T12:00:00.000Z";MODE="unknown"');action(page,'confirm-decision').click();page.wait_for_function('P.state.snapshot().phase==="unknown"');page.evaluate('MODE="ok"');action(page,'reconcile-approval').click();page.wait_for_function('P.state.snapshot().phase==="confirmed"');ck('approval exact intent replay',page.evaluate('(()=>{const c=CALLS.filter(c=>c.op==="commit");return c.length===2&&c[0].key===c[1].key&&JSON.stringify(c[0].payload)===JSON.stringify(c[1].payload)&&c[0].payload.decision==="reject"})()'));ck('approval notification pending not delivered','Notificação pendente' in page.locator('#root').inner_text());ck('invitation token never in DOM',page.evaluate('!document.querySelector("#root").innerHTML.includes("hd_approval_")'));page.evaluate('P.state.clear()');ck('approval clear removes reason','documentação precisa' not in page.locator('#root').inner_text());page.evaluate('P.destroy()')
def revision(page):
 setup(page,'revision');ck('revision no auto lookup',page.evaluate('DRAFT_LOOKUPS===0&&CALLS.length===0'));page.evaluate('PUBLIC_DIFF[0].after="<script>window.INJECTED=true</script>"+"A".repeat(500)');action(page,'preview-revision').click();page.wait_for_function('P.state.snapshot().phase==="review"');ck('diff text no HTML execution',page.evaluate('window.INJECTED!==true'));ck('only public diff properties rendered','DO_NOT_RENDER' not in page.locator('#root').inner_text());ck('diff separates before/after','Antes' in page.locator('#root').inner_text() and 'Depois' in page.locator('#root').inner_text());reflow(page,'form-review')
 page.evaluate('MODE="unknown"');action(page,'confirm-revision').click();page.wait_for_function('P.state.snapshot().phase==="unknown"');page.evaluate('MODE="ok"');action(page,'reconcile-revision').click();page.wait_for_function('P.state.snapshot().phase==="confirmed"');ck('revision preserves key/payload',page.evaluate('(()=>{const c=CALLS.filter(c=>c.op==="commit");return c.length===2&&c[0].key===c[1].key&&JSON.stringify(c[0].payload)===JSON.stringify(c[1].payload)})()'))
 setup(page,'revision');page.evaluate('MODE="draft-delay";document.querySelector("[data-ops-action=preview-revision]").click();document.querySelector("[data-ops-action=preview-revision]").click()');page.wait_for_function('!!DEFERRED');ck('draft lookup single flight',page.evaluate('DRAFT_LOOKUPS===1'));page.evaluate('P.state.clear();DEFERRED()');page.wait_for_timeout(30);ck('cleared draft never triggers preview',page.evaluate('CALLS.length===0&&P.state.snapshot().phase==="cleared"'))
 setup(page,'revision');page.evaluate('PUBLIC_DIFF=[]');action(page,'preview-revision').click();page.wait_for_function('P.state.snapshot().phase==="review"');ck('empty public diff does not imply no private changes','Não há diferenças públicas' in page.locator('#root').inner_text());page.evaluate('P.destroy()')
def delivery(page):
 setup(page,'delivery');ck('delivery no automatic read',page.evaluate('CALLS.length===0'))
 for status in ['pending','leased','sending','retry_wait','accepted','delivered','failed','unknown','suppressed']:
  page.evaluate('(s)=>DELIVERY=s',status);action(page,'read-delivery').click();page.wait_for_function('P.state.snapshot().phase==="loaded"')
  ck('delivery status '+status,page.locator('[data-delivery-state]').get_attribute('data-delivery-state')==status)
  ck('delivery provider raw fields absent '+status,'DO_NOT_RENDER' not in page.locator('#root').inner_text() and 'PRIVATE_ADDRESS' not in page.locator('#root').inner_text())
  ck('delivery provider evidence only allowed states '+status,action(page,'reconcile-delivery').is_visible()==(status in ['accepted','unknown']))
 page.evaluate('DELIVERY="accepted"');action(page,'read-delivery').click();page.wait_for_function('P.state.snapshot().phase==="loaded"');ck('accepted distinct from delivered','ainda não confirmada' in page.locator('[data-ops-status]').inner_text());reflow(page,'delivery-accepted')
 action(page,'reconcile-delivery').click();page.wait_for_function('P.state.snapshot().phase==="loaded"');ck('provider evidence is not resend',page.evaluate('CALLS.filter(c=>c.op==="delivery-evidence").length===1&&CALLS.every(c=>c.op.startsWith("delivery-"))'));ck('delivery UTC formatted for reader','São Paulo' in page.locator('#root').inner_text());
 page.evaluate('DELIVERY="toString"');action(page,'read-delivery').click();page.wait_for_function('P.state.snapshot().phase==="error"');ck('unknown delivery state not success',page.locator('[data-delivery-state]').is_hidden());page.evaluate('MODE="delay"');action(page,'read-delivery').click();page.wait_for_function('!!DEFERRED');page.evaluate('P.state.clear();DEFERRED()');page.wait_for_timeout(30);ck('late delivery ignored after clear',page.evaluate('P.state.snapshot().phase==="cleared"') and page.locator('[data-delivery-state]').is_hidden());page.evaluate('P.destroy()');ck('delivery destroy keeps host attr',page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('data-host')=='preservar')
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':900});page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
  for name,scenario in [('checklist',checklist),('attachments',attachments),('approval',approval),('revision',revision),('delivery',delivery)]:
   try:scenario(page)
   except Exception as e:ck(name+' scenario completed',False,str(e));traceback.print_exc()
  ck('no browser JavaScript exceptions',not errors,errors)
  if not a.offline:
   ck('local module assets all returned HTTP200',bool(http) and all(r['status']==200 for r in http if r['path']!='/favicon.ico'))
   ck('CSS MIME correct under nosniff',bool([r for r in http if r['path'].endswith('.css')]) and all((r['mime'] or '').startswith('text/css') for r in http if r['path'].endswith('.css')))
  ck('no fixture path is required in production build', 'visual-operations/fixture' not in (source/'scripts/build.mjs').read_text())
  browser.close()
finally:
 server.shutdown();server.server_close()
 result={'scope':('UX06 offline native-module harness with real controllers and synthetic adapters. No HTTP/CSP/Auth/SQL/scanner acceptance.' if a.offline else 'UX06 local HTTP/CSP harness with native modules and real controllers; synthetic adapters. Not production Auth/SQL/scanner/host acceptance.'),'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'browserErrors':errors,'http':http}
 (a.output/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:result[k] for k in ['passed','failed','scope']},ensure_ascii=False))
raise SystemExit(1 if result['failed'] else 0)
