"""Real shell/DOM with synthetic Auth and API. No production account or writes."""
import copy, json, os, re, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from helpers.browser_auth_fixture import prepare,fill_login,record,checks,TICKET

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'))
    context,page,errors,posts=prepare(browser)
    page.set_default_timeout(7000)
    pattern=re.compile(r'/v1/tickets/'+TICKET+r'$')
    with page.expect_response(pattern) as response:
        fill_login(page)
    original=response.value.json();panel=page.locator('#ticket-guidance')
    expect(panel).to_be_visible();expect(panel).to_contain_text('Novo');expect(panel).to_contain_text('Sem responsável')
    expect(panel.locator('button,input,select,textarea,a')).to_have_count(0)
    record('resumo usa detalhe autorizado e não cria comandos ou consultas próprias')
    state={'body':copy.deepcopy(original),'held':[],'hold':False,'status':200}
    def detail(route):
        if state['hold']:state['held'].append(route);return
        route.fulfill(status=state['status'],content_type='application/json',body=json.dumps(state['body']))
    page.route(pattern,detail)
    state['body'].update(internal_status='waiting_third_party',status='in_progress',version=2,assignment={'state':'mine','can_claim':False,'can_release':True})
    state['body']['available_actions'].update(version=2,claim=False,release=True,transitions=[])
    page.locator('#refresh').click();expect(panel).to_contain_text('Aguardando terceiro');expect(panel).to_contain_text('Você');expect(panel).to_contain_text('Versão 2')
    record('equipe distingue dependência de terceiro e responsabilidade relativa na versão atual')
    state['hold']=True;page.locator('#refresh').click();expect(panel).to_be_hidden();expect(panel).to_have_text('')
    page.wait_for_function('document.querySelector("#detail-action-status").textContent.includes("Atualizando")')
    assert len(state['held'])==1
    for route in state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(state['body']))
    state['held']=[];state['hold']=False;expect(panel).to_be_visible()
    record('nova consulta remove a orientação antiga enquanto aguarda confirmação da leitura')
    out=Path(__file__).resolve().parents[1]/'evidence/ticket-guidance-20261016';out.mkdir(parents=True,exist_ok=True)
    page.locator('#notification').wait_for(state='hidden',timeout=15000)
    panel.scroll_into_view_if_needed();page.evaluate('document.activeElement.blur()');page.screenshot(path=str(out/'desktop-synthetic.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.locator('.ticket-card').first.click();expect(panel).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.evaluate('document.activeElement.blur()');page.screenshot(path=str(out/'mobile-synthetic.png'),full_page=True)
    page.evaluate('document.documentElement.setAttribute("data-theme","dark")')
    page.screenshot(path=str(out/'mobile-dark-synthetic.png'),full_page=True)
    page.evaluate('document.documentElement.setAttribute("data-theme","light")')
    record('resumo e próximo passo legíveis em390px sem overflow horizontal')
    # /me still says agent; the current public detail is the presentation boundary.
    state['body']=copy.deepcopy(original);state['body'].pop('internal_status');state['body'].pop('assignment');state['body']['status']='waiting_for_you'
    state['body']['available_actions'].update(read_notes=False,add_note=False,change_priority=False,claim=False,release=False,transitions=[])
    page.set_viewport_size({'width':1440,'height':1000});page.locator('#refresh').click()
    expect(panel).to_contain_text('Aguardando você');expect(panel).not_to_contain_text('Responsabilidade');expect(panel).not_to_contain_text('terceiro')
    record('detalhe público remove dados internos mesmo com perfil geral de operador')
    state['body']['available_actions']['reply']=False;page.locator('#refresh').click();expect(panel).to_contain_text('somente consulta')
    record('permissões atuais de consulta substituem a orientação de escrita anterior')
    state['status']=403;state['body']={'detail':'Consulta recusada','code':'forbidden'};page.locator('#refresh').click()
    expect(panel).to_be_hidden();expect(panel).to_have_text('')
    record('recusa de acesso não retém orientação ou responsabilidade no DOM oculto')
    state['status']=200;state['body']=copy.deepcopy(original)
    page.locator('#refresh').click();expect(page.locator('.ticket-card')).to_have_count(1)
    page.locator('.ticket-card').first.click();expect(panel).to_be_visible()
    state['hold']=True;page.locator('#refresh').click();expect(panel).to_be_hidden();expect(panel).to_have_text('')
    page.locator('#logout').click();expect(page.locator('#login-screen')).to_be_visible();expect(panel).to_have_text('');expect(panel).to_be_hidden()
    assert len(state['held'])==1
    for route in state['held']:route.fulfill(status=200,content_type='application/json',body=json.dumps(state['body']))
    page.wait_for_load_state('networkidle');expect(panel).to_have_text('');expect(panel).to_be_hidden()
    assert not posts and not errors,(posts,errors)
    record('logout e resposta tardia não restauram o resumo; nenhuma escrita ou erro de página')
    context.close();browser.close()
print(json.dumps({'checks':checks}))
