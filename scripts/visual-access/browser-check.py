#!/usr/bin/env python3
"""UX08 real presentation + original GEO controller, fake transports. No hosted/Auth approval."""
import argparse,base64,json,re,threading,traceback,shutil
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from visual_fixture_html import without_scripts
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--offline',action='store_true');a=p.parse_args();src=Path(__file__).resolve().parents[2];web=src/'web';a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];http=[];cache={};missing=set()
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:print('FAIL',name,detail,flush=True)
def module(file):
 file=file.resolve()
 if file not in cache:
  s=file.read_text();s=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",lambda m:m[1]+repr(module(file.parent/m[3])),s)
  s=re.sub(r"import\((['\"])(\.[^'\"]+)\1\)",lambda m:'import('+repr(module(file.parent/m[2]))+')',s)
  cache[file]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
 return cache[file]
def html():
 s=without_scripts((web/'index.html').read_text())
 def css(m):
  name=m[1].lstrip('/');f=web/name
  if not f.exists():missing.add(name);return ''
  if not a.offline:return '<link rel="stylesheet" href="/web/'+name+'">'
  return '<style>'+re.sub(r'@import[^;]+;','',f.read_text())+'</style>'
 s=re.sub(r'<link rel="stylesheet" href="([^"]+)">',css,s)
 if a.offline:s=s.replace('</head>','<style>'+ (web/'design-tokens.css').read_text()+'</style></head>')
 # Base legacy stylesheet is not in the visual package. Scoped test layout only;
 # this MUST NOT be confused with the full production stylesheet/controller.
 s=s.replace('</head>','<style>body{margin:0}button,input,select,textarea{font:inherit}[hidden]{display:none!important}.login-screen{display:grid;place-items:center;min-height:100vh}.login-card{width:100%;max-width:465px}.topbar,.identity,.page-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}label{display:block}dialog{border:1px solid var(--hd-line);background:var(--hd-surface);color:var(--hd-ink);padding:24px}dialog label{margin-top:14px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%)}.test-tools{position:fixed;right:4px;bottom:4px;z-index:9999}.test-tools button{min-height:44px}</style></head>')
 s=s.replace('</body>','<div class="test-tools"><button id="outside">Controle externo de teste</button></div></body>')
 if not a.offline:s=s.replace('</head>','<script type="module" src="/scripts/visual-access/fixture.js"></script></head>')
 return s
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  name=urlsplit(self.path).path;data=None;mime='text/plain'
  if name=='/':data=html().encode();mime='text/html'
  elif name.startswith(('/web/','/scripts/visual-access/')):
   f=(src/name.lstrip('/')).resolve()
   if f.is_relative_to(src) and f.is_file() and f.suffix in ['.js','.css','.png']:
    data=f.read_bytes();mime={'.js':'text/javascript','.css':'text/css','.png':'image/png'}[f.suffix]
  code=200 if data is not None else 404;http.append({'path':name,'status':code,'mime':mime});self.send_response(code);self.send_header('Content-Type',mime);self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data or b'Not found')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
def fresh(page):
 if a.offline:
  page.goto('about:blank');page.set_content(html());page.add_script_tag(type='module',content='import '+repr(module(Path(__file__).parent/'fixture.js'))+';')
 else:page.goto('http://127.0.0.1:'+str(server.server_port))
 page.wait_for_function('window.READY===true')
 if a.offline:
  for n in ['consulte-geo-color.png','consulte-geo-white.png']:
   b64=base64.b64encode((web/'assets'/n).read_bytes()).decode();page.locator('img[src$="'+n+'"]').evaluate_all('(es,u)=>es.forEach(e=>e.src=u)','data:image/png;base64,'+b64)
def reflow(page,name,root):
 for theme in ['light','dark']:
  for w in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':w,'height':840});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(name+f' reflow {w}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   bad=page.locator(root+' button').evaluate_all('(es)=>es.filter(e=>e.getClientRects().length&&!e.closest("[hidden],[inert]")).filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.id)')
   ck(name+f' targets {w}/{theme}',not bad,bad)
   if w<=390:
    small=page.locator(root+' input,'+root+' select,'+root+' textarea').evaluate_all('(es)=>es.filter(e=>e.getClientRects().length&&!e.closest("[hidden],[inert]")).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)');ck(name+f' font {w}/{theme}',not small,small)
   if w in [390,1440]:
    page.locator('.test-tools').evaluate('(e)=>e.hidden=true');page.screenshot(path=str(a.output/f'{name}-{w}-{theme}.png'),full_page=True);page.locator('.test-tools').evaluate('(e)=>e.hidden=false')
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which("chromium"));context=browser.new_context(viewport={'width':390,'height':840});page=context.new_page();page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
  fresh(page);ck('design tokens loaded in real computed style',page.evaluate('getComputedStyle(document.body).getPropertyValue("--hd-font").trim().length>0'));assert checks[-1]['passed'],'Token stylesheet missing from offline fixture'
  ck('no automatic input focus',page.evaluate('document.activeElement===document.body'))
  ck('simple advanced wrappers remain hidden/inert',page.locator('[data-advanced-access]').evaluate_all('(es)=>es.every(e=>e.hidden&&e.inert)'))
  page.evaluate('UX.configuration(false)');ck('unavailable never enables login',page.locator('#submit-login').is_disabled());ck('unavailable not blamed on password','indisponível' in page.locator('#login-status').inner_text());reflow(page,'login-unavailable','#login-screen')
  page.evaluate('enableSimple()');ck('configuration recovery clears only its stale unavailability message',page.locator('#login-status').inner_text()=='');page.locator('#email').fill('invalid');page.locator('#submit-login').click();ck('invalid email linked to local error',page.locator('#email').get_attribute('aria-invalid')=='true');ck('local errors not raw credentials','invalid' not in page.locator('#hd-access-error-email').inner_text());ck('first invalid field receives focus',page.locator('#email').evaluate('(e)=>e===document.activeElement'))
  page.locator('#email').fill('person@example.invalid');page.locator('#password').fill('synthetic-unread-password');ck('corrected field clears local invalid',page.locator('#email').get_attribute('aria-invalid') is None)
  page.evaluate('hostPhase("signing_in")');ck('busy announced on button',page.locator('#submit-login').get_attribute('aria-busy')=='true');ck('presentation does not read/clear credential',page.locator('#password').input_value()=='synthetic-unread-password');ck('no request from presentation',page.evaluate('REQUESTS.length===0'));page.locator('#password').fill('');reflow(page,'login-busy','#login-screen')
  page.evaluate('hostFailure("hd_person_PRIVATE_ERROR")');ck('unknown auth error is sanitized','PRIVATE' not in page.locator('#login-status').inner_text());ck('error associates form status','login-status' in page.locator('#login-form').get_attribute('aria-describedby'))
  for c in ['login_failed','auth_rate_limited','simple_mfa_required','simple_workspace_required','membership_required']:
   page.evaluate('(c)=>hostFailure(c)',c);ck('known code '+c+' does not reflect code',c not in page.locator('#login-status').inner_text())
  reflow(page,'login-error','#login-screen')
  page.locator('#email').focus();page.evaluate('hostLogin()');page.wait_for_timeout(30);ck('login navigation transfers focus to visible heading',page.locator('#tickets-view h1').evaluate('(e)=>e===document.activeElement'))
  page.locator('#message-body').fill('Rascunho da identidade atual');page.locator('#message-body').focus();page.evaluate('hostPhase("paused")');ck('paused leaves draft intact',page.locator('#message-body').input_value()=='Rascunho da identidade atual');ck('paused does not steal focus',page.locator('#message-body').evaluate('(e)=>e===document.activeElement'));ck('session message remains atomic',page.locator('#session-banner').get_attribute('aria-atomic')=='true');reflow(page,'session-paused','#session-banner')
  page.locator('#message-body').focus();page.evaluate('hostPhase("refreshing")');ck('refresh does not steal focus',page.locator('#message-body').evaluate('(e)=>e===document.activeElement'));ck('refresh never enables retry',page.locator('#retry-session').is_disabled());page.evaluate('hostPhase("active")');ck('resume retains text',page.locator('#message-body').input_value()=='Rascunho da identidade atual')
  page.locator('#identity-name').evaluate('(e)=>{e.tabIndex=0;e.focus()}');page.evaluate('hostLogout()');page.wait_for_timeout(30);ck('logout navigation returns focus to email',page.locator('#email').evaluate('(e)=>e===document.activeElement'));ck('host-cleared draft not restored by presentation',page.locator('#message-body').input_value()=='')
  page.locator('#outside').focus();page.evaluate('hostLogin()');page.wait_for_timeout(30);ck('navigation does not steal external focus',page.locator('#outside').evaluate('(e)=>e===document.activeElement'))
  page.evaluate('hostLogout()');before=page.locator('#email').get_attribute('aria-describedby');page.evaluate('UX.dispose();UX.dispose()');ck('dispose removes only own field feedback',page.locator('#hd-access-error-email').count()==0 and page.locator('#session-banner h2').count()==0);ck('dispose leaves login handlers/controls',page.locator('#login-form').count()==1 and page.locator('#email').count()==1)
  fresh(page)
  for dialog in ['workspace-change-dialog','recovery-dialog','security-dialog','mfa-enrollment-dialog','password-change-dialog','logout-all-dialog']:
   page.evaluate('(id)=>openAdvanced(id)',dialog)
   for theme in ['light','dark']:
    for w in [390,1440]:
     page.set_viewport_size({'width':w,'height':600});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);box=page.locator('#'+dialog).bounding_box();ck(dialog+f' fits {w}/{theme}',box['width']<=w and box['height']<=600+1);ck(dialog+f' no horizontal {w}/{theme}',page.locator('#'+dialog).evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
     small=page.locator('#'+dialog+' input,#'+dialog+' select,#'+dialog+' textarea').evaluate_all('(es)=>es.filter(e=>e.getClientRects().length&&!e.closest("[hidden],[inert]")).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)');ck(dialog+f' mobile font {w}/{theme}',w>390 or not small,small)
   page.evaluate('(id)=>closeAdvanced(id)',dialog)
  ck('advanced fixtures restored hidden/inert',page.locator('[data-advanced-access]').evaluate_all('(es)=>es.every(e=>e.hidden&&e.inert)'))
  # Preserved MFA login panel is opened by TEST ONLY, without Auth or feature activation.
  page.evaluate("()=>{const p=document.getElementById('mfa-panel'),box=p.closest('[data-advanced-access]');box.hidden=false;box.inert=false;p.hidden=false;document.getElementById('mfa-status').textContent='Cenário visual fictício. Nenhum código será validado.';}")
  reflow(page,'advanced-mfa-preserved','#mfa-panel')
  ck('MFA fixture never consumes a code',page.evaluate('REQUESTS.length===0'))
  page.evaluate("()=>{const p=document.getElementById('mfa-panel'),box=p.closest('[data-advanced-access]');p.hidden=true;box.hidden=true;box.inert=true;document.getElementById('mfa-status').textContent='';}")
  ck('MFA fixture restores preserved access guard',page.locator('[data-advanced-access]').evaluate_all('(es)=>es.every(e=>e.hidden&&e.inert)'))
  fresh(page);page.evaluate('callbackSetup("ready")');ck('GEO no consumption on mount',page.evaluate('REQUESTS.length===0'));ck('GEO URL cleaned before submit',page.evaluate('HISTORY[0]==="/auth/geo/callback"&&!RETURN_LOCATION.href.includes("PRIVATE")'));ck('GEO secrets absent from surface',not any(s in page.locator('.hd-geo-access').inner_text() for s in ['PRIVATE','hd_person','origin.example']));ck('GEO mounted twice is same instance',page.evaluate('REMOUNT_RETURN()===CB&&REQUESTS.length===0'));reflow(page,'callback-ready','.hd-geo-access')
  page.evaluate('RETURN_MODE="delay"');page.locator('#confirm-geo-login').click();page.wait_for_function('!!window.RESOLVE_RETURN');page.evaluate('document.querySelector("#confirm-geo-login").click()');ck('GEO only one pending consumption',page.evaluate('REQUESTS.length===1'));page.locator('#outside').focus();page.evaluate('RESOLVE_RETURN()');page.wait_for_function('ADOPTIONS.length===1');ck('GEO success retains external focus',page.locator('#outside').evaluate('(e)=>e===document.activeElement'));ck('GEO host return path unchanged',page.evaluate('HISTORY.at(-1)==="/portal"'));ck('GEO cancel not offered as logout',page.locator('#cancel-geo-login').is_disabled());ck('GEO credential not rendered',not any(s in page.locator('.hd-geo-access').inner_text() for s in ['hd_person','PRIVATE']));reflow(page,'callback-confirmed','.hd-geo-access')
  for mode in ['invalid','unconfigured','refused','incompatible','mount-failed']:
   page.evaluate('(m)=>callbackSetup(m)',mode)
   if mode in ['invalid','unconfigured']:ck('GEO '+mode+' no submit',page.locator('#confirm-geo-login').is_disabled() and page.evaluate('REQUESTS.length===0'))
   else:
    page.locator('#confirm-geo-login').click();page.wait_for_function('document.querySelector(".hd-geo-access").dataset.geoStage==="error"');ck('GEO '+mode+' not authenticated',page.evaluate('!CB.controller.view().authenticated&&CB.controller.accessToken()===null'));ck('GEO '+mode+' one use only',page.evaluate('REQUESTS.length===1'));ck('GEO '+mode+' safe error','PRIVATE' not in page.locator('#geo-login-status').inner_text())
  reflow(page,'callback-error','.hd-geo-access')
  page.evaluate('callbackSetup("delay")');page.locator('#confirm-geo-login').click();page.wait_for_function('!!RESOLVE_RETURN');page.locator('#cancel-geo-login').click();page.evaluate('RESOLVE_RETURN()');page.wait_for_timeout(30);ck('GEO late response after cancel not adopted',page.evaluate('ADOPTIONS.length===0&&CB.controller.accessToken()===null'));ck('GEO cancelled state preserved',page.locator('.hd-geo-access').get_attribute('data-geo-stage')=='cancelled');ck('GEO cancel focus to confirmation',page.locator('#geo-login-status').evaluate('(e)=>e===document.activeElement'))
  page.evaluate('CB.destroy();CB.destroy()');ck('GEO owned DOM removed and original controls preserved',page.locator('.hd-geo-access').count()==0 and page.locator('#confirm-geo-login').count()==1 and page.locator('#geo-login-status').inner_text()=='');ck('GEO disposal restores original button labels',page.locator('#confirm-geo-login').inner_text()=='Confirmar' and page.locator('#cancel-geo-login').inner_text()=='Cancelar');ck('GEO disposed handlers inert',page.evaluate('document.getElementById("confirm-geo-login").onclick===null&&document.getElementById("cancel-geo-login").onclick===null'))
  ck('no browser exceptions',not errors,errors);context.close();browser.close()
except Exception as e:
 errors.append(str(e));traceback.print_exc()
finally:
 server.shutdown();result={'suite':'UX08','mode':'offline' if a.offline else 'http-local','checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'exceptions':errors,'missingOriginalAssets':sorted(missing),'requests':http,'limits':['synthetic authentication phase fixture, not app.js','original GEO controller with fictitious transport','no backend, real Auth, PostgreSQL, hosted CSP or production acceptance']};(a.output/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:result[k] for k in ['passed','failed','exceptions','mode']},ensure_ascii=False))
raise SystemExit(1 if errors or any(not c['passed'] for c in checks) else 0)
