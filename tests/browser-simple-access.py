"""Current password-only UI: real DOM with a synthetic Auth provider/API."""
import json, os, shutil
from playwright.sync_api import sync_playwright, expect
from helpers.browser_auth_fixture import ROOT, WS, prepare

checks=[]
def record(name): checks.append({'check':name,'result':'passed'})
def password_login(page):
    page.locator('#email').fill('synthetic@example.test')
    page.locator('#password').fill(' senha mantida ')
    page.locator('#submit-login').click()
def ready(browser, **kwargs):
    return prepare(browser, authentication_only=True, advanced_access=False, **kwargs)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'), args=['--no-sandbox'])
    context,page,errors,posts=ready(browser)
    expect(page.locator('#submit-login')).to_be_enabled()
    assert page.locator('#login-form input:visible').evaluate_all('(xs)=>xs.map(x=>x.id)')==['email','password']
    assert page.locator('#login-screen button:visible').evaluate_all('(xs)=>xs.map(x=>x.id)')==['submit-login']
    record('Current initial access exposes exactly email, password and Entrar')
    for selector in ['#workspace','#recover-access','#mfa-code','#security-status-login','#change-password-login','#logout-all-login']:
        expect(page.locator(selector)).to_be_hidden()
    assert page.locator('[data-advanced-access]').evaluate_all('(xs)=>xs.every(x=>x.hidden && x.inert)')
    record('Advanced access controls are hidden and inert in the current mode')
    page.screenshot(path=str(ROOT/'evidence/simple-login-desktop.png'),full_page=True)
    password_login(page)
    expect(page.locator('#login-status')).to_contain_text('Você está conectado')
    expect(page.locator('#login-form')).to_be_hidden()
    expect(page.locator('#cancel-login')).to_have_text('Sair')
    expect(page.locator('#app')).to_be_hidden()
    assert not posts and not errors,errors
    record('Password-only login discovers the sole operation and respects the service release gate')
    calls=page.evaluate('__authFixture.calls')
    password_calls=[x for x in calls if x['url'].endswith('/token?grant_type=password')]
    assert len(password_calls)==1 and json.loads(password_calls[0]['body'])=={'email':'synthetic@example.test','password':' senha mantida '}
    assert not any('/factors' in x['url'] or '/recover' in x['url'] for x in calls)
    record('Basic login sends the exact password once without extra account-management requests')
    assert page.evaluate('localStorage.length+sessionStorage.length')==0
    expect(page.locator('#password')).to_have_value('')
    record('Password and credentials stay out of DOM fields and persistent browser storage after login')
    page.locator('#cancel-login').click()
    expect(page.locator('#login-form')).to_be_visible()
    expect(page.locator('#submit-login')).to_be_enabled()
    assert page.evaluate("__authFixture.calls.filter(x=>x.url.endsWith('/logout?scope=local')).length")==1
    assert not errors,errors
    record('Simple Sair clears the session and returns to the same two-field login')
    context.close()

    context,page,errors,posts=ready(browser)
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('#submit-login')).to_be_enabled()
    assert page.locator('#login-form input:visible').count()==2
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'evidence/simple-login-mobile.png'),full_page=True)
    record('Mobile login retains the two fields without horizontal overflow')
    context.close()

    context,page,errors,posts=ready(browser)
    page.locator('#email').fill('synthetic@example.test')
    page.locator('#password').evaluate('(x)=>x.value="x".repeat(4097)')
    page.locator('#login-form').evaluate('(f)=>f.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))')
    expect(page.locator('#login-status')).to_contain_text('Informe um e-mail e uma senha válidos')
    assert 'workspace' not in page.locator('#login-status').inner_text().lower()
    assert page.evaluate('__authFixture.calls.length')==0
    assert not errors and not posts,errors
    record('Invalid credentials report only email/password and never mention a missing workspace control')
    context.close()

    context,page,errors,posts=ready(browser,workspace_options=[{'id':WS,'name':'A'},{'id':'22222222-2222-4222-8222-222222222222','name':'B'}])
    password_login(page)
    expect(page.locator('#login-status')).to_contain_text('operação única')
    expect(page.locator('#submit-login')).to_be_enabled()
    expect(page.locator('#workspace-choice')).to_be_hidden()
    assert page.evaluate("__authFixture.calls.some(x=>x.url.endsWith('/logout?scope=local'))")
    assert not errors and not posts,errors
    record('Ambiguous operations fail clearly and clean the session without hidden selection or arbitrary access')
    context.close()

    context,page,errors,posts=ready(browser)
    page.evaluate("__authFixture.factors=[{id:'77777777-7777-4777-8777-777777777777',factor_type:'totp',status:'verified'}]")
    password_login(page)
    expect(page.locator('#login-status')).to_contain_text('acesso simples não está disponível')
    expect(page.locator('#submit-login')).to_be_enabled()
    expect(page.locator('#mfa-panel')).to_be_hidden()
    assert page.evaluate("__authFixture.calls.some(x=>x.url.endsWith('/logout?scope=local'))")
    assert not errors and not posts,errors
    record('Enrolled MFA is never bypassed and cannot leave a basic login waiting on a hidden field')
    context.close()

    context,page,errors,posts=ready(browser,recovery_fragment='#type=recovery&token_hash='+'a'*56)
    expect(page.locator('#submit-login')).to_be_enabled()
    assert '#' not in page.url and page.evaluate('__authFixture.calls.length')==0
    expect(page.locator('#recovery-dialog')).to_be_hidden()
    assert page.locator('#login-form input:visible').count()==2
    record('Recovery URL material is discarded without opening or executing the disabled flow')
    context.close()

    context,page,errors,posts=ready(browser)
    page.evaluate('__authFixture.holdLogin=true')
    password_login(page)
    page.wait_for_function('__authFixture.completeLogin!==null')
    expect(page.locator('#submit-login')).to_be_disabled()
    page.locator('#login-form').evaluate('(f)=>f.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))')
    assert page.evaluate("__authFixture.calls.filter(x=>x.url.endsWith('/token?grant_type=password')).length")==1
    page.evaluate('__authFixture.completeLogin()')
    expect(page.locator('#login-status')).to_contain_text('Você está conectado')
    assert not errors and not posts,errors
    record('Concurrent form submissions dispatch the password only once')
    context.close()

    context,page,errors,posts=ready(browser,workspace_options=[])
    password_login(page)
    expect(page.locator('#submit-login')).to_be_enabled()
    expect(page.locator('#app')).to_be_hidden()
    assert page.evaluate("__authFixture.calls.some(x=>x.url.endsWith('/logout?scope=local'))")
    assert not errors and not posts,errors
    record('An identity without membership never becomes a Help Desk login')
    context.close();browser.close()

(ROOT/'evidence/browser-simple-access.json').write_text(json.dumps({'scope':'current-password-only-UI-synthetic-provider','checks':checks},ensure_ascii=False,indent=2))
print(json.dumps(checks,ensure_ascii=False,indent=2))
