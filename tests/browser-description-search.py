"""Real shell, synthetic Auth/API; no production credentials or business writes."""
import json,os,shutil,sys,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parent/'helpers'))
from browser_auth_fixture import prepare,fill_login,record,checks
from playwright.sync_api import sync_playwright,expect

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    totals=[]
    def summary(route):
        totals.append(parse_qs(urlparse(route.request.url).query))
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'as_of':'2026-10-16T21:00:00.000Z','total':607,'statuses':{'received':607,'in_progress':0,'waiting_for_you':0,'resolved':0,'closed':0}}))
    page.route('**/v1/tickets/summary*',summary)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as initial:fill_login(page)
    base=initial.value.json()['items'][0]
    mode=page.locator('#search-in')
    assert mode.count()==1,'Missing explicit description search selector'
    expect(mode).to_have_value('')
    mode.select_option('description')
    expect(page.locator('#hd-filter-draft')).to_be_visible()
    expect(page.locator('#search-help')).to_contain_text('descrição')
    page.locator('#search').fill('agulha')
    with page.expect_response(re.compile(r'/v1/tickets\?')) as result:page.locator('#apply-filters').click()
    query=parse_qs(urlparse(result.value.url).query)
    assert query.get('search_in')==['description'] and query.get('q')==['agulha']
    expect(page.locator('#applied-filters')).to_contain_text('descrição')
    expect(page.locator('#stat-total')).to_have_text('607')
    assert totals[-1].get('search_in')==['description'] and totals[-1].get('q')==['agulha']
    expect(page.locator('#hd-filter-draft')).to_be_hidden()
    record('modo explícito vai para lista e resumo completos e sai do rascunho ao aplicar')
    with page.expect_response(re.compile(r'/v1/tickets\?')) as quick:page.locator('[data-ticket-view="waiting"]').click()
    q=parse_qs(urlparse(quick.value.url).query)
    assert q.get('search_in')==['description'] and q.get('q')==['agulha'] and q.get('status')==['waiting_for_you']
    record('consulta rápida preserva descrição e termo')
    calls=[]
    def pages(route):
        q=parse_qs(urlparse(route.request.url).query);calls.append(q)
        more='cursor' in q
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[{**base,'id':'77777777-7777-4777-8777-777777777777'} if more else base],'next_cursor':None if more else 'description-page'}))
    page.route(re.compile(r'/v1/tickets\?'),pages)
    page.locator('#refresh').click();expect(page.locator('#more')).to_be_visible();page.locator('#more').click()
    expect(page.locator('#ticket-list .ticket-card')).to_have_count(2)
    assert calls[-1].get('search_in')==['description'] and calls[-1].get('cursor')==['description-page']
    before=len(calls);page.locator('#search').fill('');page.locator('#apply-filters').click()
    assert len(calls)==before,'Empty description query dispatched'
    page.locator('[data-ticket-view="waiting"]').click()
    assert len(calls)==before and not errors,'Empty description query dispatched via quick view or caused page error'
    record('paginação preserva modo; descrição sem termo não faz leitura')
    page.locator('#clear-filters').click();expect(mode).to_have_value('');expect(page.locator('#search')).to_have_value('')
    expect(page.locator('#applied-filters')).to_contain_text('nenhum')
    assert 'search_in' not in calls[-1]
    record('limpar restaura consulta padrão e remove modo também do resumo')
    mode.select_option('description');page.locator('#search').fill('agulha');page.locator('#apply-filters').click()
    expect(page.locator('#applied-filters')).to_contain_text('descrição')
    output=Path(__file__).resolve().parents[1]/'evidence/description-search-20261016/browser';output.mkdir(parents=True,exist_ok=True)
    page.locator('#notification').wait_for(state='hidden',timeout=15000)
    page.screenshot(path=str(output/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    expect(mode).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow'
    mode.focus();expect(mode).to_be_focused();page.screenshot(path=str(output/'mobile-synthetic.png'),full_page=True)
    record('desktop e390px sem transbordamento com seletor acessível por teclado')
    page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible()
    assert mode.input_value()=='' and page.locator('#search').input_value()==''
    assert not posts and not errors,(posts,errors)
    record('logout limpa modo e termo sem escrita de negócio nem erro de página')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
