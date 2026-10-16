"""Real shell/Chromium; intercepted synthetic Auth/API. No productive reads or writes."""
import copy,json,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from helpers.browser_auth_fixture import prepare,fill_login,record,checks,TICKET

def message(id,body,time):
    return {'id':id,'ticket_id':TICKET,'body':body,'actor_type':'human_agent','created_at':'2026-09-17T'+time+':00.000Z'}

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'))
    context,page,errors,posts=prepare(browser)
    page.set_default_timeout(7000)
    public=[message('a','Concreto recebido. CONCRETO conferido.','10:00'),message('b','Revisão da área.','11:00'),message('c','Concreto liberado <img src=x onerror=alert(1)>.','12:00')]
    calls=[];message_state={'status':200,'hold':False,'held':[]}
    def messages(route):
        calls.append(route.request.url)
        if 'cursor=' in route.request.url and message_state['hold']:
            message_state['held'].append(route);return
        if 'cursor=' in route.request.url and message_state['status']!=200:
            route.fulfill(status=message_state['status'],content_type='application/problem+json',body=json.dumps({'code':'forbidden','detail':'Consulta recusada'}));return
        value={'items':[message('older','Concreto anterior','09:00')],'next_cursor':None} if 'cursor=' in route.request.url else {'items':list(reversed(public)),'next_cursor':'older-public'}
        value=copy.deepcopy(value)
        for item in value['items']:item['ticket_id']=route.request.url.split('/v1/tickets/')[1].split('/')[0]
        route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
    page.route(re.compile(r'/v1/tickets/[^/]+/messages(?:\?|$)'),messages)
    def notes(route):
        note=message('n','CONFIDENCIAL concreto','12:30');note.pop('actor_type');note['ticket_id']=route.request.url.split('/v1/tickets/')[1].split('/')[0]
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[note],'next_cursor':None}))
    page.route(re.compile(r'/v1/tickets/[^/]+/notes(?:\?|$)'),notes)
    detail_pattern=re.compile(r'/v1/tickets/'+TICKET+r'$')
    with page.expect_response(detail_pattern) as response:fill_login(page)
    original=response.value.json()
    root=page.locator('#message-search');field=page.get_by_label('Buscar nas mensagens carregadas')
    expect(root).to_be_visible();expect(page.locator('#message-search-status')).to_contain_text('3 mensagem(ns)')
    expect(page.locator('#message-search-status')).to_contain_text('Carregue mensagens anteriores')
    record('busca informa conjunto público carregado e paginação ainda não consultada')
    baseline=len(calls);field.fill('CONCRETO');expect(page.locator('#message-search-status')).to_contain_text('1 de 2 mensagens')
    expect(page.locator('#notes')).to_contain_text('CONFIDENCIAL concreto')
    expect(page.locator('#messages .message-search-match')).to_have_count(2)
    expect(page.locator('#messages article')).to_have_count(3);expect(page.locator('#notes .message-search-match')).to_have_count(0)
    expect(page.locator('#messages img, #messages script, #messages mark')).to_have_count(0)
    expect(page.locator('#messages')).to_contain_text('<img src=x onerror=alert(1)>')
    record('busca conta mensagens uma vez, preserva contexto e trata HTML como texto')
    page.locator('#message-search-next').click();expect(page.locator('#message-search-status')).to_contain_text('2 de 2 mensagens')
    expect(page.locator('#messages [aria-current="true"]')).to_be_focused()
    field.focus();field.press('Shift+Enter');expect(page.locator('#message-search-status')).to_contain_text('1 de 2 mensagens')
    field.focus();field.press('Enter');expect(page.locator('#message-search-status')).to_contain_text('2 de 2 mensagens')
    assert len(calls)==baseline
    record('anterior/próxima e Enter/Shift+Enter movem foco sem requisitar mensagens')
    page.locator('#older-messages').click();expect(page.locator('#message-search-status')).to_contain_text('3 de 3 mensagens')
    expect(page.locator('#message-search-status')).to_contain_text('4 mensagem(ns)')
    expect(page.locator('#message-search-status')).not_to_contain_text('Carregue mensagens anteriores')
    expect(field).to_have_value('CONCRETO');assert len(calls)==baseline+1
    record('página anterior amplia a busca e preserva a mensagem selecionada')
    field.fill('CONFIDENCIAL');expect(page.locator('#message-search-status')).to_contain_text('Nenhuma mensagem encontrada')
    expect(page.locator('#message-search-next')).to_be_disabled();expect(page.locator('#notes .message-search-match')).to_have_count(0)
    field.fill('.*');expect(page.locator('#message-search-status')).to_contain_text('Nenhuma mensagem encontrada')
    field.fill('x');expect(field).to_have_attribute('aria-invalid','true')
    field.press('Escape');expect(field).to_have_value('');expect(field).to_be_focused();expect(field).to_have_attribute('aria-invalid','false')
    record('notas não participam da busca; regex é literal; limite e Escape são acessíveis')
    field.fill('concreto');page.set_viewport_size({'width':390,'height':844})
    page.locator('.ticket-card').first.click();expect(root).to_be_visible();field.fill('concreto')
    expect(root).to_be_visible();assert root.evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    for id in ['message-search-previous','message-search-next','message-search-clear']:
        box=page.locator('#'+id).bounding_box();assert box and box['height']>=44
    field.focus();field.press('Tab');expect(page.locator('#message-search-previous')).to_be_focused()
    screenshots=os.environ.get('HELPDESK_MESSAGE_SEARCH_SCREENSHOTS')
    if screenshots:
        out=Path(screenshots);out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/'mobile.png'),full_page=True)
    record('390px sem rolagem horizontal, alvos de toque e ordem Tab preservados')
    page.set_viewport_size({'width':1440,'height':1000})
    if screenshots:page.screenshot(path=str(Path(screenshots)/'desktop.png'),full_page=True)
    message_state['status']=403;page.locator('#older-messages').click()
    expect(root).to_be_hidden();expect(field).to_have_value('');expect(page.locator('#messages article')).to_have_count(0)
    record('revogação durante paginação limpa termo, resultados e conteúdo anterior')
    message_state['status']=200;page.locator('#refresh').click();expect(page.locator('.ticket-card')).to_have_count(1)
    page.locator('.ticket-card').first.click();expect(root).to_be_visible()
    alternate=copy.deepcopy(original);alternate['id']='77777777-7777-4777-8777-777777777777';alternate['subject']='Outro chamado autorizado';alternate['available_actions']['ticket_id']=alternate['id']
    rows=[{k:v for k,v in item.items() if k!='available_actions'} for item in [original,alternate]]
    page.route(re.compile(r'/v1/tickets\?(?:.*)$'),lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'items':rows,'next_cursor':None})))
    detail_state={'hold':False,'held':[],'status':200}
    alternate_pattern=re.compile(r'/v1/tickets/'+alternate['id']+r'$')
    def alternate_detail(route):
        if detail_state['hold']:detail_state['held'].append(route);return
        route.fulfill(status=detail_state['status'],content_type='application/json',body=json.dumps(alternate if detail_state['status']==200 else {'detail':'Acesso recusado','code':'forbidden'}))
    page.route(alternate_pattern,alternate_detail)
    page.locator('#refresh').click();expect(page.locator('.ticket-card')).to_have_count(2)
    field.fill('concreto');page.locator('.ticket-card').nth(1).click();expect(page.locator('#ticket-title')).to_have_text('Outro chamado autorizado')
    expect(field).to_have_value('');expect(page.locator('#messages .message-search-match')).to_have_count(0)
    record('troca de chamado remove termo e resultados do contexto anterior')
    message_state['hold']=True
    with page.expect_request(re.compile(r'/messages\?.*cursor=')):page.locator('#older-messages').click()
    page.locator('.ticket-card').first.click();expect(page.locator('#ticket-title')).to_have_text(original['subject']);field.fill('ÁREA')
    assert len(message_state['held'])==1
    for route in message_state['held']:route.fulfill(status=403,content_type='application/problem+json',body=json.dumps({'code':'forbidden','detail':'Página antiga recusada'}))
    message_state['held']=[];message_state['hold']=False
    page.wait_for_load_state('networkidle');expect(root).to_be_visible();expect(field).to_have_value('ÁREA');expect(page.locator('#messages .message-search-match')).to_have_count(1)
    record('recusa tardia de página de outro chamado não apaga a busca atual')
    refresh_state={'hold':True,'held':[]}
    def refresh_detail(route):
        if refresh_state['hold']:refresh_state['held'].append(route);return
        route.fulfill(status=200,content_type='application/json',body=json.dumps(original))
    page.route(detail_pattern,refresh_detail)
    with page.expect_request(detail_pattern):page.locator('#refresh').click()
    message_state['status']=403;page.locator('#older-messages').click()
    expect(root).to_be_hidden();expect(page.locator('#messages article')).to_have_count(0)
    assert len(refresh_state['held'])==1
    refresh_state['hold']=False
    for route in refresh_state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(original))
    refresh_state['held']=[]
    page.wait_for_load_state('networkidle');expect(root).to_be_hidden();expect(field).to_have_value('');expect(page.locator('#messages article')).to_have_count(0)
    record('recusa vigente também invalida detalhe200 iniciado antes e concluído depois da recusa')
    message_state['status']=200;page.locator('#refresh').click();expect(page.locator('.ticket-card')).to_have_count(2)
    page.locator('.ticket-card').nth(1).click();expect(page.locator('#ticket-title')).to_have_text('Outro chamado autorizado')
    field.fill('concreto');detail_state['status']=403;page.locator('#refresh').click()
    expect(root).to_be_hidden();expect(field).to_have_value('');expect(page.locator('#messages article')).to_have_count(0)
    record('recusa de acesso remove busca e conteúdo anterior mesmo no DOM oculto')
    detail_state['status']=200;page.locator('#refresh').click();expect(page.locator('.ticket-card')).to_have_count(2)
    page.locator('.ticket-card').nth(1).click();expect(root).to_be_visible();field.fill('concreto')
    detail_state['hold']=True
    with page.expect_request(alternate_pattern):page.locator('#refresh').click()
    expect(root).to_be_hidden();expect(field).to_have_value('')
    page.locator('#logout').click();expect(page.locator('#login-screen')).to_be_visible();expect(root).to_be_hidden()
    assert len(detail_state['held'])==1
    for route in detail_state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(alternate))
    page.wait_for_load_state('networkidle');expect(root).to_be_hidden();expect(field).to_have_value('');expect(page.locator('#messages')).to_have_text('')
    assert not errors and not posts,(errors,posts)
    record('atualização/logout e resposta tardia não restauram termos ou resultados; nenhuma escrita')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
