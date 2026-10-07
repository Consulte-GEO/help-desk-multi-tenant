"""Real page/DOM, SYNTHETIC Auth provider and API responses. No external identity service.
Normal loopback navigation/CSP are preserved; no browser policy bypass is configured.
"""
import json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
WS='11111111-1111-4111-8111-111111111111'
ACCOUNT='44444444-4444-4444-8444-444444444444'
TICKET='66666666-6666-4666-8666-666666666666'
checks=[]
def record(name): checks.append({'check':name,'result':'passed'})
INIT=r"""
(() => {
 const originalFetch=window.fetch.bind(window);
 const f=window.__authFixture={now:Date.now(),sequence:0,calls:[],refreshStatus:200,logoutStatus:204,holdLogin:false,completeLogin:null};
 Date.now=()=>f.now;
 const issue=()=>({access_token:'aaa.bbb.'+(++f.sequence),refresh_token:'refresh_'+f.sequence,expires_in:120,token_type:'bearer',user:{id:'22222222-2222-4222-8222-222222222222',user_metadata:{role:'admin'}}});
 window.fetch=async (input,options={})=>{
  const url=String(input);
  if(!url.startsWith('https://syntheticproject.supabase.co/auth/v1/'))return originalFetch(input,options);
  f.calls.push({url,body:options.body,authorization:new Headers(options.headers).get('authorization')});
  const json=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  if(url.endsWith('/token?grant_type=password')){
   if(f.holdLogin)return new Promise(resolve=>{f.completeLogin=()=>{resolve(json(issue()));f.completeLogin=null;};});
   return json(issue());
  }
  if(url.endsWith('/token?grant_type=refresh_token'))return f.refreshStatus===200?json(issue()):new Response('{}',{status:f.refreshStatus,headers:{'content-type':'application/json'}});
  if(url.endsWith('/logout?scope=local'))return new Response(f.logoutStatus===204?null:'{}',{status:f.logoutStatus});
  throw Error('Unexpected synthetic Auth route');
 };
})();
"""
def prepare(browser, authentication_only=False, workspace_options=None):
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.add_init_script(INIT)
    page=context.new_page()
    errors=[]; messages=[]; posts=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    ticket={'id':TICKET,'account_id':ACCOUNT,'product_instance_id':'55555555-5555-4555-8555-555555555555','service_code':'SUPPORT','subject':'Chamado sintético da sessão','description':'Fixture de interface; nenhum dado real.','status':'received','internal_status':'new','priority':'normal','version':1,'coverage_id':'coverage-a','contract_version_id':'version-a','created_at':'2026-09-17T12:00:00.000Z','updated_at':'2026-09-17T12:00:00.000Z','assignment':{'state':'unassigned','can_claim':True,'can_release':False}}
    page.route('**/demo-config',lambda r:r.fulfill(status=404,body=''))
    def api(route):
        path=urlparse(route.request.url).path
        if path=='/v1/public-config': value={'supabase_url':'https://syntheticproject.supabase.co','publishable_key':'sb_publishable_localtest',**({'operational':False} if authentication_only else {})}
        elif path=='/v1/workspaces': value={'items':workspace_options if workspace_options is not None else [{'id':WS,'name':'Suporte autorizado'}]}
        elif authentication_only and path not in ['/v1/me','/v1/workspaces']:
            errors.append('Business request before release: '+path);route.fulfill(status=503,body='{}');return
        elif path=='/v1/me': value={'id':'33333333-3333-4333-8333-333333333333','kind':'human','workspace_id':route.request.headers.get('x-workspace-id',WS),'workspace_role':None,'grants':[{'account_id':ACCOUNT,'role':'agent'}],'scopes':['tickets:read','tickets:write','notes:read','notes:write','contexts:resolve']}
        elif path=='/v1/tickets': value={'items':[ticket],'next_cursor':None}
        elif path=='/v1/tickets/'+TICKET: value={**ticket,'available_actions':{'ticket_id':TICKET,'version':ticket['version'],'reply':True,'read_notes':True,'add_note':True,'change_priority':True,'claim':True,'release':False,'transitions':[{'to':'triage','requires_reason':False},{'to':'open','requires_reason':False},{'to':'cancelled','requires_reason':False}]}}
        elif path.endswith('/messages'):
            if route.request.method=='POST':
                posts.append(route.request.post_data_json)
                msg={'id':'message-'+str(len(posts)),'ticket_id':TICKET,'body':posts[-1]['body'],'actor_type':'human_agent','created_at':'2026-09-17T12:00:00.000Z'}
                messages.append(msg);value=msg
            else: value={'items':list(messages),'next_cursor':None}
        elif path.endswith('/notes') or path.endswith('/timeline'): value={'items':[],'next_cursor':None}
        else:
            route.fulfill(status=404,content_type='application/json',body='{}');return
        route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
    page.route('**/v1/**',api)
    page.goto('http://127.0.0.1:4317/',wait_until='networkidle')
    return context,page,errors,posts

def fill_login(page, workspace=WS):
    page.locator('#email').fill('synthetic@example.test')
    page.locator('#password').fill(' senha mantida ')
    page.locator('#workspace').fill(workspace)
    page.locator('#submit-login').click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    context,page,errors,posts=prepare(browser)
    fill_login(page)
    expect(page.locator('#ticket-title')).to_have_text('Chamado sintético da sessão')
    expect(page.locator('#password')).to_have_value('')
    assert page.evaluate('localStorage.length + sessionStorage.length')==0
    assert page.evaluate("JSON.parse(__authFixture.calls[0].body).password")==' senha mantida '
    assert page.locator('#workspace-label').inner_text()==WS
    record('Human page logs in through validated session with password cleared and no persistent token storage')
    page.locator('#message-body').fill('Rascunho preservado durante renovação.')
    page.evaluate('__authFixture.now+=70000')
    page.locator('#refresh').click()
    expect(page.locator('#list-status')).to_have_text('')
    expect(page.locator('#message-body')).to_have_value('Rascunho preservado durante renovação.')
    page.wait_for_function("__authFixture.calls.filter(x=>x.url.includes('grant_type=refresh_token')).length===1")
    record('List refresh renews the human access token without erasing the active draft')
    page.evaluate('__authFixture.now+=70000;__authFixture.refreshStatus=503')
    page.locator('#send-message').click()
    expect(page.locator('#retry-session')).to_be_visible()
    expect(page.locator('#message-body')).to_have_value('Rascunho preservado durante renovação.')
    assert posts==[]
    page.evaluate('__authFixture.refreshStatus=200')
    page.locator('#retry-session').click()
    expect(page.locator('#session-banner')).to_be_hidden()
    assert posts==[] # Renewing identity must never retry a business POST.
    page.locator('#send-message').click()
    expect(page.locator('#messages')).to_contain_text('Rascunho preservado durante renovação.')
    assert len(posts)==1
    record('Paused refresh preserves the draft, dispatches no mutation, and requires explicit resubmission after resume')
    page.evaluate('__authFixture.logoutStatus=503')
    page.locator('#logout').click()
    expect(page.locator('#app')).to_be_hidden()
    expect(page.locator('#login-status')).to_contain_text('NÃO foi confirmada')
    expect(page.locator('#ticket-title')).to_have_text('')
    expect(page.locator('#message-body')).to_have_value('')
    assert page.evaluate('__authFixture.calls.at(-1).url').endswith('/logout?scope=local')
    assert not errors,errors
    record('Unconfirmed provider logout removes local ticket/draft immediately and reports the limitation')
    context.close()
    context,page,errors,posts=prepare(browser)
    page.evaluate('__authFixture.holdLogin=true')
    fill_login(page)
    page.wait_for_function('typeof __authFixture.completeLogin === "function"')
    page.locator('#cancel-login').click()
    expect(page.locator('#app')).to_be_hidden()
    page.evaluate('__authFixture.completeLogin()')
    expect(page.locator('#login-status')).to_contain_text('Sessão atual encerrada no provedor')
    page.wait_for_function("__authFixture.calls.some(x=>x.url.endsWith('/logout?scope=local'))")
    expect(page.locator('#app')).to_be_hidden()
    expect(page.locator('#submit-login')).to_be_enabled()
    assert not errors,errors
    record('Cancelled login never shows the application and closes the late-returned synthetic provider session')
    context.close()
    context,page,errors,posts=prepare(browser,authentication_only=True)
    fill_login(page)
    expect(page.locator('#login-status')).to_contain_text('Identidade e acesso ao workspace confirmados')
    expect(page.locator('#app')).to_be_hidden()
    expect(page.locator('#submit-login')).to_be_disabled()
    expect(page.locator('#cancel-login')).to_have_text('Encerrar sessão')
    expect(page.locator('#password')).to_have_value('')
    assert page.evaluate('localStorage.length + sessionStorage.length')==0
    assert not errors,errors
    assert posts==[]
    record('Authentication-only login validates own profile without requesting business data or displaying an empty ticket list')
    page.locator('#cancel-login').click()
    expect(page.locator('#login-status')).to_contain_text('Sessão atual encerrada no provedor')
    expect(page.locator('#submit-login')).to_be_enabled()
    expect(page.locator('#cancel-login')).to_be_hidden()
    assert not errors,errors
    record('Authentication-only signed-in page allows explicit provider logout and a new login')
    context.close()
    context,page,errors,posts=prepare(browser,authentication_only=True)
    requests=[]
    page.on('request',lambda r:requests.append(r))
    fill_login(page,workspace='')
    expect(page.locator('#login-status')).to_contain_text('Identidade e acesso ao workspace confirmados')
    expect(page.locator('#app')).to_be_hidden()
    assert len([r for r in requests if urlparse(r.url).path=='/v1/workspaces'])==1
    assert all('x-workspace-id' not in r.headers for r in requests if urlparse(r.url).path=='/v1/workspaces')
    assert all(r.headers.get('x-workspace-id')==WS for r in requests if urlparse(r.url).path=='/v1/me')
    assert not errors,errors
    record('Login discovers a single authorized workspace without entering its UUID and then validates selected /me')
    context.close()
    choices=[{'id':WS,'name':'Suporte A'},{'id':'77777777-7777-4777-8777-777777777777','name':'Suporte B'}]
    context,page,errors,posts=prepare(browser,authentication_only=True,workspace_options=choices)
    requests=[]
    page.on('request',lambda r:requests.append(r))
    fill_login(page,workspace='')
    expect(page.locator('#choose-workspace')).to_be_visible()
    assert not [r for r in requests if urlparse(r.url).path=='/v1/me']
    assert page.locator('#workspace-choice').input_value()==''
    page.locator('#workspace-choice').select_option(choices[1]['id'])
    page.locator('#choose-workspace').click()
    expect(page.locator('#login-status')).to_contain_text('Identidade e acesso ao workspace confirmados')
    assert all(r.headers.get('x-workspace-id')==choices[1]['id'] for r in requests if urlparse(r.url).path=='/v1/me')
    assert not errors,errors
    record('Multiple authorized workspaces require explicit selection before any /me or business request')
    context.close()
    context,page,errors,posts=prepare(browser,authentication_only=True,workspace_options=choices)
    requests=[]
    page.on('request',lambda r:requests.append(r))
    fill_login(page,workspace='')
    expect(page.locator('#choose-workspace')).to_be_visible()
    page.locator('#cancel-login').click()
    expect(page.locator('#login-status')).to_contain_text('Sessão atual encerrada no provedor')
    expect(page.locator('#workspace-choice-label')).to_be_hidden()
    expect(page.locator('#submit-login')).to_be_enabled()
    assert not [r for r in requests if urlparse(r.url).path=='/v1/me']
    assert not errors,errors
    record('Cancel during workspace choice closes the provider session without confirming a workspace')
    context.close()
    context,page,errors,posts=prepare(browser,authentication_only=True,workspace_options=choices)
    fill_login(page,workspace='')
    expect(page.locator('#choose-workspace')).to_be_visible()
    page.route('**/v1/me',lambda r:r.fulfill(status=403,content_type='application/problem+json',body=json.dumps({'detail':'Vínculo revogado.','code':'membership_required'})))
    page.locator('#workspace-choice').select_option(WS)
    page.locator('#choose-workspace').click()
    expect(page.locator('#login-status')).to_contain_text('Vínculo revogado')
    expect(page.locator('#app')).to_be_hidden()
    expect(page.locator('#submit-login')).to_be_enabled()
    page.wait_for_function("__authFixture.calls.some(x=>x.url.endsWith('/logout?scope=local'))")
    assert not errors,errors
    record('A workspace revoked after discovery fails /me and closes the inaccessible human session')
    context.close();browser.close()
(ROOT/'evidence/browser-human-session.json').write_text(json.dumps({'scope':'synthetic-provider-DOM','checks':checks},ensure_ascii=False,indent=2))
print(json.dumps(checks,ensure_ascii=False,indent=2))
