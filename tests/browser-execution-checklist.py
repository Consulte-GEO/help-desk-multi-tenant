"""Real Chromium + owned HTTP/handler/service/resolver/store/transaction.
Identity authority, notes and the physical SQL transport remain synthetic.
This suite never accepts a hosted base URL, credential, database or file target.
"""
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
checks = []
def record(name):
    checks.append({'check': name, 'result': 'passed'})

env = {**os.environ, 'HELPDESK_OWNED_CHECKLIST_BROWSER': 'synthetic-loopback'}
process = subprocess.Popen(['node', '--experimental-strip-types', 'tests/fixtures/checklist/browser-server.ts'], cwd=root, env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    ready, _, _ = select.select([process.stdout], [], [], 10)
    if not ready:
        raise RuntimeError('Owned checklist fixture did not become ready')
    line = process.stdout.readline()
    if not line:
        raise RuntimeError('Owned checklist fixture exited before ready: '+process.stderr.read()[:1200])
    base = json.loads(line)['url']
    assert base.startswith('http://127.0.0.1:')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'), args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1100})
        errors = []
        page.on('pageerror', lambda _e: errors.append('pageerror'))
        page.set_default_timeout(5000)
        def counts():
            return page.request.get(base+'/_test/counts').json()
        def reset(mode=None):
            page.request.post(base+'/_test/reset')
            if mode:
                page.request.post(base+'/_test/mode?value='+mode)
            page.goto(base, wait_until='domcontentloaded')
            expect(page.locator('[data-checklist-item]')).to_have_count(3)
        def edit(item):
            page.locator('[data-checklist-item="'+item+'"]').get_by_role('button', name='Registrar item', exact=True).click()
            expect(page.get_by_role('dialog')).to_be_visible()
        def fill_evidence():
            page.get_by_role('button', name='Consultar minhas notas', exact=True).click()
            expect(page.locator('[data-checklist-note]')).to_have_count(1)
            page.locator('[data-checklist-note]').check()
            expect(page.locator('[data-checklist-evidence-status]')).to_contain_text('1 nota(s) selecionada(s)')
        try:
            reset()
            expect(page.get_by_role('heading', name='Checklist de execução', exact=True)).to_be_visible()
            expect(page.locator('[data-checklist-progress]')).to_contain_text('0 de 3')
            assert page.get_by_role('button', name='Resolver chamado', exact=True).count() == 0
            record('Internal progress is advisory, with no button that resolves a ticket')
            boundary = counts()
            assert boundary['boundary'] == 'real-handler-service-resolver-store-runner'
            assert boundary['authChecks'] > 0 and boundary['resourceReads'] >= 2 and boundary['scopeChecks'] > 0
            record('Checklist HTTP reaches the real application stack; identity and SQL transport remain synthetic')

            edit('grupo')
            expect(page.get_by_label('Situação do item', exact=True)).to_be_focused()
            page.keyboard.press('Escape')
            expect(page.get_by_role('dialog')).not_to_be_visible()
            assert counts()['writes'] == 0
            record('Dialog opens with keyboard focus; Escape cancels without sending')

            edit('risco')
            fill_evidence()
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            expect(page.get_by_role('button', name='Confirmar marcação', exact=True)).not_to_be_visible()
            page.get_by_label('Reconheço o risco e conferi a execução', exact=True).check()
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            expect(page.get_by_role('dialog')).to_contain_text('A marcação não executa ações no GEO')
            assert counts()['writes'] == 0
            record('Sensitive item requires acknowledgement and review, without side effects')
            assert page.get_by_label('Identificadores das notas internas', exact=True).count() == 0
            record('Evidence is selected from own synthetic notes without typing identifiers or creating a note')
            page.get_by_role('button', name='Cancelar', exact=True).click()

            edit('email')
            page.get_by_label('Situação do item', exact=True).select_option('not_applicable')
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            expect(page.get_by_role('button', name='Confirmar marcação', exact=True)).not_to_be_visible()
            page.get_by_label('Motivo ou observação', exact=True).fill('Não solicitado neste cadastro sintético')
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            page.get_by_role('button', name='Confirmar marcação', exact=True).click()
            expect(page.locator('[data-checklist-status]')).to_contain_text('Marcação registrada')
            assert counts()['writes'] == 1
            expect(page.locator('[data-checklist-item]')).to_have_count(0)
            page.get_by_role('button', name='Atualizar checklist', exact=True).click()
            expect(page.locator('[data-checklist-progress]')).to_contain_text('1 de 3')
            record('Allowed exemption has a reason and only a fresh read updates the progress')

            reset('lost')
            edit('grupo'); fill_evidence()
            page.get_by_label('Motivo ou observação', exact=True).fill('Evidência sintética conferida')
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            page.get_by_role('button', name='Confirmar marcação', exact=True).click()
            expect(page.get_by_role('button', name='Conciliar marcação', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Atualizar checklist', exact=True)).to_be_disabled()
            first = counts()
            assert first['writes'] == 1 and len(first['attempts']) == 1
            page.get_by_role('button', name='Conciliar marcação', exact=True).click()
            expect(page.locator('[data-checklist-status]')).to_contain_text('Marcação registrada')
            second = counts()
            assert second['writes'] == 1 and len(second['attempts']) == 2
            assert second['attempts'][0] == second['attempts'][1]
            record('Lost acknowledgement reconciles the same key/body, without a second write')

            reset('conflict')
            edit('grupo'); fill_evidence()
            page.get_by_role('button', name='Revisar marcação', exact=True).click()
            page.get_by_role('button', name='Confirmar marcação', exact=True).click()
            expect(page.locator('[data-checklist-status]')).to_contain_text('Marcação recusada')
            assert counts()['writes'] == 0 and len(counts()['attempts']) == 1
            record('Revision conflict is explicit; there is no hidden retry or optimistic success')

            reset()
            edit('grupo')
            page.get_by_label('Motivo ou observação', exact=True).fill('PRIVATE_DRAFT_MARKER')
            page.evaluate("window.oldInputs = [...document.querySelectorAll('input, textarea, select')]")
            page.evaluate('window.panel.clear()')
            expect(page.locator('[data-checklist-item]')).to_have_count(0)
            expect(page.get_by_role('dialog')).not_to_be_visible()
            assert page.evaluate("window.oldInputs.every(e => e.value === '' && (!('checked' in e) || !e.checked))")
            assert 'PRIVATE_DRAFT_MARKER' not in page.content()
            assert page.evaluate('localStorage.length + sessionStorage.length') == 0
            record('Context cleanup clears visible and detached controls, without browser storage')

            reset('markup')
            assert page.locator('[data-checklist-item] img').count() == 0
            assert page.evaluate('window.injected === undefined')
            expect(page.locator('[data-checklist-item="grupo"]')).to_contain_text('<img')
            record('Source labels render only as text, never executable markup')

            reset()
            page.set_viewport_size({'width':390, 'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            edit('risco')
            assert page.evaluate("document.querySelector('dialog').getBoundingClientRect().width <= innerWidth")
            assert page.evaluate("document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth")
            record('390px viewport and confirmation dialog have no horizontal overflow')
            page.keyboard.press('Escape')
            output = os.environ.get('HELPDESK_CHECKLIST_SCREENSHOTS')
            if output:
                out = Path(output); out.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(out/'checklist-mobile.png'), full_page=True)
                page.set_viewport_size({'width':1440,'height':1100})
                page.screenshot(path=str(out/'checklist-desktop.png'), full_page=True)
                edit('risco'); fill_evidence()
                page.get_by_label('Reconheço o risco e conferi a execução', exact=True).check()
                page.get_by_role('button', name='Revisar marcação', exact=True).click()
                page.screenshot(path=str(out/'checklist-confirmation.png'), full_page=True)
            assert not errors
            record('Real browser completed the component journey without page errors')
            print(json.dumps({'checks':checks, 'scope':'owned-loopback-real-application-stack-synthetic-authority-and-sql'}, ensure_ascii=False))
        finally:
            browser.close()
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill(); process.wait(timeout=5)
