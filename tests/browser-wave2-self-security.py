"""Real DOM, synthetic Auth/API only. No real factor or user credential."""
import json,os,shutil
from playwright.sync_api import sync_playwright,expect
from helpers.browser_auth_fixture import ROOT,prepare
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    context,page,errors,posts=prepare(browser,authentication_only=True,advanced_access=False)
    page.locator('#email').fill('synthetic@example.test');page.locator('#password').fill(' synthetic password ');page.locator('#submit-login').click()
    expect(page.locator('#app')).to_be_visible()
    expect(page.locator('#configure-mfa')).to_be_visible()
    expect(page.locator('#security-status')).to_be_visible()
    for selector in ['#switch-workspace','#change-password','#logout-all','#add-mfa']:expect(page.locator(selector)).to_be_hidden()
    assert not any('/factors' in x['url'] for x in page.evaluate('__authFixture.calls'))
    page.locator('#configure-mfa').click();expect(page.locator('#mfa-enrollment-dialog')).to_be_visible()
    expect(page.locator('#mfa-enrollment-title')).to_contain_text('primeiro autenticador')
    assert not any(x['url'].endswith('/factors') for x in page.evaluate('__authFixture.calls'))
    page.locator('#cancel-mfa-enrollment').click();expect(page.locator('#mfa-enrollment-dialog')).to_be_hidden();expect(page.locator('#app')).to_be_visible()
    assert not errors and not posts,errors
    checks.append('Own security controls are available after verified login; opening setup creates no credential and leaves other advanced flows disabled')
    context.close()
    context,page,errors,posts=prepare(browser,authentication_only=True,advanced_access=False)
    page.evaluate("__authFixture.factors=[{id:'77777777-7777-4777-8777-777777777777',factor_type:'totp',status:'verified'}]")
    business=[];page.on('request',lambda request:business.append(request.url) if request.url.endswith('/v1/me') else None)
    page.locator('#email').fill('synthetic@example.test');page.locator('#password').fill(' synthetic password ');page.locator('#submit-login').click()
    expect(page.locator('#mfa-panel')).to_be_visible();expect(page.locator('#app')).to_be_hidden();expect(page.locator('#cancel-login')).to_be_visible()
    assert not business
    page.locator('#mfa-code').fill('000000');page.locator('#verify-mfa').click()
    expect(page.locator('#mfa-status')).not_to_have_text('Confirmando o código uma única vez…')
    expect(page.locator('#mfa-panel')).to_be_visible();assert not business
    page.locator('#mfa-code').fill('123456');page.locator('#verify-mfa').click()
    expect(page.locator('#app')).to_be_visible();expect(page.locator('#login-screen')).to_be_hidden()
    assert len(business)==1
    expect(page.locator('#password')).to_have_value('');expect(page.locator('#mfa-code')).to_have_value('')
    assert page.evaluate('localStorage.length+sessionStorage.length')==0
    assert not errors and not posts,errors
    checks.append('Simple login waits for MFA, preserves explicit retry and discovers authorized business access only after verified code')
    context.close();browser.close()
checks=[{'check':check,'result':'passed'} for check in checks]
(ROOT/'evidence/browser-wave2-self-security.json').write_text(json.dumps({'scope':'isolated DOM with synthetic Auth/API; no real MFA setup','checks':checks},ensure_ascii=False,indent=2))
print(json.dumps(checks,ensure_ascii=False))
