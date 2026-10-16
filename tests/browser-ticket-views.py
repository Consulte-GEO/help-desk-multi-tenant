"""Real shell/DOM; synthetic Auth/API. No production identities or business writes."""
import json, os, re, shutil
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
from helpers.browser_auth_fixture import prepare,fill_login,record,checks,WS,ACCOUNT

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    page.set_default_timeout(7000)
    state={'role':'agent','requests':[],'summary':[],'hold':False,'held':[]}
    person={'id':'33333333-3333-4333-8333-333333333333','kind':'human','workspace_id':WS,'workspace_role':None,'grants':[{'account_id':ACCOUNT,'role':'agent'}],'scopes':['tickets:read','tickets:write','notes:read','notes:write','contexts:resolve']}
    def me(route):
        route.fulfill(status=200,content_type='application/json',body=json.dumps({**person,'grants':[{'account_id':ACCOUNT,'role':state['role']}]}))
    page.route('**/v1/me',me)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as initial:
        fill_login(page)
    base=initial.value.json()['items'][0]
    def listing(route):
        q=parse_qs(urlparse(route.request.url).query);state['requests'].append(q)
        if state['hold']:state['held'].append(route);return
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[base],'next_cursor':None}))
    def summary(route):
        q=parse_qs(urlparse(route.request.url).query);state['summary'].append(q)
        status=q.get('status',['received'])[0];counts={k:0 for k in ['received','in_progress','waiting_for_you','resolved','closed']};counts[status]=7
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'as_of':'2026-10-16T15:00:00.000Z','total':7,'statuses':counts}))
    page.route(re.compile(r'/v1/tickets\?'),listing)
    page.route('**/v1/tickets/summary*',summary)
    expect(page.locator('#ticket-views button')).to_have_count(5)
    expect(page.locator('[data-ticket-view="all"]')).to_have_attribute('aria-pressed','true')
    record('equipe recebe cinco consultas rápidas e Todos representa consulta aplicada')
    page.locator('#search').fill('CG-10001');page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open=true');page.locator('#priority-filter').select_option('high')
    waiting=page.locator('[data-ticket-view="waiting"]');waiting.focus();waiting.press('Space')
    expect(waiting).to_have_attribute('aria-disabled','false');expect(waiting).to_be_focused()
    expect(page.locator('#stat-wait')).to_have_text('7')
    assert state['requests'][-1]['q']==['CG-10001'] and state['requests'][-1]['priority']==['high']
    assert state['requests'][-1]['status']==['waiting_for_you'] and state['summary'][-1]['status']==['waiting_for_you']
    assert state['summary'][-1]['q']==['CG-10001'] and state['summary'][-1]['priority']==['high']
    record('teclado aplica a mesma consulta na lista e totais, preservando busca/prioridade e foco')
    page.locator('[data-ticket-view="mine"]').click();expect(page.locator('[data-ticket-view="mine"]')).to_have_attribute('aria-disabled','false')
    assert state['requests'][-1]['assignment']==['mine'] and 'status' not in state['requests'][-1]
    page.locator('[data-ticket-view="all"]').click();expect(page.locator('[data-ticket-view="all"]')).to_have_attribute('aria-disabled','false')
    assert state['requests'][-1]['q']==['CG-10001'] and state['requests'][-1]['priority']==['high']
    assert 'status' not in state['requests'][-1] and 'assignment' not in state['requests'][-1]
    record('Meus atendimentos usa assignment nativo e Todos limpa apenas situação/responsabilidade')
    page.locator('#status-filter').select_option('resolved');page.locator('#assignment-filter').select_option('mine');page.locator('#apply-filters').click()
    expect(page.locator('#ticket-view-status')).to_contain_text('personalizada')
    expect(page.locator('#ticket-views [aria-pressed="true"]')).to_have_count(0)
    before=len(state['requests']);page.locator('#search').fill('x');page.locator('[data-ticket-view="all"]').click()
    assert len(state['requests'])==before
    expect(page.locator('#ticket-view-status')).to_contain_text('personalizada')
    page.locator('#search').fill('CG-10001')
    record('combinação manual é personalizada e entrada inválida não apaga a consulta anterior')
    state['hold']=True;page.locator('[data-ticket-view="unassigned"]').click()
    expect(page.locator('[data-ticket-view="unassigned"]')).to_have_attribute('aria-disabled','true')
    before=len(state['requests']);page.locator('[data-ticket-view="resolved"]').focus();page.keyboard.press('Space');assert len(state['requests'])==before
    state['hold']=False
    for route in state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[base],'next_cursor':None}))
    expect(page.locator('[data-ticket-view="unassigned"]')).to_have_attribute('aria-disabled','false')
    record('consulta pendente mantém foco e impede novas leituras por atalhos ocupados')
    output=Path(__file__).resolve().parents[1]/'evidence/ticket-views-20261016';output.mkdir(parents=True,exist_ok=True)
    page.locator('#notification').wait_for(state='hidden',timeout=15000)
    page.screenshot(path=str(output/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('[data-ticket-view="unassigned"]')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(output/'mobile-synthetic.png'),full_page=True)
    assert 'CG-10001' not in page.url and 'CG-10001' not in page.evaluate('JSON.stringify(localStorage)')
    record('consultas acessíveis em390px, sem overflow nem persistência dos termos')
    page.evaluate('window.__staleViewButton=document.querySelector("[data-ticket-view=mine]")')
    page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();expect(page.locator('#ticket-views button')).to_have_count(0)
    state['role']='requester';page.set_viewport_size({'width':1440,'height':1000});fill_login(page)
    expect(page.locator('#ticket-views button')).to_have_count(3)
    before=len(state['requests']);page.evaluate('window.__staleViewButton.click()');assert len(state['requests'])==before
    expect(page.locator('[data-ticket-view="mine"]')).to_have_count(0)
    assert not posts and not errors,(posts,errors)
    record('logout limpa consultas e botão antigo de operador não age na nova sessão de solicitante')
    page.locator('#logout').click();expect(page.locator('#login-screen')).to_be_visible()
    state['role']='agent';fill_login(page)
    expect(page.locator('[data-ticket-view="mine"]')).to_be_visible()
    expect(page.locator('[data-ticket-view="all"]')).to_have_attribute('aria-disabled','false')
    page.evaluate('window.__staleViewButton.click()')
    expect(page.locator('#assignment-filter')).to_have_value('')
    record('botão destacado de sessão antiga continua inerte após novo login de operador')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
