#!/usr/bin/env python3
"""UX02 native DOM/module bench with synthetic controller callbacks. Not Auth/API E2E.
Uses set_content because local HTTP navigation may be blocked. No credential/data network.
"""
import argparse,base64,json,re,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--web-root',type=Path,default=HERE.parents[1]/'web');a=p.parse_args();root=a.web_root.resolve();a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ck(name,ok,details=None):
 checks.append(dict(name=name,passed=bool(ok),details=details))
 if not ok:print('FAIL:',name,details)
def uri(text):return 'data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
def setup(page):
 html=(root/'index.html').read_text();html=re.sub(r'<script\b[^>]*src=[^>]*>\s*</script>','',html,flags=re.I);html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I)
 css='\n'.join(re.sub(r'@import[^;]+;','',(root/f).read_text()) for f in ['styles.css','design-tokens.css','consulte-theme.css']+(['inbox-workspace.css'] if (root/'inbox-workspace.css').exists() else [])+(['form-experience.css'] if (root/'form-experience.css').exists() else []))
 page.set_content(html.replace('</head>','<style>'+css+'</style></head>'),wait_until='domcontentloaded')
 page.add_script_tag(type='module',content=(HERE.parent/'visual-branding/fixture.js').read_text())
 brand=(root/'brand-profile.js').read_text()
 for name in ['consulte-geo-color.png','consulte-geo-white.png']:brand=brand.replace('/assets/'+name,'data:image/png;base64,'+base64.b64encode((root/'assets'/name).read_bytes()).decode())
 page.add_script_tag(type='module',content=(root/'brand-shell.js').read_text().replace("'./brand-profile.js'",repr(uri(brand))))
 page.wait_for_function('!!window.__HD_VISUAL_FIXTURE__ && !!document.getElementById("hd-theme-login")')
 page.evaluate('''()=>{window.__UX_CALLS__=0;window.__ORIGINAL_NODES__=Object.fromEntries(['transition-area','assignment-form','priority-form','message-body','search','status-filter','priority-filter','assignment-filter'].map(id=>[id,document.getElementById(id)]));}''')
 if not (root/'inbox-workspace.js').exists():return False
 module=(root/'inbox-workspace.js').read_text().replace("'./inbox-view-state.js'",repr(uri((root/'inbox-view-state.js').read_text())))
 page.add_script_tag(type='module',content=module+'''\nwindow.__UX__=mountInboxWorkspace(document,{retryDetail:()=>window.__UX_CALLS__++});''')
 page.wait_for_function('!!window.__UX__');return True

def screen(page,name='detail'):
 page.evaluate('(s)=>window.__HD_VISUAL_FIXTURE__.screen(s)',name);page.wait_for_timeout(40)
def choose(page,id='synthetic-a',navigate=True):
 page.evaluate('([id,navigate])=>{window.__OP__=__UX__.beginDetail(id,navigate)}',[id,navigate])
def finish(page):page.evaluate('__UX__.finishDetail(window.__OP__)');page.wait_for_timeout(40)
def nooverflow(page,label):
 d=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');ck(label,d['scroll']<=d['width']+1,d)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':900},reduced_motion='reduce');page=c.new_page();page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
 ready=setup(page);ck('native UX02 module is available and mounts',ready)
 if ready:
  for theme in ['light','dark']:
   for width in [320,390,768,1024,1440]:
    label=f'{width}/{theme}';page.set_viewport_size({'width':width,'height':900});screen(page,'login');page.locator('#hd-theme-login').select_option(theme);screen(page);page.evaluate('document.getElementById("ticket-filters").reset();document.getElementById("priority-status").textContent="";document.getElementById("assignment-status").textContent="";__UX__.reset();__UX__.setAvailability(true,true);__UX__.setFilters({},false)');page.wait_for_timeout(30)
    ck(label+' list-first',page.get_attribute('#tickets-view','data-inbox-pane')=='list');nooverflow(page,label+' list reflow')
    ck(label+' progressive filters collapsed',not page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open'))
    ck(label+' search visible',page.locator('#search').is_visible());ck(label+' apply visible',page.locator('#apply-filters').is_visible())
    page.locator('#search').fill('ação');ck(label+' draft message appears',page.locator('#hd-filter-draft').is_visible())
    page.evaluate('__UX__.setFilters({q:"ação",status:"in_progress"},false)');ck(label+' typed status not yet applied remains distinguished',page.locator('#hd-filter-draft').is_visible())
    page.locator('#hd-filter-disclosure summary').click();page.locator('#status-filter').select_option('in_progress');page.wait_for_timeout(20);ck(label+' matching fields clear draft message',page.locator('#hd-filter-draft').is_hidden())
    ck(label+' effective advanced count', '1 ativo' in page.locator('#hd-filter-disclosure summary').inner_text())
    page.locator('#hd-filter-disclosure summary').click();choose(page);ck(label+' explicit selection opens detail',page.get_attribute('#tickets-view','data-inbox-pane')=='detail');finish(page)
    ck(label+' desktop split or mobile detail',page.locator('.ticket-panel').is_visible()==(width>1100));ck(label+' detail remains visible',page.locator('.detail-panel').is_visible());nooverflow(page,label+' detail reflow')
    if width<=1100:ck(label+' focus lands on title',page.evaluate('document.activeElement.id')=='ticket-title')
    page.locator('#message-body').fill('Rascunho: çã — não perder.');page.evaluate('window.__OP__=__UX__.beginDetail("synthetic-a",false)');finish(page);ck(label+' refresh preserves draft',page.locator('#message-body').input_value()=='Rascunho: çã — não perder.')
    if width<=1100:
     ck(label+' refresh does not steal input focus',page.evaluate('document.activeElement.id')=='message-body');page.locator('#hd-back-to-tickets').click();ck(label+' back shows list',page.locator('.ticket-panel').is_visible());ck(label+' back preserves draft',page.locator('#message-body').input_value()=='Rascunho: çã — não perder.');choose(page);page.locator('#hd-back-to-tickets').click();finish(page);ck(label+' late read cannot navigate back',page.get_attribute('#tickets-view','data-inbox-pane')=='list');choose(page);finish(page)
    ck(label+' same protected DOM nodes',page.evaluate('Object.entries(__ORIGINAL_NODES__).every(([id,n])=>document.getElementById(id)===n)'))
    ck(label+' actions after composer',page.evaluate('!!(document.getElementById("message-form").compareDocumentPosition(document.getElementById("hd-ticket-tools")) & Node.DOCUMENT_POSITION_FOLLOWING)'))
    page.evaluate('document.getElementById("hd-ticket-tools").open=true;document.getElementById("priority-reason").value="Motivo preservado";document.getElementById("hd-ticket-tools").open=false;document.getElementById("priority-status").textContent="Versão alterada. Confira antes de reenviar."');page.wait_for_timeout(40)
    ck(label+' conflict opens action disclosure',page.locator('#hd-ticket-tools').evaluate('(n)=>n.open'));ck(label+' conflict preserves reason',page.locator('#priority-reason').input_value()=='Motivo preservado')
    page.evaluate('document.getElementById("hd-ticket-tools").open=false');page.wait_for_timeout(30);ck(label+' collapsed conflict still discoverable',page.locator('#hd-tools-feedback').is_visible())
    screen(page,'internal');page.wait_for_timeout(40);ck(label+' explicit internal-note warning',page.locator('#hd-internal-warning').is_visible())
    screen(page,'customer');page.wait_for_timeout(40);ck(label+' private warning stays hidden for customer',page.locator('#hd-internal-warning').is_hidden());ck(label+' hidden internal tab not exposed',page.locator('#note-tab').is_hidden());nooverflow(page,label+' customer reflow')
    page.evaluate('document.getElementById("transition-area").hidden=true;document.getElementById("assignment-form").hidden=true;document.getElementById("priority-form").hidden=true');page.wait_for_timeout(40);ck(label+' no authorized actions means no disclosure',page.locator('#hd-ticket-tools').is_hidden());ck(label+' no internal feedback leak',page.locator('#hd-tools-feedback').is_hidden())
    choose(page);page.evaluate('__UX__.failDetail(__OP__,403)');page.wait_for_timeout(30);ck(label+' refusal does not offer automatic retry',page.locator('#hd-detail-retry').is_hidden());ck(label+' refusal state explains access', 'acesso' in page.locator('#hd-detail-read-status').inner_text())
    choose(page);page.evaluate('__UX__.failDetail(__OP__,503)');page.wait_for_timeout(30);ck(label+' transient failure offers explicit retry',page.locator('#hd-detail-retry').is_visible());page.locator('#hd-detail-retry').click();ck(label+' retry callback invoked',page.evaluate('__UX_CALLS__')>0)
    screen(page);choose(page);finish(page)
    page.evaluate('__UX__.setAvailability(true,false)');ck(label+' closed-gate explanation', 'preparação' in page.locator('#hd-guide-availability').inner_text());page.evaluate('__UX__.setAvailability(true,true)')
    if width in [390,1440]:
     page.evaluate('document.getElementById("hd-ticket-tools").open=false;document.activeElement.blur();window.scrollTo(0,0)');page.screenshot(path=str(a.output/f'conversation-{width}-{theme}.png'),full_page=True)
     page.evaluate('__UX__.backToList()');page.wait_for_timeout(30);page.screenshot(path=str(a.output/f'inbox-{width}-{theme}.png'),full_page=True)
  # Concurrency, focus and disposal are not simulated writes.
  screen(page);page.set_viewport_size({'width':390,'height':900});page.evaluate('__UX__.reset();window.__A__=__UX__.beginDetail("a",true);window.__B__=__UX__.beginDetail("b",true);__UX__.finishDetail(__A__)');ck('stale A ignored while B loading',page.locator('#hd-detail-read-status').inner_text().startswith('Carregando'));page.evaluate('__UX__.finishDetail(__B__)')
  page.evaluate('window.__OLD__=__UX__.beginDetail("a",true);__UX__.reset();__UX__.finishDetail(__OLD__)');ck('identity reset rejects callback',page.get_attribute('#tickets-view','data-inbox-pane')=='list')
  screen(page);page.set_viewport_size({'width':390,'height':900});page.evaluate('__UX__.reset();document.querySelector(".ticket-card").setAttribute("data-ticket-id","synthetic-a");document.querySelector(".ticket-card").focus();window.scrollTo(0,180);window.__SCROLL_BEFORE__=window.scrollY');choose(page);finish(page)
  page.locator('#hd-back-to-tickets').click();page.wait_for_timeout(60);ck('back restores actual card focus by stable ID',page.evaluate('document.activeElement.getAttribute("data-ticket-id")')=='synthetic-a');ck('back restores window scroll',page.evaluate('Math.abs(window.scrollY-window.__SCROLL_BEFORE__)<=2'))
  choose(page);finish(page);page.locator('#hd-back-to-tickets').focus();page.set_viewport_size({'width':1440,'height':900});page.wait_for_timeout(60);ck('desktop resize cannot leave focus in hidden back toolbar',page.evaluate('document.activeElement.id')=='ticket-title')
  page.set_viewport_size({'width':390,'height':900});page.locator('#hd-nav-toggle').click();page.locator('[data-view=guide]').click();page.locator('#hd-nav-toggle').click();page.locator('[data-view=tickets]').click();page.wait_for_timeout(80);ck('returning from guide focuses a visible detail heading',page.evaluate('document.activeElement.id') in ['ticket-title','hd-back-to-tickets'])
  page.evaluate('__UX__.backToList()');page.wait_for_timeout(50);page.evaluate('document.getElementById("hd-filter-disclosure").open=false;document.getElementById("status-filter").required=true;document.getElementById("status-filter").value="";document.getElementById("ticket-filters").requestSubmit()');ck('native invalid event exposes collapsed secondary field',page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open'));page.evaluate('document.getElementById("status-filter").required=false')
  ck('all original advanced nodes stay hidden/inert',page.evaluate('[...document.querySelectorAll("[data-advanced-access]")].every(n=>n.hidden&&n.inert)'))
  page.evaluate('__UX__.dispose()');ck('dispose restores original field locations',page.evaluate('document.getElementById("assignment-form").parentElement.id==="ticket-detail" && document.getElementById("status-filter").closest("details")===null'))
  ck('dispose removes enhancement',page.get_attribute('#tickets-view','class') in [None,''])
 ck('no JavaScript exceptions',not errors,errors);b.close()
report={'scope':'Native DOM/modules, real HTML/CSS, synthetic callbacks. No app.js/Auth/API/PostgreSQL/HTTP/CSP E2E.','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'errors':errors};(a.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('CHECKS',len(checks),'PASS',report['passed'],'FAIL',report['failed']);raise SystemExit(1 if report['failed'] else 0)
