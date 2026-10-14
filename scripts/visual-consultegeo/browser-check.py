#!/usr/bin/env python3
"""Native UI/adapters, synthetic identity and HTTP replies; isolated offline browser."""
import argparse,base64,hashlib,json,os,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
args=argparse.ArgumentParser();args.add_argument('--output',type=Path,required=True);a=args.parse_args();a.output.mkdir(parents=True,exist_ok=True)
ROOT=Path(__file__).resolve().parents[2];checks=[];cache={}
def module(path):
 path=path.resolve()
 if path in cache:return cache[path]
 if not path.is_relative_to(ROOT) or not path.is_file():raise RuntimeError('Missing original source: '+str(path))
 s=path.read_text();s=re.sub(r'''(from\s*|import\s*)(['"])(\.[^'"]+)\2''',lambda m:m[1]+repr(module(path.parent/m[3])),s)
 cache[path]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode();return cache[path]
def css(path):
 return re.sub(r'''@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;''',lambda m:css(path.parent/m[1]),path.read_text())
def ck(label,ok):
 checks.append({'name':label,'passed':bool(ok)})
 if not ok:print('FAIL',label,flush=True)
def fill(page):
 page.locator('[data-intake-description]').fill('Solicitar acesso conforme vínculo da obra. Dados fictícios para teste.')
 page.locator('[data-field="nome"]').fill('Pessoa de Demonstração')
 page.locator('[data-field="email"]').fill('pessoa@example.invalid')
 page.locator('[data-field="grupo"]').select_option('consulta')
styles=''.join('<style>'+css(ROOT/'web'/name)+'</style>' for name in ['styles.css','design-tokens.css','consulte-theme.css','form-experience.css','support-intake.css','consultegeo-request.css','consultegeo-configuration.css'])
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_EXECUTABLE') or os.getenv('BROWSER_EXECUTABLE'),headless=True,args=['--no-sandbox'])
 for width in [320,390,768,1024,1440]:
  for theme in ['light','dark']:
   errors=[];ctx=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce');ctx.route('**/*',lambda r:r.abort());page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(3500)
   name=f'{width}-{theme}'
   try:
    page.goto('about:blank');page.set_content(f'<html data-helpdesk-ds data-brand="consulte-geo" data-theme="{theme}"><head><meta charset="utf-8">{styles}</head><body><button id="outside">Controle externo</button><main id="root" class="host-layout"></main></body></html>')
    page.add_script_tag(content="if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20)};")
    page.add_script_tag(type='module',content='import {setupFixture} from '+repr(module(Path(__file__).parent/'fixture.js'))+';await setupFixture(document.getElementById("root"));')
    page.wait_for_function('!!window.UX10');selector=page.locator('select[aria-label="Ação desejada"]');selector.select_option('0');fill(page)
    page.locator('[data-intake-action=save]').click();expect(page.locator('[data-intake-action=preview]')).to_be_visible();ck(name+' save uses one /v1',page.evaluate('UX10.calls.length===1&&UX10.calls[0].path.startsWith("/v1/form-drafts/")&&!UX10.calls[0].path.includes("/v1/v1/")'))
    page.locator('[data-intake-action=preview]').click();expect(page.locator('[data-intake-action=confirm]')).to_be_visible();ck(name+' review does not create',page.evaluate('UX10.effects.size===0'))
    ck(name+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    ck(name+' controls readable',page.locator('[data-intake-action=confirm]').evaluate('(e)=>e.getBoundingClientRect().height>=44'))
    ck(name+' theme inherited',page.locator('#root').evaluate('(e)=>getComputedStyle(e).backgroundColor')==('rgb(255, 255, 255)' if theme=='light' else 'rgb(18, 27, 44)'))
    if width in [390,1440]:page.screenshot(path=str(a.output/f'solicitacao-{name}.png'),full_page=True)
    page.evaluate('UX10.lose=true');page.locator('[data-intake-action=confirm]').click();expect(page.locator('[data-intake-action=reconcile]')).to_be_visible();ck(name+' unknown locks action',selector.is_disabled())
    page.evaluate('UX10.rejectReplay=true');page.locator('[data-intake-action=reconcile]').click();expect(page.locator('[data-intake-action=reconcile]')).to_be_enabled();ck(name+' refused replay remains unknown',page.evaluate('UX10.panel.state().phase==="unknown"'))
    page.locator('[data-intake-action=reconcile]').click();expect(page.locator('.hd-intake-receipt')).to_be_visible();ck(name+' exactly one created effect',page.evaluate('UX10.effects.size===1'))
    ck(name+' replay same key/body',page.evaluate('(()=>{const c=UX10.calls.filter(x=>x.path==="/v1/support-requests");return c.length===3&&c.every(x=>x.key===c[0].key&&JSON.stringify(x.body)===JSON.stringify(c[0].body))})()'))
    selector.select_option('1');fill(page);selector.select_option('2');expect(page.locator('[data-cg-discard]')).to_be_visible();page.get_by_role('button',name='Manter ação atual',exact=True).click();ck(name+' cancelled discard preserves input',page.locator('[data-field=nome]').input_value()=='Pessoa de Demonstração')
    page.evaluate('UX10.mount("configuration")');page.locator('input[aria-label="Motivo da alteração ou publicação"]').fill('Revisão visual com dados fictícios');page.get_by_role('button',name='Preparar publicação',exact=True).click();expect(page.locator('[data-cg-operation-summary]')).to_be_visible()
    ck(name+' config has operation summary','Publicar versão' in page.locator('[data-cg-operation-summary]').inner_text());ck(name+' config no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    ck(name+' config controls use theme',page.locator('.cg-config-layout>section').first.evaluate('(e)=>getComputedStyle(e).backgroundColor')==('rgb(255, 255, 255)' if theme=='light' else 'rgb(18, 27, 44)'))
    ck(name+' configuration labels inherit readable ink',page.locator('.cg-config-layout>section>label').first.evaluate('(e)=>getComputedStyle(e).color===getComputedStyle(e.parentElement).color'))
    ck(name+' cancel is visually secondary',page.get_by_role('button',name='Cancelar intenção',exact=True).evaluate('(e)=>getComputedStyle(e).backgroundColor')!=page.get_by_role('button',name='Confirmar operação',exact=True).evaluate('(e)=>getComputedStyle(e).backgroundColor'))
    if width in [390,1440]:page.screenshot(path=str(a.output/f'configuracao-{name}.png'),full_page=True)
    page.evaluate('UX10.editorOutcome="unknown"');page.get_by_role('button',name='Confirmar operação',exact=True).click();expect(page.get_by_role('button',name='Conciliar mesma intenção',exact=True)).to_be_visible();page.evaluate('UX10.editorOutcome="rejected"');page.get_by_role('button',name='Conciliar mesma intenção',exact=True).click();ck(name+' configuration refused replay stays unknown',page.evaluate('UX10.panel.state()==="unknown"'));page.evaluate('UX10.editorOutcome="confirmed"');page.get_by_role('button',name='Conciliar mesma intenção',exact=True).click();ck(name+' configuration single intent',page.evaluate('UX10.editorCalls.length===3&&UX10.editorCalls.every(c=>JSON.stringify(c)===JSON.stringify(UX10.editorCalls[0]))'))
    page.evaluate('UX10.panel.destroy()');ck(name+' destroyed content erased',page.locator('#root').inner_text()=='');ck(name+' no javascript error',not errors)
   except Exception as e:
    ck(name+' complete scenario',False);print(str(e)[:800],flush=True)
   finally:ctx.close()
 browser.close()
report={'scope':'offline-native-ui-and-adapters; synthetic identity/server; not PostgreSQL or HTTP authorization','passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in cache}}
(a.output/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:report[k] for k in ['passed','failed']}));sys.exit(bool(report['failed']))
