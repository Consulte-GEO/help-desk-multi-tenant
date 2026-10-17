"""Real shell/Chromium, SYNTHETIC Auth/API; no production credentials or writes."""
import json,os,shutil,sys,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parent/'helpers'))
from browser_auth_fixture import prepare,fill_login,record,checks
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser,ticket_totals=True)
    start=page.locator('#created-from');end=page.locator('#created-before')
    assert start.count()==1 and end.count()==1,'Missing creation window controls'
    cdp=context.new_cdp_session(page);cdp.send('Emulation.setTimezoneOverride',{'timezoneId':'America/Los_Angeles'})
    assert page.evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone')=='America/Los_Angeles'
    summaries=[];lists=[]
    def totals(route):
        query=parse_qs(urlparse(route.request.url).query);summaries.append(query)
        counts={key:0 for key in ['received','in_progress','waiting_for_you','resolved','closed']};counts[query.get('status',['received'])[0]]=153
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'as_of':'2026-10-17T12:00:00.000Z','total':153,'statuses':counts}))
    page.route('**/v1/tickets/summary*',totals)
    with page.expect_response(re.compile(r'/v1/tickets\?')) as first:fill_login(page)
    base=first.value.json()['items'][0];base['created_at']=base['updated_at']='2026-10-17T12:00:00.000Z'
    def listing(route):
        lists.append(parse_qs(urlparse(route.request.url).query));route.fulfill(status=200,content_type='application/json',body=json.dumps({'items':[base],'next_cursor':None}))
    page.route('**/v1/tickets?*',listing)
    page.locator('#hd-filter-disclosure').evaluate('(n)=>n.open=true')
    start.fill('2026-10-17T00:00');end.fill('2026-10-18T00:00');expect(page.locator('#hd-filter-draft')).to_be_visible()
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('#apply-filters').click()
    expected={'created_from':['2026-10-17T03:00:00.000Z'],'created_before':['2026-10-18T03:00:00.000Z']}
    for key,value in expected.items():assert lists[-1].get(key)==value
    expect(page.locator('#stat-total')).to_have_text('153')
    for key,value in expected.items():assert summaries[-1].get(key)==value
    expect(page.locator('#applied-filters')).to_contain_text('Criados a partir de');expect(page.locator('#applied-filters')).to_contain_text('Criados antes de');expect(page.locator('#applied-filters')).to_contain_text('Brasília')
    expect(page.locator('#hd-filter-draft')).to_be_hidden();record('período de criação usa Brasília com navegador em outro fuso e alcança lista/totais completos')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('[data-ticket-view="waiting"]').click()
    for key,value in expected.items():assert lists[-1].get(key)==value
    assert lists[-1].get('status')==['waiting_for_you'];record('consulta rápida preserva período aplicado')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('[data-ticket-view="all"]').click()
    for key,value in expected.items():assert lists[-1].get(key)==value
    before=(len(lists),len(summaries));end.fill('2026-10-16T00:00');page.locator('#apply-filters').click()
    assert end.evaluate('(n)=>n.validity.customError');assert before==(len(lists),len(summaries));expect(page.locator('#applied-filters')).to_contain_text('18/10/2026')
    record('intervalo invertido não envia consulta nem substitui o estado aplicado')
    start.fill('2018-11-04T00:30');end.fill('');page.locator('#apply-filters').click();assert start.evaluate('(n)=>n.validity.customError');assert before==(len(lists),len(summaries))
    record('lacuna de horário de verão é recusada antes de consultar')
    start.fill('2026-10-17T00:00')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('#apply-filters').click()
    assert 'created_from' in lists[-1] and 'created_before' not in lists[-1];expect(page.locator('#hd-filter-draft')).to_be_hidden()
    record('limite inicial isolado é válido e mudança de campo remove erro anterior')
    out=Path(__file__).resolve().parents[1]/'evidence/created-window-20261017/browser';out.mkdir(parents=True,exist_ok=True)
    page.locator('#notification').wait_for(state='hidden',timeout=15000);page.screenshot(path=str(out/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});expect(start).to_be_visible();start.focus();expect(start).to_be_focused();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow';page.screenshot(path=str(out/'mobile-synthetic.png'),full_page=True)
    record('período acessível em desktop e390px sem transbordamento')
    with page.expect_response(re.compile(r'/v1/tickets\?')):page.locator('#clear-filters').click()
    assert start.input_value()==end.input_value()=='';assert 'created_from' not in lists[-1] and 'created_before' not in lists[-1]
    start.fill('2026-10-17T00:00');page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();assert start.input_value()==end.input_value()==''
    assert not posts and not errors,(posts,errors);record('limpar e logout removem valores/estado sem gravação de negócio ou erro JavaScript')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
