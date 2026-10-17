"""Real Chromium/shell with SYNTHETIC Auth/API. No business mutations."""
import json,os,shutil,sys,re,copy
from pathlib import Path
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parent/'helpers'))
from browser_auth_fixture import prepare,fill_login,record,checks
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    order=page.locator('#sort-filter');assert order.count()==1,'Missing creation-order selector'
    lists=[];summaries=[]
    def totals(route):
        q=parse_qs(urlparse(route.request.url).query);summaries.append(q);counts={k:0 for k in ['received','in_progress','waiting_for_you','resolved','closed']};counts[q.get('status',['received'])[0]]=153
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'as_of':'2026-10-17T12:00:00.000Z','total':153,'statuses':counts}))
    page.route('**/v1/tickets/summary*',totals)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as first:fill_login(page)
    base=first.value.json()['items'][0];older=copy.deepcopy(base);older['id']='77777777-7777-4777-8777-777777777777';older['subject']='Chamado antigo sintético';older['created_at']=older['updated_at']='2026-10-17T03:00:00.000100Z';base['created_at']=base['updated_at']='2026-10-17T03:00:00.000200Z'
    def listing(route):
        q=parse_qs(urlparse(route.request.url).query);lists.append(q);rows=copy.deepcopy([older,base] if q.get('sort')==['oldest'] else [base,older])
        for row in rows:row['status']=q.get('status',['received'])[0]
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':rows,'next_cursor':None}))
    page.route('**/v1/tickets?*',listing);page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open=true')
    expect(order).to_have_value('');expect(page.locator('#list-order')).to_have_text('Mais recentes primeiro');order.select_option('oldest');expect(page.locator('#hd-filter-draft')).to_be_visible();expect(page.locator('#list-order')).to_have_text('Mais recentes primeiro')
    record('ordem pendente não altera a indicação da consulta aplicada')
    page.locator('#created-from').fill('2026-10-17T00:00')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('#apply-filters').click()
    expect(page.locator('#list-order')).to_have_text('Mais antigos primeiro');expect(page.locator('#hd-filter-draft')).to_be_hidden();expect(page.locator('#stat-total')).to_have_text('153')
    for q in [lists[-1],summaries[-1]]:assert q.get('sort')==['oldest'] and q.get('created_from')==['2026-10-17T03:00:00.000Z']
    assert page.locator('.ticket-card').first.get_attribute('data-ticket-id')==older['id'];record('ordem chega à API antes das páginas e preserva os totais da consulta')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('[data-ticket-view="waiting"]').click()
    assert lists[-1].get('sort')==['oldest'] and lists[-1].get('created_from');expect(order).to_have_value('oldest');record('consulta rápida preserva ordem e período')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('[data-ticket-view="all"]').click()
    before=(len(lists),len(summaries));page.locator('#created-before').fill('2026-10-16T00:00');order.select_option('');page.locator('#apply-filters').click();assert before==(len(lists),len(summaries));expect(page.locator('#list-order')).to_have_text('Mais antigos primeiro');page.locator('#created-before').fill('');order.select_option('oldest');record('formulário inválido conserva a ordem aplicada e não dispara consulta')
    out=Path(__file__).resolve().parents[1]/'evidence/created-sort-20261017/browser';out.mkdir(parents=True,exist_ok=True);page.locator('#notification').wait_for(state='hidden',timeout=15000);page.screenshot(path=str(out/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});expect(order).to_be_visible();order.focus();expect(order).to_be_focused();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'mobile-synthetic.png'),full_page=True);record('seletor acessível por teclado em desktop/mobile390 sem transbordamento')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('#clear-filters').click()
    expect(order).to_have_value('');expect(page.locator('#list-order')).to_have_text('Mais recentes primeiro');assert 'sort' not in lists[-1] and 'created_from' not in lists[-1]
    order.select_option('oldest');page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();expect(order).to_have_value('');assert not posts and not errors,(posts,errors);record('limpar e logout restauram a ordem padrão sem gravações ou erros JavaScript')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
