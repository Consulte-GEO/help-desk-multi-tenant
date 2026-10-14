#!/usr/bin/env python3
"""UX07 native components with synthetic ports; no real Auth, backend or hosted approval."""
import argparse,base64,json,re,shutil,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--offline',action='store_true');p.add_argument('--web-root',type=Path,default=Path(__file__).resolve().parents[2]/'web');a=p.parse_args();web=a.web_root.resolve();src=web.parent;a.output.mkdir(parents=True,exist_ok=True)
checks=[];exceptions=[];http=[];cache={}
styles=['design-tokens.css','consulte-theme.css','operations-experience.css','support-experience.css','access-experience.css']
harness='body{margin:0;background:var(--hd-paper);color:var(--hd-ink);font:14px/1.6 var(--hd-font)}*{box-sizing:border-box}main{max-width:1100px;margin:24px auto;padding:0 16px}.test-header{max-width:1100px;margin:auto;padding:24px 16px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.test-header strong{color:var(--hd-brand-fg)}.test-header small{color:var(--hd-muted)}#outside{margin-left:auto;min-height:44px;padding:10px 14px;border:1px solid var(--hd-control-line);border-radius:14px;background:var(--hd-surface);color:var(--hd-ink);font:inherit}#second{margin-top:20px}[hidden]{display:none!important}'
body='<body class="hd-ui"><header class="test-header"><strong>CONSULTE GEO</strong><small>Bancada local · Dados fictícios</small><button id="outside">Fora do painel</button></header><main><div id="root" data-host="preservar"></div><div id="second"></div></main></body>'
def html(offline=False):
 links=''.join('<link rel="stylesheet" href="/web/'+s+'">' for s in styles)+'<link rel="stylesheet" href="/harness.css">'
 if offline:links='<style>'+harness+'\n'+'\n'.join(re.sub(r'@import[^;]+;','',(web/s).read_text()) for s in styles)+'</style>'
 return '<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UX07 · Bancada de suporte</title>'+links+('' if offline else '<script type="module" src="/scripts/visual-support/fixture.js"></script>')+'</head>'+body+'</html>'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  name=urlsplit(self.path).path;content=None;mime='text/plain'
  if name=='/':content=html().encode();mime='text/html'
  elif name=='/harness.css':content=harness.encode();mime='text/css'
  elif name.startswith(('/web/','/scripts/visual-support/')):
   file=(src/name.lstrip('/')).resolve()
   if file.is_relative_to(src) and file.is_file() and file.suffix in ['.css','.js']:
    content=file.read_bytes();mime='text/css' if file.suffix=='.css' else 'text/javascript'
  status=200 if content is not None else 404;http.append({'path':name,'status':status,'mime':mime})
  self.send_response(status);self.send_header('Content-Type',mime+'; charset=utf-8');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store');self.send_header('Content-Security-Policy',"default-src 'none';script-src 'self';style-src 'self';connect-src 'none';img-src 'self';font-src 'self';base-uri 'none';form-action 'none'");self.end_headers();self.wfile.write(content or b'Not found')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:print('FAIL',name,detail)
def module(file):
 file=file.resolve()
 if file not in cache:
  text=file.read_text();text=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",lambda m:m[1]+repr(module(file.parent/m[3])),text);cache[file]='data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
 return cache[file]
def fresh(page,kind):
 if a.offline:
  page.goto('about:blank');page.set_content(html(True));page.add_script_tag(content="if(!crypto.randomUUID){let n=100;crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');}")
  page.add_script_tag(type='module',content='import '+repr(module(Path(__file__).parent/'fixture.js'))+';')
 else:page.goto(url)
 page.wait_for_function('window.READY===true');page.evaluate('(k)=>setup(k)',kind)
def action(page,name):return page.locator('[data-ops-action="'+name+'"]')
def reflow(page,name):
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':960});page.evaluate('(x)=>document.documentElement.dataset.theme=x',theme)
   ck(f'{name}: reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   bad=page.locator('#root button').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent)')
   ck(f'{name}: targets {width}/{theme}',not bad,bad)
   if width<=390:
    small=page.locator('#root input,#root select,#root textarea').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)');ck(f'{name}: inputs {width}/{theme}',not small,small)
   if width in [390,1440]:page.screenshot(path=str(a.output/f'{name}-{width}-{theme}.png'),full_page=True)
def knowledge(page):
 fresh(page,'knowledge');ck('knowledge no callback on mount',page.evaluate('CALLS.length===0'));ck('knowledge real three titles/snippets only',page.locator('[data-support-article]').count()==3)
 reflow(page,'knowledge');page.evaluate('KNOWLEDGE={items:[{title:"<script>INJECTED=true</script>",snippet:"A".repeat(1000),url:"PRIVATE_URL",status:"PRIVATE_STATUS"}]};SUPPORT.renderKnowledge(document.querySelector("#root"),KNOWLEDGE,OPEN)');ck('knowledge no HTML executed or invented anchors',page.evaluate('window.INJECTED!==true&&document.querySelectorAll("#root script,#root a").length===0'));ck('knowledge excludes metadata','PRIVATE_' not in page.locator('#root').inner_text());reflow(page,'knowledge-long')
 page.evaluate('window.OLD=[...document.querySelectorAll("#root h3,#root p")];P=SUPPORT.renderKnowledge(document.querySelector("#root"),{items:[]},OPEN)');ck('knowledge empty message not unavailable','Nenhuma orientação' in page.locator('#root').inner_text());ck('old knowledge text scrubbed',page.evaluate('OLD.every(e=>!e.textContent.includes("INJECTED")&&!e.textContent.includes("AAAA"))'))
 page.evaluate('P=SUPPORT.renderKnowledge(document.querySelector("#root"),null,OPEN);MODE="delay"');action(page,'open-ticket').click();page.wait_for_function('!!DEFERRED');page.evaluate('document.querySelector("[data-ops-action=open-ticket]").click()');ck('knowledge single-flight',page.evaluate('CALLS.length===1'));page.evaluate('REJECT()');page.wait_for_function('!document.querySelector("[data-ops-action=open-ticket]").disabled');ck('opening error sanitized','PRIVATE_' not in page.locator('#root').inner_text());ck('knowledge unavailable does not block explicit ticket opening','indisponível' in page.locator('#root').inner_text().lower() or page.evaluate('CALLS.length===1'))
 page.evaluate('P.dispose()');ck('knowledge dispose keeps root attributes',page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('data-host')=='preservar')
def macro(page):
 fresh(page,'macro');ck('macro no callback or action',page.evaluate('CALLS.length===0') and page.locator('#root button').count()==0);ck('macro labels preview','nada foi enviado' in page.locator('#root').inner_text());reflow(page,'macro')
 page.evaluate('P=SUPPORT.renderMacroPreview(document.querySelector("#root"),{body:"PRIVATE_ALREADY_SENT",sent:true})');ck('macro rejects already-sent shape','PRIVATE_ALREADY_SENT' not in page.locator('#root').inner_text());page.evaluate('P=SUPPORT.renderMacroPreview(document.querySelector("#root"),{body:"  ",sent:false})');ck('macro empty state','Nenhum texto' in page.locator('#root').inner_text());page.evaluate('P.dispose()');ck('macro cleaned',page.locator('#root').inner_text()=='')
def package(page):
 fresh(page,'package');ck('package no auto-download',page.evaluate('CALLS.length===0'));ck('private grant excluded from all DOM',page.evaluate('!["PRIVATE_FIXTURE", "private-package-id", "private.invalid"].some(x=>document.querySelector("#root").innerHTML.includes(x))'));ck('package expiry timezone explicit','São Paulo' in page.locator('#root').inner_text());reflow(page,'package')
 page.evaluate('MODE="delay"');action(page,'request-package').click();page.wait_for_function('!!DEFERRED');page.evaluate('document.querySelector("[data-ops-action=request-package]").click()');ck('package one original id per pending request',page.evaluate('CALLS.length===1&&CALLS[0].id==="private-package-id"'));page.evaluate('DEFERRED()');page.wait_for_function('!document.querySelector("[data-ops-action=request-package]").disabled');ck('package fulfilled callback not final download','não confirma a conclusão' in page.locator('#root').inner_text())
 page.evaluate('NOW=Date.parse("2026-10-13T13:00:00.000Z")');action(page,'request-package').click();ck('package expiry rechecked on click',page.evaluate('CALLS.length===1') and action(page,'request-package').is_disabled());ck('expired message','expir' in page.locator('#root').inner_text());reflow(page,'package-expired')
 page.evaluate('P=SUPPORT.renderPackage(document.querySelector("#root"),{id:"p",expiresAt:"2026-02-30T00:00:00.000Z",objectCount:-2},REQUEST,{now:()=>NOW})');ck('invalid date/count are not fabricated',action(page,'request-package').is_disabled() and 'Quantidade indisponível' in page.locator('#root').inner_text())
 fresh(page,'package');page.evaluate('MODE="delay"');action(page,'request-package').click();page.wait_for_function('!!DEFERRED');page.evaluate('P=SUPPORT.renderExternalWork(document.querySelector("#root"),{state:"waiting_internal"});DEFERRED()');page.wait_for_timeout(30);ck('late package result cannot change new context','encaminhada' not in page.locator('#root').inner_text() and 'desenvolvimento' in page.locator('#root').inner_text());page.evaluate('P.dispose()')
def external(page):
 fresh(page,'external');ck('external validation still required','validação humana' in page.locator('#root').inner_text());ck('external does not resolve','Chamado resolvido' not in page.locator('#root').inner_text());reflow(page,'external')
 for state in ['waiting_internal','waiting_release','awaiting_human_validation','done','__proto__','constructor','toString']:
  page.evaluate('(state)=>SUPPORT.renderExternalWork(document.querySelector("#root"),{state,url:"PRIVATE_URL",history:"PRIVATE_HISTORY"})',state)
  ck('external no extra fields '+state,'PRIVATE_' not in page.locator('#root').inner_text())
  if state in ['done','__proto__','constructor','toString']:ck('external unknown cannot become resolved '+state,'indisponível' in page.locator('#root').inner_text().lower() and 'function' not in page.locator('#root').inner_text())
def csat(page):
 fresh(page,'csat');score=page.get_by_label('Nota de 1 a 5',exact=True);comment=page.get_by_label('Comentário opcional',exact=True)
 ck('CSAT no default score',score.input_value()=='');ck('CSAT no vote on mount',page.evaluate('CALLS.length===0'));action(page,'send-csat').click();ck('CSAT invalid score focuses control',score.get_attribute('aria-invalid')=='true' and score.evaluate('(e)=>e===document.activeElement'))
 score.select_option('5');comment.fill('O atendimento trouxe clareza para a minha solicitação.');ck('CSAT selecting score is not a vote',page.evaluate('CALLS.length===0'));ck('corrected CSAT no stale error summary','Revise os campos' not in page.locator('#root').inner_text());reflow(page,'csat')
 page.evaluate('document.querySelector("[name=comment]").value="x".repeat(2001);document.querySelector("[name=comment]").dispatchEvent(new Event("input",{bubbles:true}))');action(page,'send-csat').click();ck('CSAT rejects comment above bound',comment.get_attribute('aria-invalid')=='true' and page.evaluate('CALLS.length===0'));comment.fill('Comentário preservado para conferência');page.evaluate('MODE="delay"');action(page,'send-csat').click();page.wait_for_function('!!DEFERRED');ck('CSAT pending locks both fields',score.is_disabled() and comment.is_disabled());page.evaluate('document.querySelector("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');ck('CSAT pending prevents duplicate',page.evaluate('CALLS.length===1'));page.evaluate('REJECT()');page.wait_for_function('!document.querySelector("[data-ops-action=retry-csat]").hidden');ck('CSAT uncertainty preserves comment',comment.input_value()=='Comentário preservado para conferência');ck('CSAT uncertainty focuses reconciliation',action(page,'retry-csat').evaluate('(e)=>e===document.activeElement'));reflow(page,'csat-uncertain')
 page.evaluate('MODE="ok"');action(page,'retry-csat').click();page.wait_for_function('document.querySelector("[data-ops-action=send-csat]").textContent==="Avaliação registrada"');ck('CSAT exact body/key on replay despite mutated callback object',page.evaluate('CALLS.length===2&&CALLS[0].key===CALLS[1].key&&JSON.stringify(CALLS[0].input)===JSON.stringify(CALLS[1].input)'));ck('CSAT success clears comment and prevents repeat',comment.input_value()=='' and action(page,'send-csat').is_disabled());ck('CSAT success counter cleared',page.locator('[data-support-counter]').inner_text().startswith('0 /'));reflow(page,'csat-confirmed')
 fresh(page,'csat');page.get_by_label('Nota de 1 a 5',exact=True).select_option('4');page.evaluate('MODE="delay"');action(page,'send-csat').click();page.wait_for_function('!!DEFERRED');page.locator('#outside').focus();page.evaluate('DEFERRED()');page.wait_for_timeout(30);ck('CSAT completion does not steal focus from outside',page.evaluate('document.activeElement.id==="outside"'))
 fresh(page,'csat');page.get_by_label('Nota de 1 a 5',exact=True).select_option('4');page.evaluate('MODE="wrong-attribution"');action(page,'send-csat').click();page.wait_for_function('!document.querySelector("[data-ops-action=retry-csat]").hidden');ck('CSAT wrong attribution is not confirmation','Avaliação registrada' not in page.locator('#root').inner_text())
 fresh(page,'csat');page.get_by_label('Nota de 1 a 5',exact=True).select_option('5');page.evaluate('MODE="delay"');action(page,'send-csat').click();page.wait_for_function('!!DEFERRED');page.evaluate('window.OLD=P;window.OLD_FIELDS=[...document.querySelectorAll("#root input,#root select,#root textarea")];P=SUPPORT.mountCsat(document.querySelector("#root"),VOTE);DEFERRED();OLD.dispose()');page.wait_for_timeout(30);ck('CSAT remount drops old result and old dispose',page.locator('#root select').input_value()=='' and 'Avaliação registrada' not in page.locator('#root').inner_text());ck('old CSAT inputs wiped',page.evaluate('OLD_FIELDS.every(e=>!e.value)'))
 page.evaluate('window.Q=SUPPORT.mountCsat(document.querySelector("#second"),VOTE);');ck('two CSAT panels have unique field ids',page.evaluate('(()=>{let a=[...document.querySelectorAll("[id]")].map(e=>e.id);return a.length===new Set(a).size})()'));page.evaluate('P.dispose()');ck('disposing first preserves second',page.locator('#second select').count()==1);page.evaluate('Q.dispose()')
 fresh(page,'csat');page.get_by_label('Nota de 1 a 5',exact=True).select_option('3');page.get_by_label('Comentário opcional',exact=True).fill('Valor não perdido ao trocar tema');page.evaluate('document.documentElement.dataset.theme="dark"');ck('CSAT theme preserves score/comment',page.locator('#root select').input_value()=='3' and page.locator('#root textarea').input_value()=='Valor não perdido ao trocar tema')
 page.set_viewport_size({'width':640,'height':720});ck('CSAT effective 200% viewport reflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));page.emulate_media(reduced_motion='reduce');ck('reduced motion no animation',page.locator('#root').evaluate('(e)=>[...e.querySelectorAll("*")].every(n=>getComputedStyle(n).animationName==="none")'));page.evaluate('P.dispose()')
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:exceptions.append(str(e)))
  for case in [knowledge,macro,package,external,csat]:case(page)
  ck('No JavaScript exceptions',not exceptions,exceptions)
  if not a.offline:ck('All script/style module requests served with correct MIME',all(r['status']==200 and (not r['path'].endswith('.css') or r['mime']=='text/css') for r in http if r['path']!='/favicon.ico'))
  browser.close()
except Exception as e:exceptions.append(str(e));traceback.print_exc()
finally:
 server.shutdown();report={'mode':'offline-native-modules' if a.offline else 'local-http-csp-synthetic-ports','hosted':False,'checks':checks,'exceptions':exceptions,'http':http,'passed':len([c for c in checks if c['passed']]),'failed':len([c for c in checks if not c['passed']])};(a.output/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:report[k] for k in ['mode','passed','failed','exceptions']},ensure_ascii=False))
raise SystemExit(1 if exceptions or any(not c['passed'] for c in checks) else 0)
