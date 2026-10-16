"""Real shell/DOM, synthetic provider/API. No production credentials or writes."""
import json, sys, os, shutil, re
from urllib.parse import urlparse,parse_qs
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'helpers'))
from browser_auth_fixture import prepare,fill_login,record,checks
from playwright.sync_api import sync_playwright,expect

def summary(n=607):
    return {'as_of':'2026-10-16T15:00:00.000Z','total':n,'statuses':{'received':n,'in_progress':0,'waiting_for_you':0,'resolved':0,'closed':0}}

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get("BROWSER_EXECUTABLE") or shutil.which("chromium"))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    state={'mode':'ok','calls':0,'held':[]}
    def totals(route):
        state['calls']+=1
        if state['mode']=='hold':state['held'].append(route);return
        if state['mode']=='error':route.fulfill(status=503,content_type='application/json',body='{}');return
        route.fulfill(status=200,content_type='application/json',body=json.dumps(summary()))
    page.route('**/v1/tickets/summary*',totals)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as first:
        fill_login(page)
    base=first.value.json()['items'][0]
    expect(page.locator('#stat-total')).to_have_text('607')
    expect(page.locator('#list-count')).to_contain_text('1 carregado')
    expect(page.locator('#stat-total-label')).to_have_text('Chamados da consulta')
    record('resumo completo607 independente de um item carregado')
    state['mode']='error';page.locator('#refresh').click()
    expect(page.locator('#stat-total')).to_have_text('—')
    expect(page.locator('#summary-status')).to_contain_text('indisponíveis')
    expect(page.locator('#ticket-list .ticket-card')).to_have_count(1)
    state['mode']='ok';page.locator('#summary-retry').click()
    expect(page.locator('#stat-total')).to_have_text('607')
    record('falha de resumo não apaga lista e repetição recupera sem zero presumido')
    def pages(route):
        more='cursor' in parse_qs(urlparse(route.request.url).query)
        item={**base,'id':'77777777-7777-4777-8777-777777777777'} if more else base
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[item],'next_cursor':None if more else 'cursor-next'}))
    page.route(re.compile(r'/v1/tickets\?'),pages)
    page.locator('#refresh').click()
    expect(page.locator('#more')).to_be_visible()
    expect(page.locator('#stat-total')).to_have_text('607')
    before=state['calls'];page.locator('#more').click()
    expect(page.locator('#ticket-list .ticket-card')).to_have_count(2)
    expect(page.locator('#stat-total')).to_have_text('607')
    assert state['calls']==before
    record('carregar mais não reconta nem substitui os totais completos')
    state['mode']='hold';page.locator('#search').fill('antigo');page.locator('#ticket-filters').evaluate('(f)=>f.requestSubmit()')
    expect(page.locator('#summary-status')).to_contain_text('Consultando')
    page.locator('#ticket-list .ticket-card').first.wait_for(state='attached')
    state['mode']='ok';page.locator('#search').fill('novo');page.locator('#ticket-filters').evaluate('(f)=>f.requestSubmit()')
    expect(page.locator('#stat-total')).to_have_text('607')
    for route in state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(summary(999)))
    expect(page.locator('#stat-total')).to_have_text('607')
    record('resumo de filtro antigo não substitui a nova consulta')
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('#stat-total')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Mobile overflow'
    record('cartões de totais legíveis em390px sem transbordamento')
    state['held']=[];state['mode']='hold';page.locator('#refresh').click()
    expect(page.locator('#summary-status')).to_contain_text('Consultando')
    page.locator('#logout-mobile').click()
    expect(page.locator('#login-screen')).to_be_visible()
    for route in state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(summary(999)))
    assert '607' not in page.locator('.stats').inner_text() and '999' not in page.locator('.stats').inner_text()
    assert not posts and not errors,(posts,errors)
    record('logout elimina totais sem escrita de negócio nem erro de página')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
