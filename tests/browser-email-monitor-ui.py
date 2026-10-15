"""Original native component and full shell, synthetic HTTPS/Auth only.
No hosted acceptance, real recipient, provider request or browser-policy change.
"""
import base64, json, os, shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
WS = '11111111-1111-4111-8111-111111111111'
USER = '22222222-2222-4222-8222-222222222222'
ACCOUNT = '44444444-4444-4444-8444-444444444444'
WHEN = '2026-10-15T15:00:00.000000Z'
checks = []

def record(name):
    checks.append({'check': name, 'result': 'passed'})

def screenshot(page,name):
    output=os.environ.get('HELPDESK_EMAIL_UI_OUTPUT')
    if output:
        directory=Path(output);directory.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(directory/name),full_page=True)

COMPONENT = r"""async(source)=>{
 const m=await import('data:text/javascript;base64,'+source);
 const when='2026-10-15T15:00:00.000000Z';
 const summary={sent:{count:2,eligible:3,total:4},delivered:{count:1,eligible:3,total:4},opened:{count:null,eligible:0,total:4},clicked:{count:0,eligible:2,total:4},states:{pending:1,retry_wait:0,leased:0,sending:0,unknown:0,accepted:1,delivered:1,failed:1,suppressed:0},attention:1};
 window.calls=[];window.answer='ok';
 window.monitor=m.mountEmailMonitor(document.getElementById('root'),{admin:false,request:async(path,init)=>{
  window.calls.push({path,method:init.method});
  if(window.answer==='denied')throw Object.assign(Error('hidden@secret.invalid'),{status:403});
  if(window.answer==='fail')throw Object.assign(Error('private diagnostic'),{status:503});
  if(path.includes('/recipients/'))return {asOf:when,id:'intent-1',eventId:'event-1',recipientDisplay:'a***@e***.org',visibility:'masked',state:'failed',attention:false,reason:null,nextAttemptAt:null,timeline:['communication','queued','accepted','delivered','opened','clicked','failed','suppressed'].map(kind=>({kind,occurredAt:when,receivedAt:null})),attempts:[{number:1,startedAt:when}]};
  if(path.includes('/event-1'))return {asOf:window.revision??when,eventId:'event-1',protocol:'CG-90001',subject:'Aviso <img src=x onerror=alert(1)>',kind:'support.created',createdAt:when,total:4,nextCursor:null,summary,items:[{id:'intent-1',recipientDisplay:'a***@e***.org',visibility:'masked',state:'accepted',badge:'Saiu',sentAt:when,deliveredAt:null,openedAt:null,clickedAt:null,openAvailability:'not_collected',clickAvailability:'not_observed',attention:false}]};
  return {asOf:when,total:51,nextCursor:null,items:[{eventId:'event-1',protocol:'CG-90001',subject:'Aviso autorizado',kind:'support.created',createdAt:when,total:4,summary}]};
 }});
}"""

def component(browser):
    context=browser.new_context(viewport={'width':1100,'height':900})
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    css='\n'.join((ROOT/('web/'+name)).read_text(encoding='utf-8') for name in ['styles.css','email-monitor.css','design-tokens.css','consulte-theme.css']).replace("@import url('./design-tokens.css');",'')
    page.set_content('<!doctype html><html lang="pt-BR" data-helpdesk-ds="1"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="hd-ui"><button id="outside">Fora</button><section id="root"></section></body></html>')
    # about:blank lacks this secure-context API; only the dialog DOM ID uses it.
    page.evaluate("()=>{crypto.randomUUID=()=> 'offline-fixture';}")
    page.evaluate(COMPONENT,base64.b64encode((ROOT/'web/email-monitor.js').read_bytes()).decode())
    assert page.evaluate('calls.length')==0
    page.evaluate('monitor.setVisible(true)')
    expect(page.get_by_role('button',name='Ver entrega')).to_be_visible()
    expect(page.locator('#root')).to_contain_text('51 comunicações')
    assert page.locator('input[type=email]').count()==0
    status_options=page.locator('select[name=status] option').evaluate_all('(xs)=>xs.map(x=>[x.value,x.textContent])')
    assert len(set(value for value,_ in status_options))==len(status_options)
    assert [option for option in status_options if option[0]=='failed']==[['failed','Falhou']]
    assert [option for option in status_options if option[0]=='suppressed']==[['suppressed','Suprimido']]
    record('Component mounting does not query; server totals and masked-profile filters are preserved')
    page.get_by_role('button',name='Ver entrega').click()
    dialog=page.get_by_role('dialog');expect(dialog).to_be_visible()
    assert dialog.evaluate('(n)=>getComputedStyle(n).paddingTop')=='0px'
    assert dialog.locator('.email-metric').count()==4
    expect(dialog).to_contain_text('N/D');expect(dialog).to_contain_text('0 / 2 com coleta')
    expect(dialog).to_contain_text('America/Sao_Paulo')
    assert dialog.locator('img,a[href^="mailto:"]').count()==0
    expect(dialog).to_contain_text('a***@e***.org')
    record('Four stable cards distinguish unavailable history, zero and partial collection; untrusted subject remains text')
    screenshot(page,'email-monitor-desktop.png')
    page.keyboard.press('Shift+Tab')
    assert page.evaluate('document.activeElement.closest("dialog")!==null')
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.closest("dialog")!==null')
    record('Keyboard focus remains inside the native modal')
    dialog.get_by_role('button',name='Detalhes de a***@e***.org — referência intent-1').click()
    expect(dialog.get_by_role('heading',name='Detalhes do destinatário')).to_be_visible()
    expect(dialog).to_contain_text('Acesso a link');expect(dialog).to_contain_text('Recebido em')
    for label in ['Comunicação criada','Entrada na fila','Aceite do provedor','Entrega confirmada','Abertura aproximada','Falha','Suprimido']:
        expect(dialog.locator('.email-recipient-detail ol')).to_contain_text(label)
    dialog.get_by_role('button',name='Voltar à entrega').click()
    page.evaluate('''()=>{window.revision="2026-10-15T15:00:01.000000Z";document.querySelector('[data-email-focus="recipient-intent-1"]').focus({preventScroll:true});return monitor.refresh();}''')
    assert page.evaluate('document.activeElement.dataset.emailFocus')=='recipient-intent-1'
    assert page.get_by_role('dialog').count()==1
    record('Recipient diagnostics are safe, distinguish event/receipt time, and refresh preserves focus')
    page.keyboard.press('Escape');expect(dialog).not_to_be_visible()
    assert page.evaluate('document.activeElement.textContent')=='Ver entrega'
    record('Escape closes and returns focus to the delivery trigger')
    page.get_by_role('button',name='Fila',exact=True).click()
    page.wait_for_function('calls.at(-1).path.includes("status=queue")')
    assert page.evaluate('calls.every(c=>c.method==="GET")')
    record('Queue shortcut only queries; no send or reprocessing action exists')
    page.set_viewport_size({'width':360,'height':780})
    page.get_by_role('button',name='Ver entrega').click();expect(dialog).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert dialog.bounding_box()['width']<=360
    screenshot(page,'email-monitor-mobile.png')
    dialog.get_by_role('button',name='Fechar',exact=True).click()
    record('360 px modal fits the viewport and retains an accessible close action')
    page.evaluate('()=>{window.answer="fail";return monitor.refresh();}')
    expect(page.locator('#root')).to_contain_text('Não foi possível atualizar')
    expect(page.locator('#root')).to_contain_text('51 comunicações')
    record('Transient read failure retains the dated snapshot without pretending it refreshed')
    page.evaluate('()=>{window.answer="denied";return monitor.refresh();}')
    text=page.locator('#root').inner_text()
    assert all(x not in text for x in ['Aviso autorizado','a***','51 comunicações','hidden@'])
    assert 'acesso à consulta foi encerrado' in text
    page.evaluate('monitor.destroy()');assert page.locator('#root').inner_text()==''
    assert errors==[],errors
    record('Access refusal and destruction erase private rows, cards and diagnostics')
    context.close()

def shell(browser,capability,role):
    context=browser.new_context(viewport={'width':1280,'height':900})
    page=context.new_page();errors=[];calls=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route_request(route):
        url=urlparse(route.request.url);path=url.path
        def reply(value):route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
        if url.hostname=='syntheticproject.supabase.co':
            if path.endswith('/logout'):route.fulfill(status=204);return
            if path.endswith('/token'):
                import time
                claims=base64.urlsafe_b64encode(json.dumps({'sub':USER,'aal':'aal1','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
                reply({'access_token':'e30.'+claims+'.synthetic','refresh_token':'synthetic_refresh','expires_in':3600,'token_type':'bearer','user':{'id':USER,'factors':[]}});return
            route.fulfill(status=404,body='{}');return
        if url.hostname!='email-monitor-fixture.invalid':route.abort();return
        if path=='/demo-config':route.fulfill(status=404,body='');return
        if path.startswith('/v1/'):
            calls.append({'path':path,'method':route.request.method,'headers':route.request.headers})
            if path=='/v1/public-config':reply({'supabase_url':'https://syntheticproject.supabase.co','publishable_key':'sb_publishable_localtest','email_monitoring':capability,'consultegeo_intake':False})
            elif path=='/v1/workspaces':reply({'items':[{'id':WS,'name':'Operação sintética'}]})
            elif path=='/v1/me':reply({'id':USER,'kind':'human','workspace_id':WS,'workspace_role':'admin' if role=='admin' else None,'grants':[{'account_id':ACCOUNT,'role':role}],'scopes':['tickets:read','contexts:resolve']})
            elif path=='/v1/tickets':reply({'items':[],'next_cursor':None})
            elif path=='/v1/email-communications':reply({'asOf':WHEN,'total':0,'nextCursor':None,'items':[]})
            else:route.fulfill(status=404,content_type='application/json',body='{}')
            return
        relative='web/index.html' if path=='/' else path[1:] if path.startswith('/shared/') else 'web/'+path[1:]
        file=(ROOT/relative).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():route.fulfill(status=404,body='');return
        types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}
        route.fulfill(status=200,content_type=types.get(file.suffix,'application/octet-stream'),body=file.read_bytes())
    context.route('**/*',route_request)
    page.goto('https://email-monitor-fixture.invalid/')
    expect(page.locator('#submit-login')).to_be_enabled()
    page.locator('#email').fill('synthetic@example.test');page.locator('#password').fill('synthetic-password');page.locator('#submit-login').click()
    expect(page.locator('#app')).to_be_visible()
    allowed=capability and role in ['agent','admin']
    assert page.locator('#email-monitor-nav').is_visible()==allowed
    assert not any(c['path'].startswith('/v1/email-communications') for c in calls)
    if allowed:
        page.locator('#email-monitor-nav').click()
        expect(page.get_by_text('Nenhuma comunicação encontrada. Ajuste os filtros.')).to_be_visible()
        reads=[c for c in calls if c['path']=='/v1/email-communications']
        assert len(reads)==1 and reads[0]['method']=='GET'
        assert reads[0]['headers']['x-workspace-id']==WS
        assert reads[0]['headers']['authorization'].startswith('Bearer ')
        assert page.locator('#email-monitor-root input[type=email]').count()==(1 if role=='admin' else 0)
        page.locator('[data-view=guide]').click();expect(page.locator('#email-view')).not_to_be_visible()
        page.locator('#email-monitor-nav').click()
        expect(page.get_by_text('Nenhuma comunicação encontrada. Ajuste os filtros.')).to_be_visible()
    page.locator('#logout').click();expect(page.locator('#login-screen')).to_be_visible()
    assert page.locator('#email-monitor-root').inner_text()==''
    expect(page.locator('#email-monitor-nav')).not_to_be_visible()
    assert errors==[],errors
    record('Full shell '+role+' capability='+str(capability)+': session transport, lazy query, role filters, navigation and clearSession')
    context.close()

with sync_playwright() as p:
    executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
    options={'headless':True}
    if executable:options['executable_path']=executable
    browser=p.chromium.launch(**options)
    try:
        component(browser)
        for capability,role in [(True,'agent'),(False,'agent'),(True,'client'),(True,'admin')]:shell(browser,capability,role)
    finally:browser.close()
print(json.dumps({'scope':'offline component and full original shell; synthetic HTTPS/Auth; not hosted acceptance','checks':checks},ensure_ascii=False))
