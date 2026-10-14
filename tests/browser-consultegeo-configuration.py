"""Real Chromium and M04 HTTP/editor/publisher, owned synthetic persistence/Auth only."""
import json
import os
from pathlib import Path
from queue import Queue, Empty
import shutil
import subprocess
from threading import Thread
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
checks = []
def record(name):
    checks.append({'check': name, 'result': 'passed'})
env = {**os.environ, 'HELPDESK_OWNED_CONFIGURATION_BROWSER': 'synthetic-loopback'}
process = subprocess.Popen(['node', '--experimental-strip-types', 'tests/fixtures/configuration/browser-server.ts'], cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    ready = Queue()
    Thread(target=lambda: ready.put(process.stdout.readline()), daemon=True).start()
    try:
        line = ready.get(timeout=10)
    except Empty:
        raise RuntimeError('Owned configuration fixture did not start') from None
    if not line:
        raise RuntimeError('Owned fixture failed: ' + process.stderr.read()[:1200])
    base = json.loads(line)['url']
    assert base.startswith('http://127.0.0.1:')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'), args=['--no-sandbox'])
        page = browser.new_page()
        page.set_default_timeout(6000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        for width in [1440, 390]:
            page.request.post(base + '/_test/reset')
            page.set_viewport_size({'width': width, 'height': 1100})
            page.goto(base)
            expect(page.get_by_role('heading', name='Configuração de atendimento Consulte GEO')).to_be_visible()
            expect(page.get_by_text('Primeira resposta: 4 horas úteis. Solução: 10 horas úteis.')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            record(str(width) + ' preview and layout')
            selector = page.get_by_role('combobox', name='Ação para visualizar')
            for i in range(5):
                selector.select_option(str(i))
                expect(page.get_by_role('heading', name='Checklist interno')).to_be_visible()
            record(str(width) + ' five action previews')
            selector.select_option('0')
            page.get_by_role('textbox', name='Motivo da alteração ou publicação').fill('Configuração conferida')
            page.get_by_role('button', name='Preparar publicação', exact=True).click()
            assert page.request.get(base + '/_test/counts').json()['requests'] == 0
            record(str(width) + ' explicit preparation has no write')
            page.get_by_role('button', name='Confirmar operação', exact=True).click()
            expect(page.get_by_text('Operação confirmada. Consulte a versão atual antes de continuar.')).to_be_visible()
            assert page.request.get(base + '/_test/counts').json()['audits'] == 2
            record(str(width) + ' confirmed publication through handler')
            page.get_by_role('button', name='Consultar versão atual', exact=True).click()
            expect(page.get_by_text('Acesso de usuário · Versão 1 · Publicada', exact=False)).to_be_visible()
            expect(page.get_by_role('button', name='Salvar rascunho', exact=True)).to_be_disabled()
            record(str(width) + ' publication metadata and immutability')
            screenshot = os.environ.get('HELPDESK_CONFIGURATION_SCREENSHOTS')
            if screenshot:
                out = Path(screenshot).resolve()
                assert out == root / 'evidence' / 'consultegeo-m04' / 'screenshots'
                out.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(out / ('configuration-' + str(width) + '.png')), full_page=True)
            page.get_by_role('textbox', name='Motivo da alteração ou publicação').fill('Revisar próxima versão')
            page.get_by_role('button', name='Preparar nova versão', exact=True).click()
            page.get_by_role('button', name='Confirmar operação', exact=True).click()
            expect(page.get_by_text('Operação confirmada. Consulte a versão atual antes de continuar.')).to_be_visible()
            page.get_by_role('button', name='Consultar versão atual', exact=True).click()
            expect(page.get_by_text('Acesso de usuário · Versão 2 · Rascunho', exact=False)).to_be_visible()
            record(str(width) + ' restore creates successor')
            page.get_by_role('button', name='Sair da sessão sintética', exact=True).click()
            page.evaluate("document.querySelector('select[aria-label=\"Ação para visualizar\"]').dispatchEvent(new Event('change'))")
            assert page.locator('#configuration textarea').input_value() == ''
            assert 'Registrar a execução' not in page.locator('#configuration').inner_text()
            record(str(width) + ' cleared audience remains cleared after late event')
        page.request.post(base + '/_test/reset')
        page.goto(base)
        page.get_by_role('textbox', name='Motivo da alteração ou publicação').fill('Confirmação incerta')
        page.request.post(base + '/_test/unknown')
        page.get_by_role('button', name='Preparar publicação', exact=True).click()
        page.get_by_role('button', name='Confirmar operação', exact=True).click()
        expect(page.get_by_text('Confirmação desconhecida. Concilie a mesma intenção.')).to_be_visible()
        page.get_by_role('button', name='Conciliar mesma intenção', exact=True).click()
        expect(page.get_by_text('Operação confirmada. Consulte a versão atual antes de continuar.')).to_be_visible()
        assert page.request.get(base + '/_test/counts').json() == {'requests': 2, 'audits': 2}
        record('unknown response reconciles without a second publication')
        assert errors == [], errors
        record('no browser execution errors')
        browser.close()
    print(json.dumps({'checks': checks}))
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
