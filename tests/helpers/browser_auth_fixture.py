"""Real page/DOM, SYNTHETIC Auth provider and API responses. No external identity service.
Normal loopback navigation/CSP are preserved; no browser policy bypass is configured.
"""
import json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
WS='11111111-1111-4111-8111-111111111111'
ACCOUNT='44444444-4444-4444-8444-444444444444'
TICKET='66666666-6666-4666-8666-666666666666'
checks=[]
def record(name): checks.append({'check':name,'result':'passed'})
INIT=r"""
(() => {
 const originalFetch=window.fetch.bind(window);
 const f=window.__authFixture={now:Date.now(),sequence:0,calls:[],refreshStatus:200,logoutStatus:204,holdLogin:false,completeLogin:null,holdLogout:false,completeLogout:null,passwordStatus:200,holdPassword:false,completePassword:null,reauthStatus:200,holdReauth:false,completeReauth:null,factors:[],holdMfa:false,completeMfa:null};
 Date.now=()=>f.now;
 const issue=(aal='aal1')=>({access_token:'e30.'+btoa(JSON.stringify({sub:'22222222-2222-4222-8222-222222222222',aal,exp:Math.floor(f.now/1000)+120})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_')+'.synthetic_'+(++f.sequence),refresh_token:'refresh_'+f.sequence,expires_in:120,token_type:'bearer',user:{id:'22222222-2222-4222-8222-222222222222',factors:f.factors,user_metadata:{role:'admin'}}});
 window.fetch=async (input,options={})=>{
  const url=String(input);
  if(!url.startsWith('https://syntheticproject.supabase.co/auth/v1/'))return originalFetch(input,options);
  f.calls.push({url,method:options.method,body:options.body,authorization:new Headers(options.headers).get('authorization')});
  const json=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  if(url.endsWith('/user')&&options.method==='GET'){
   const response=()=>f.securityStatus===503?new Response('{}',{status:503,headers:{'content-type':'application/json'}}):json({id:'22222222-2222-4222-8222-222222222222',factors:f.factors});
   if(f.holdSecurity)return new Promise(resolve=>{f.completeSecurity=()=>{resolve(response());f.completeSecurity=null;};});
   return response();
  }
  if(url.endsWith('/factors')&&options.method==='POST'){
   const factor={id:'77777777-7777-4777-8777-777777777777',factor_type:'totp',status:'unverified'};f.factors.push(factor);
   return json({id:factor.id,type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',qr_code:'<svg><script>private</script></svg>',uri:'otpauth://private'}});
  }
  if(url.endsWith('/challenge'))return json({id:'99999999-9999-4999-8999-999999999999',type:'totp',expires_at:Math.floor(f.now/1000)+60});
  if(url==='https://syntheticproject.supabase.co/auth/v1/recover'){
   const response=()=>f.recoveryRequestStatus===403?new Response(JSON.stringify({msg:'private recipient state',error_code:'captcha_failed'}),{status:403,headers:{'content-type':'application/json'}}):json({});
   if(f.holdRecoveryRequest)return new Promise(resolve=>{f.completeRecoveryRequest=()=>{resolve(response());f.completeRecoveryRequest=null;};});return response();
  }
  if(url==='https://syntheticproject.supabase.co/auth/v1/verify'){
   if(f.recoveryStatus===403)return new Response(JSON.stringify({error_code:'otp_expired',msg:'private recovery'}),{status:403,headers:{'content-type':'application/json'}});
   if(f.holdRecovery)return new Promise(resolve=>{f.completeRecovery=()=>{resolve(json(issue()));f.completeRecovery=null;};});
   return json(issue());
  }
  if(url.endsWith('/verify')){
   if(JSON.parse(options.body).code!=='123456')return new Response(JSON.stringify({code:422,error_code:'mfa_verification_failed'}),{status:422,headers:{'content-type':'application/json'}});
   if(f.holdMfa)return new Promise(resolve=>{f.completeMfa=()=>{resolve(json(issue('aal2')));f.completeMfa=null;};});
   f.factors.forEach(x=>{if(url.includes('/factors/'+x.id+'/verify'))x.status='verified';});return json(issue('aal2'));
  }
  if(url.endsWith('/reauthenticate')&&options.method==='GET'){
   const response=()=>f.reauthStatus===200?json({}):new Response('{}',{status:f.reauthStatus,headers:{'content-type':'application/json'}});
   if(f.holdReauth)return new Promise(resolve=>{f.completeReauth=()=>{resolve(response());f.completeReauth=null;};});
   return response();
  }
  if(url.endsWith('/user')&&options.method==='PUT'){
   const nonce=JSON.parse(options.body).nonce;
   if(nonce&&nonce!=='123456')return new Response(JSON.stringify({code:422,error_code:'reauthentication_not_valid',msg:'private nonce diagnostic'}),{status:422,headers:{'content-type':'application/json'}});
   const response=()=>f.passwordStatus===200?json({id:'22222222-2222-4222-8222-222222222222'}):new Response(JSON.stringify({code:f.passwordStatus,error_code:f.passwordStatus===401?'insufficient_aal':'unknown',msg:'private provider diagnostic'}),{status:f.passwordStatus,headers:{'content-type':'application/json'}});
   if(f.holdPassword)return new Promise(resolve=>{f.completePassword=()=>{resolve(response());f.completePassword=null;};});
   return response();
  }
  if(url.endsWith('/token?grant_type=password')){
   if(f.holdLogin)return new Promise(resolve=>{f.completeLogin=()=>{resolve(json(issue()));f.completeLogin=null;};});
   return json(issue());
  }
  if(url.endsWith('/token?grant_type=refresh_token'))return f.refreshStatus===200?json(issue()):new Response('{}',{status:f.refreshStatus,headers:{'content-type':'application/json'}});
  if(url.endsWith('/logout?scope=local')||url.endsWith('/logout?scope=global')){
   const response=()=>new Response(f.logoutStatus===204?null:'{}',{status:f.logoutStatus});
   if(f.holdLogout)return new Promise(resolve=>{f.completeLogout=()=>{resolve(response());f.completeLogout=null;};});
   return response();
  }
  throw Error('Unexpected synthetic Auth route');
 };
})();
"""
def prepare(browser, authentication_only=False, workspace_options=None, recovery_fragment="", advanced_access=True):
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.add_init_script(INIT)
    page=context.new_page()
    errors=[]; messages=[]; posts=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    ticket={'id':TICKET,'account_id':ACCOUNT,'product_instance_id':'55555555-5555-4555-8555-555555555555','service_code':'SUPPORT','subject':'Chamado sintético da sessão','description':'Fixture de interface; nenhum dado real.','status':'received','internal_status':'new','priority':'normal','version':1,'coverage_id':'coverage-a','contract_version_id':'version-a','created_at':'2026-09-17T12:00:00.000Z','updated_at':'2026-09-17T12:00:00.000Z','assignment':{'state':'unassigned','can_claim':True,'can_release':False}}
    # Preserved advanced UI is enabled only by this synthetic test fixture.
    if advanced_access:
        page.route('**/access-mode.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body='export const ADVANCED_ACCESS = true;'))
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
    page.goto('http://127.0.0.1:4317/'+recovery_fragment,wait_until='networkidle')
    return context,page,errors,posts

def fill_login(page, workspace=WS):
    page.locator('#email').fill('synthetic@example.test')
    page.locator('#password').fill(' senha mantida ')
    page.locator('#workspace').fill(workspace)
    page.locator('#submit-login').click()
