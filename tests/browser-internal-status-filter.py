"""Real shell and synthetic Auth/API; no production credentials or business writes."""
import json,os,shutil,sys,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parent/'helpers'))
from browser_auth_fixture import prepare,fill_login,record,checks,ACCOUNT,WS
from playwright.sync_api import sync_playwright,expect

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    summaries=[]
    def totals(route):
        summaries.append(parse_qs(urlparse(route.request.url).query))
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'as_of':'2026-10-17T00:00:00.000Z','total':32,'statuses':{'received':0,'in_progress':32,'waiting_for_you':0,'resolved':0,'closed':0}}))
    page.route('**/v1/tickets/summary*',totals)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as initial:fill_login(page)
    base=initial.value.json()['items'][0]
    field=page.locator('#internal-status-filter');assert field.count()==1,'Missing team status filter'
    page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open=true')
    expect(field).to_be_visible();field.select_option('waiting_internal')
    expect(page.locator('#hd-filter-draft')).to_be_visible()
    with page.expect_response(re.compile(r'/v1/tickets\?')) as response:page.locator('#apply-filters').click()
    assert parse_qs(urlparse(response.value.url).query).get('internal_status')==['waiting_internal']
    expect(page.locator('#applied-filters')).to_contain_text('Situação interna: Aguardando equipe')
    expect(page.locator('#stat-total')).to_have_text('32');assert summaries[-1].get('internal_status')==['waiting_internal']
    expect(page.locator('#ticket-view-status')).to_contain_text('personalizada')
    expect(page.locator('#hd-filter-draft')).to_be_hidden()
    record('filtro privado explícito na lista e no resumo com consulta personalizada')
    calls=[]
    def pages(route):
        q=parse_qs(urlparse(route.request.url).query);calls.append(q);more='cursor' in q
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[{**base,'id':'77777777-7777-4777-8777-777777777777'} if more else base],'next_cursor':None if more else 'private-page'}))
    page.route(re.compile(r'/v1/tickets\?'),pages);page.locator('#refresh').click();expect(page.locator('#more')).to_be_visible();page.locator('#more').click()
    expect(page.locator('#ticket-list .ticket-card')).to_have_count(2);assert calls[-1].get('internal_status')==['waiting_internal']
    record('paginação mantém filtro sem substituir totais completos')
    page.locator('#search').fill('needle');page.locator('#search-in').select_option('description')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('[data-ticket-view="waiting"]').click()
    expect(field).to_have_value('');assert 'internal_status' not in calls[-1]
    assert calls[-1].get('search_in')==['description'] and calls[-1].get('q')==['needle']
    expect(page.locator('#hd-filter-draft')).to_be_hidden()
    record('consulta rápida limpa situação interna no controle e na consulta e conserva a busca')
    page.locator('#clear-filters').click();expect(field).to_have_value('');expect(page.locator('#applied-filters')).to_contain_text('nenhum')
    page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open=true');field.select_option('waiting_third_party');page.locator('#apply-filters').click()
    expect(page.locator('#applied-filters')).to_contain_text('Aguardando terceiro')
    out=Path(__file__).resolve().parents[1]/'evidence/internal-status-filter-20261016/browser';out.mkdir(parents=True,exist_ok=True)
    page.locator('#notification').wait_for(state='hidden',timeout=15000);page.screenshot(path=str(out/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});expect(field).to_be_visible();field.focus();expect(field).to_be_focused()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow';page.screenshot(path=str(out/'mobile-synthetic.png'),full_page=True)
    record('filtros de equipe acessíveis em desktop e390px sem transbordamento')
    page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();assert field.input_value()==''
    assert page.locator('#internal-status-filter-label').is_hidden()
    # New human session, same shell, requester-only audience.
    def me(route):
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'33333333-3333-4333-8333-333333333333','kind':'human','workspace_id':WS,'workspace_role':None,'grants':[{'account_id':ACCOUNT,'role':'requester'}],'scopes':['tickets:read','tickets:write']}))
    page.route('**/v1/me',me)
    with page.expect_response(re.compile(r'/v1/tickets\?')):fill_login(page)
    expect(page.locator('#internal-status-filter-label')).to_be_hidden();expect(page.locator('#assignment-filter-label')).to_be_hidden()
    assert 'internal_status' not in calls[-1]
    assert not posts and not errors,(posts,errors)
    record('logout limpa o seletor e sessão solicitante não exibe nem envia filtro privado')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
