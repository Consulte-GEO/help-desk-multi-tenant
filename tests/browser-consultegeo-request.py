"""M09a real handlers/domain/UI; owned synthetic Auth/origin/physical persistence."""
import json, os, shutil, subprocess
from pathlib import Path
from queue import Queue, Empty
from threading import Thread
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
checks=[]
def record(name): checks.append({'check':name,'result':'passed'})
process=subprocess.Popen(['node','--experimental-strip-types','tests/fixtures/consultegeo-request/browser-server.ts'],cwd=root,env={**os.environ,'HELPDESK_OWNED_REQUEST_BROWSER':'synthetic-loopback'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    ready=Queue();Thread(target=lambda:ready.put(process.stdout.readline()),daemon=True).start()
    try: line=ready.get(timeout=10)
    except Empty: raise RuntimeError('Owned M09a fixture did not start') from None
    if not line: raise RuntimeError(process.stderr.read()[:1200])
    base=json.loads(line)['url'];assert base.startswith('http://127.0.0.1:')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
        page=browser.new_page();page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in [1440,390]:
            page.request.post(base+'/_test/reset');page.set_viewport_size({'width':width,'height':1050});page.goto(base)
            selector=page.get_by_role('combobox',name='Ação desejada');expect(selector).to_have_value('');assert page.request.get(base+'/_test/counts').json()['requests']==0;record(str(width)+' explicit choice before requests')
            for i in range(5):
                selector.select_option(str(i))
                if i: page.get_by_role('button',name='Trocar ação e descartar dados').click()
                expect(page.get_by_text('Primeira resposta: 4 horas úteis. Solução: 10 horas úteis.')).to_be_visible()
                if i: expect(page.get_by_role('button',name='Consultar opções autorizadas')).to_be_disabled()
            assert page.request.get(base+'/_test/counts').json()['requests']==0;record(str(width)+' five published forms; unavailable lookup has no grant')
            selector.select_option('0');page.get_by_role('button',name='Trocar ação e descartar dados').click()
            page.get_by_role('textbox',name='Nome completo da pessoa').fill('Pessoa <img onerror="window.injected=true">')
            page.get_by_role('textbox',name='E-mail para o acesso').fill('synthetic@example.invalid')
            page.get_by_role('textbox',name='Grupo e permissões solicitadas').fill('Grupo sintético')
            page.get_by_role('textbox',name='Descrição e informações para atendimento').fill('Solicitação sintética')
            page.get_by_role('combobox',name='Classificação sintética do ensaio').select_option('normal')
            page.get_by_role('textbox',name='Descrição',exact=True).fill('Descrição sintética para análise')
            page.get_by_role('button',name='Salvar rascunho',exact=True).click();expect(page.get_by_role('button',name='Revisar solicitação',exact=True)).to_be_enabled()
            page.get_by_role('button',name='Revisar solicitação',exact=True).click();expect(page.get_by_role('button',name='Confirmar abertura',exact=True)).to_be_enabled();assert page.request.get(base+'/_test/counts').json()['tickets']==0;record(str(width)+' save and real advisory preview create no ticket')
            screenshot=os.environ.get('HELPDESK_REQUEST_SCREENSHOTS')
            if screenshot:
                out=Path(screenshot).resolve();assert out==root/'evidence'/'consultegeo-m09a'/'screenshots';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/('request-'+str(width)+'.png')),full_page=True)
            page.request.post(base+'/_test/unknown');page.get_by_role('button',name='Confirmar abertura',exact=True).click();expect(page.get_by_role('button',name='Conciliar mesma intenção',exact=True)).to_be_enabled();expect(selector).to_be_disabled();assert page.request.get(base+'/_test/counts').json()['tickets']==1;record(str(width)+' lost commit locks switching and preserves intent')
            page.get_by_role('button',name='Conciliar mesma intenção',exact=True).click();expect(page.get_by_text('Solicitação registrada: CG-10001. Notificação pendente.')).to_be_visible();assert page.request.get(base+'/_test/counts').json()['tickets']==1;assert page.evaluate('window.injected') is None;record(str(width)+' same intent reconciles one protocol; no delivery claim')
            selector.select_option('0');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');record(str(width)+' responsive labeled controls and safe text')
            page.get_by_role('button',name='Sair da sessão sintética').click();assert 'CG-10001' not in page.locator('#request').inner_text();assert 'synthetic@example.invalid' not in page.locator('#request').inner_text();record(str(width)+' session clear scrubs UI')
        assert not errors, errors
        browser.close()
finally:
    process.terminate()
    try:process.wait(timeout=3)
    except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
result={'fixture':'owned_loopback_synthetic_auth_source_physical_store','checks':checks}
artifact=root/'evidence'/'consultegeo-m09a'/'browser-request.json';artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(json.dumps(result,ensure_ascii=False))
