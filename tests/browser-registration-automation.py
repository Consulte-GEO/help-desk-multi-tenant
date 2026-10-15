"""Real Chromium DOM with trusted local modules; no navigation, network or auth.
The environment may block loopback navigation; no policy is altered.
This suite proves component rendering only, NOT hosted/HTTP integration.
"""
import json, os, pathlib, shutil, subprocess, time
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(os.environ.get('HDA_BROWSER_EVIDENCE','/tmp/hda-review-browser'))
out.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,condition):
    checks.append({'name':name,'passed':bool(condition)})
    assert condition,name
bundle=json.loads(subprocess.check_output(['node','--experimental-strip-types','tests/fixtures/registration-review/dom-bundle.mjs'],cwd=root,text=True))
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('HDA_CHROMIUM',shutil.which('chromium')))
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        def mount(audience='internal',mode='normal'):
            page.evaluate('args=>window.configure(...args)',[audience,mode])
        def load():
            page.locator('[data-ops-action="read-registration"]').click()
            page.wait_for_function('window.panel.state.snapshot().phase!=="loading"')
        page.set_content(bundle['html']);page.evaluate(bundle['script']);page.wait_for_function('window.ready===true')
        check('opening panel performs no request',page.evaluate('calls.length')==0)
        check('initial screen has no approval or edit controls',page.locator('#root input,#root textarea,#root select').count()==0)
        for width in [1440,390]:
            for theme in ['light','dark']:
                page.set_viewport_size({'width':width,'height':1000})
                page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
                mount();load();label=f'{width}-{theme}'
                check('one explicit read '+label,page.evaluate('calls.length')==1)
                check('loaded validated draft '+label,page.evaluate('panel.state.snapshot().phase')=='loaded')
                check('no overflow '+label,page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                check('visible requested data '+label,'pessoa@example.invalid' in page.locator('#root').inner_text())
                check('opaque work ID preserved '+label,'0007' in page.locator('#root').inner_text())
                check('approval remains absent '+label,page.get_by_role('button',name='Aprovar e criar',exact=True).count()==0)
                check('read button at least 44px '+label,page.locator('[data-ops-action="read-registration"]').bounding_box()['height']>=44)
                check('status announces result '+label,page.locator('[data-ops-status]').get_attribute('aria-live')=='polite')
                page.screenshot(path=str(out/f'review-{label}.png'),full_page=True)
        mount('customer');load();text=page.locator('#root').inner_text()
        check('customer has no internal addresses','pessoa@example.invalid' not in text)
        check('customer has no origin references','0009' not in text and 'Contrato na origem' not in text)
        check('customer can follow progress','Em conferência' in text)
        page.screenshot(path=str(out/'review-customer-390.png'),full_page=True)
        mount();page.evaluate("fixtureView.detail.requested[0].value='<img src=x onerror=window.XSS=true>'");load()
        check('markup is text not HTML',page.locator('#root img').count()==0 and page.evaluate('window.XSS') is None)
        mount();load();page.evaluate('window.detached=document.querySelector("[data-review-content]")');page.evaluate('session.abort()')
        check('logout removes current DOM',page.locator('#root').inner_text()=='')
        check('logout also scrubs detached node',page.evaluate('detached.textContent')=='')
        mount('internal','pending');page.locator('[data-ops-action="read-registration"]').click();page.wait_for_function('pending.length===1')
        check('loading announces busy',page.locator('[data-ops-panel]').get_attribute('aria-busy')=='true')
        page.evaluate('window.oldPending=pending[0];session.abort();oldPending.resolve()');page.wait_for_timeout(60)
        check('late response cannot restore logged out content',page.locator('#root').inner_text()=='')
        mount('internal','error');load();check('errors are safe','PRIVATE_ERROR' not in page.locator('#root').inner_text())
        check('error allows explicit consultation retry',page.locator('[data-ops-action="read-registration"]').is_enabled())
        mount();page.evaluate("fixtureView.expiresAt='2026-10-14T12:00:00.120Z'");load();page.wait_for_timeout(250)
        check('expired view removes private content','pessoa@example.invalid' not in page.locator('#root').inner_text())
        check('expiry does not poll',page.evaluate('calls.length')==1)
        mount();page.locator('[data-ops-action="read-registration"]').focus();page.keyboard.press('Enter');page.wait_for_function('panel.state.snapshot().phase==="loaded"')
        check('keyboard activates consultation',page.evaluate('calls.length')==1)
        check('result focus is controlled',page.evaluate('document.activeElement.hasAttribute("data-ops-status")'))
        check('no runtime errors',not errors)
        browser.close()
finally:
    report={'mode':'offline-dom','typescriptVersion':bundle['typescriptVersion'],'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
    (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
