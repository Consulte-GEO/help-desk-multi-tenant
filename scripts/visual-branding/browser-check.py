#!/usr/bin/env python3
"""Visual-only browser bench. The real HTML/CSS/new JS run; /app.js is a fixture.
No real accounts, API, Supabase or production navigation. Not an end-to-end gate.
"""
from __future__ import annotations
import argparse, base64, functools, http.server, json, os, re, shutil, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--web-root',type=Path,default=HERE.parents[1]/'web')
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--baseline',action='store_true')
parser.add_argument('--quick',action='store_true')
parser.add_argument('--offline',action='store_true',help='Use set_content and native inline ES modules without navigation; origin persistence/CSP/HTTP are NOT tested.')
args=parser.parse_args();root=args.web_root.resolve();out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
if not (root/'index.html').is_file():raise SystemExit('web-root must contain a local index.html')
requests=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*values):pass
 def do_GET(self):
  path=self.path.split('?',1)[0];requests.append(path)
  if path=='/app.js':
   data=(HERE/'fixture.js').read_bytes();self.send_response(200);self.send_header('Content-Type','text/javascript; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if path.startswith('/v1') or path.startswith('/.netlify'):
   self.send_error(410,'Business transport is disabled in the visual bench');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
checks=[];screens=[];page_errors=[]
def check(name,condition,details=None):checks.append({'name':name,'passed':bool(condition),'details':details})
def no_overflow(page,name):
 data=page.evaluate('''() => ({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})''')
 check(name,data['document']<=data['viewport']+1 and data['body']<=data['viewport']+1,data)
def shot(page,name):
 page.evaluate("() => {if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);}")
 file=out/(name+'.png');page.screenshot(path=str(file),full_page=True);screens.append(file.name)
def set_screen(page,name):page.evaluate('(name)=>window.__HD_VISUAL_FIXTURE__.screen(name)',name);page.wait_for_timeout(60)
def offline_load(page):
 # This is a private harness transformation, never a production source mutation.
 # Preserve native DOM/CSS/ES-module semantics, but do not navigate or fetch any resource.
 html=(root/'index.html').read_text()
 html=re.sub(r'<script\b[^>]*src=[^>]*>\s*</script>','',html,flags=re.I)
 html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I)
 css=(root/'styles.css').read_text()
 bootstrap=''
 if not args.baseline:
  css+='\n'+(root/'design-tokens.css').read_text()+'\n'+re.sub(r'@import[^;]+;','',(root/'consulte-theme.css').read_text())
  if (root/'form-experience.css').exists():css+='\n'+re.sub(r'@import[^;]+;','',(root/'form-experience.css').read_text())
  bootstrap='<script>'+(root/'theme-init.js').read_text()+'</script>'
 html=html.replace('</head>',bootstrap+'<style>'+css+'</style></head>')
 page.set_content(html,wait_until='domcontentloaded')
 page.add_script_tag(type='module',content=(HERE/'fixture.js').read_text())
 if not args.baseline:
  profile=(root/'brand-profile.js').read_text()
  for name in ['consulte-geo-color.png','consulte-geo-white.png']:
   uri='data:image/png;base64,'+base64.b64encode((root/'assets'/name).read_bytes()).decode()
   profile=profile.replace('/assets/'+name,uri)
  uri='data:text/javascript;base64,'+base64.b64encode(profile.encode()).decode()
  module=(root/'brand-shell.js').read_text().replace("'./brand-profile.js'",repr(uri))
  page.add_script_tag(type='module',content=module)
 page.wait_for_function('window.__HD_VISUAL_FIXTURE__?.ready===true')
 if not args.baseline: page.wait_for_function('document.getElementById("hd-theme-login")!==null')
 page.wait_for_timeout(100)
started=time.time()
try:
 with sync_playwright() as p:
  executable=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
  browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox']) if executable else p.chromium.launch(headless=True)
  browser_version=browser.version
  context=browser.new_context(viewport={'width':1440,'height':1000},color_scheme='light',reduced_motion='reduce')
  page=context.new_page();page.on('pageerror',lambda error:page_errors.append(str(error)))
  if args.offline: offline_load(page)
  else:
   page.goto(url,wait_until='networkidle');page.wait_for_function('window.__HD_VISUAL_FIXTURE__?.ready===true')
  check('no JavaScript exception at startup',not page_errors,list(page_errors))
  if args.baseline:
   set_screen(page,'login');shot(page,'before-login-desktop');set_screen(page,'detail');shot(page,'before-detail-desktop');no_overflow(page,'baseline desktop overflow')
  else:
   skip=page.locator('#hd-skip-login').evaluate('(n)=>({bottom:n.getBoundingClientRect().bottom, height:n.getBoundingClientRect().height, transform:getComputedStyle(n).transform, focused:document.activeElement===n, display:getComputedStyle(n).display,position:getComputedStyle(n).position})')
   check('unfocused skip link is fully offscreen',skip['bottom']<=0,skip)
   check('theme control mounted',page.locator('#hd-theme-login').count()==1)
   check('external required label is decorated without moving its control',page.evaluate("() => !!document.querySelector('label[for=\"assignment-reason\"] .hd-required') && document.getElementById('assignment-reason').parentElement.id==='assignment-form'"))
   check('initial entry stays disabled',page.locator('#submit-login').is_disabled())
   check('application remains hidden before fixture activation',page.locator('#app').is_hidden())
   check('all four advanced-access containers remain hidden and inert',page.evaluate("() => [...document.querySelectorAll('[data-advanced-access]')].every(n=>n.hidden&&n.inert)"))
   widths=[1440] if args.quick else [320,390,768,1024,1440]
   for theme in ['light','dark']:
    for width in widths:
     page.set_viewport_size({'width':width,'height':900})
     set_screen(page,'login');page.locator('#hd-theme-login').select_option(theme)
     check(f'{width}/{theme}: theme selected',page.get_attribute('html','data-theme')==theme)
     for screen in ['login','paused','inbox','customer','detail','internal','history','guide']:
      set_screen(page,screen);no_overflow(page,f'{width}/{theme}/{screen}: document reflow')
      check(f'{width}/{theme}/{screen}: protected containers stay concealed',page.evaluate("() => [...document.querySelectorAll('[data-advanced-access]')].every(n=>n.hidden&&n.inert)"))
     set_screen(page,'detail')
     sizes=page.evaluate("() => [...document.querySelectorAll('#new-ticket,#refresh,#hd-theme-app,#search,#status-filter,#priority-filter,#message-body,#send-message')].map(n=>({id:n.id,height:n.getBoundingClientRect().height})).filter(n=>n.height<44)")
     check(f'{width}/{theme}: primary controls at least 44px high',not sizes,sizes)
     set_screen(page,'paused')
     check(f'{width}/{theme}: closed service retains disabled create',page.locator('#new-ticket').is_disabled())
     check(f'{width}/{theme}: closed service retains non-fictitious count',page.locator('#stat-total').inner_text()=='—')
     set_screen(page,'customer')
     check(f'{width}/{theme}: private note control remains hidden for customer fixture',page.locator('#note-tab').is_hidden())
     set_screen(page,'detail');page.locator('#message-body').fill('Rascunho fictício preservado após a mudança de tema.')
     page.locator('#hd-theme-app').select_option('dark' if theme=='light' else 'light')
     check(f'{width}/{theme}: theme preserves draft',page.locator('#message-body').input_value()=='Rascunho fictício preservado após a mudança de tema.')
     page.locator('#hd-theme-app').select_option(theme)
     if width<=900:
      check(f'{width}/{theme}: mobile navigation starts collapsed',page.locator('#hd-nav-panel').is_hidden())
      page.locator('#hd-nav-toggle').click()
      check(f'{width}/{theme}: mobile navigation expands',page.locator('#hd-nav-panel').is_visible())
      page.keyboard.press('Tab');page.keyboard.press('Escape')
      check(f'{width}/{theme}: Escape collapses disclosure',page.locator('#hd-nav-panel').is_hidden())
      check(f'{width}/{theme}: Escape restores trigger focus',page.evaluate("document.activeElement.id==='hd-nav-toggle'"))
     page.evaluate('window.__HD_VISUAL_FIXTURE__.longText()');no_overflow(page,f'{width}/{theme}: long identifiers reflow')
     page.evaluate('window.__HD_VISUAL_FIXTURE__.createDialog()');no_overflow(page,f'{width}/{theme}: create dialog reflow')
     rect=page.locator('#create-dialog').bounding_box();check(f'{width}/{theme}: dialog fits viewport',bool(rect and rect['x']>=0 and rect['x']+rect['width']<=width+1),rect)
     check(f'{width}/{theme}: required subject remains required',page.locator('#subject').get_attribute('required') is not None)
     page.locator('#subject').fill('Teste visual de solicitação');page.locator('#description').fill('Dados exclusivamente fictícios para inspeção da interface.');page.locator('#cancel-create').click()
     check(f'{width}/{theme}: native create dialog closes',not page.locator('#create-dialog').is_visible())
     if width in [390,1440]:
      for screen in (['login','paused','detail'] if width==1440 else ['login','inbox','customer']):
       set_screen(page,screen);shot(page,f'{screen}-{width}-{theme}')
      set_screen(page,'detail');page.evaluate('window.__HD_VISUAL_FIXTURE__.createDialog()');shot(page,f'create-{width}-{theme}');page.locator('#cancel-create').click()
   # Exercise preserved dialogs only by explicit visual fixture; never enable in production code.
   page.set_viewport_size({'width':390,'height':900});set_screen(page,'login');page.locator('#hd-theme-login').select_option('dark')
   for ident in ['workspace-change-dialog','recovery-dialog','security-dialog','mfa-enrollment-dialog','password-change-dialog','logout-all-dialog']:
    page.evaluate('(id)=>window.__HD_VISUAL_FIXTURE__.advanced(id)',ident);no_overflow(page,'preserved '+ident+': mobile reflow');page.locator('#'+ident).evaluate('(dialog)=>dialog.close()')
   set_screen(page,'login')
   check('advanced fixture restores hidden/inert protection',page.evaluate("() => [...document.querySelectorAll('[data-advanced-access]')].every(n=>n.hidden&&n.inert)"))
   page.locator('#hd-theme-login').select_option('auto');page.emulate_media(color_scheme='dark');page.wait_for_timeout(80)
   check('automatic theme follows dark OS preference',page.evaluate("getComputedStyle(document.documentElement).colorScheme==='dark'"))
   page.emulate_media(color_scheme='light');page.wait_for_timeout(80)
   check('automatic theme follows light OS preference',page.evaluate("getComputedStyle(document.documentElement).colorScheme==='light'"))
   if args.offline:
    check('storage denial does not prevent manual theme selection',page.get_attribute('html','data-theme')=='auto')
   else:
    check('storage contains only the allowlisted visual preference',page.evaluate("() => Object.keys(localStorage).every(key=>key==='helpdesk.ui.theme')"))
    page.reload(wait_until='networkidle');check('theme preference survives reload',page.get_attribute('html','data-theme')=='auto')
   check('no JavaScript exception during the matrix',not page_errors,list(page_errors))
   check('no business endpoint requested',not any(x.startswith('/v1') or x.startswith('/.netlify') for x in requests))
   check('no missing brand image',page.evaluate("() => [...document.querySelectorAll('img.hd-logo')].every(img=>img.complete&&img.naturalWidth>0)"))
  context.close();browser.close()
except Exception as exc:
 checks.append({'name':'browser harness execution','passed':False,'details':str(exc)})
finally:
 server.shutdown();server.server_close()
 report={'scope':'Visual bench: original HTML, legacy CSS and candidate visual modules; /app.js replaced by private fixture. NO real authentication, API or database.','baseline':args.baseline,'mode':'offline native DOM/CSS/ESM; specifiers and asset paths transformed by bench' if args.offline else 'loopback HTTP','not_executed':(['original HTTP module resolution','Content Security Policy','same-origin localStorage persistence'] if args.offline else [])+['real app.js business controller','real Auth/API/PostgreSQL','production browser'],'browser':locals().get('browser_version','unknown'),'duration_seconds':round(time.time()-started,2),'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'page_errors':page_errors,'screenshots':screens,'business_requests':[x for x in requests if x.startswith('/v1') or x.startswith('/.netlify')]}
 (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:report[k] for k in ['scope','browser','duration_seconds','passed','failed','page_errors']},ensure_ascii=False,indent=2))
 for item in checks:
  if not item['passed']:print('FAIL:',item['name'],item.get('details',''))
 raise SystemExit(1 if report['failed'] else 0)
