"""Candidate member UI against REAL local HTTP; Auth and storage are synthetic.
Own the server process and random loopback port. Never attach to a hosted target.
"""
import json
import os
from pathlib import Path
from queue import Queue, Empty
from threading import Thread
import shutil
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

checks = []
def record(name):
    checks.append({'check': name, 'result': 'passed'})

root = Path(__file__).resolve().parents[1]
env = {**os.environ, 'HELPDESK_OWNED_ADMIN_BROWSER': 'synthetic-loopback'}
process = subprocess.Popen(['node', '--experimental-strip-types', 'tests/admin-members-server.ts'], cwd=root, env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
try:
    ready = Queue()
    Thread(target=lambda: ready.put(process.stdout.readline()), daemon=True).start()
    try:
        line = ready.get(timeout=10)
    except Empty:
        raise RuntimeError('Owned member fixture did not become ready') from None
    if not line:
        raise RuntimeError('Owned member fixture exited before readiness')
    base = json.loads(line)['url']
    assert base.startswith('http://127.0.0.1:')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'), args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1280, 'height': 850})
        page.set_default_timeout(3000)
        errors = []
        page.on('pageerror', lambda _error: errors.append('pageerror'))
        def reset():
            page.request.post(base+'/_test/reset')
            page.goto(base, wait_until='networkidle')
            expect(page.get_by_role('button', name='Atualizar membros', exact=True)).to_be_visible()
            expect(page.locator('[data-admin-member]')).to_have_count(3)
        def agent_row():
            return page.locator('[data-admin-member="00000000-0000-4000-8000-000000000004"]')
        def counts():
            return page.request.get(base+'/_test/counts').json()
        try:
            reset()
            expect(page.get_by_role('heading', name='Membros da equipe')).to_be_visible()
            assert 'policyRef' not in page.locator('#members-root').inner_text()
            assert 'SYNTHETIC-POLICY' not in page.locator('#members-root').inner_text()
            record('List is rendered without exposing capability policy data')

            agent_row().get_by_role('button', name='Revogar', exact=True).click()
            expect(page.get_by_role('dialog')).to_be_visible()
            page.get_by_role('button', name='Cancelar', exact=True).click()
            assert counts()['writes'] == 0
            record('Opening and cancelling the confirmation does not submit a mutation')

            agent_row().get_by_role('button', name='Revogar', exact=True).click()
            page.get_by_label('Motivo da alteração', exact=True).fill('Revogação solicitada pela equipe')
            page.get_by_role('button', name='Confirmar alteração', exact=True).click()
            expect(agent_row()).to_contain_text('Revogado')
            assert counts() == {'writes': 1, 'audits': 1, 'receipts': 1}
            record('Explicit revocation uses HTTP and records one mutation, audit and receipt')

            reset()
            page.get_by_role('button', name='Convidar pessoa cadastrada', exact=True).click()
            page.get_by_label('Identificador da pessoa cadastrada', exact=True).fill('00000000-0000-4000-8000-000000000009')
            page.get_by_label('Validade em UTC', exact=True).fill('2026-10-10T12:00:00.123000Z')
            page.get_by_label('Motivo da alteração', exact=True).fill('Convite para a equipe de suporte')
            expect(page.get_by_role('dialog')).to_contain_text('Nenhum e-mail será enviado')
            page.get_by_role('button', name='Confirmar alteração', exact=True).click()
            expect(page.locator('[data-admin-member]')).to_have_count(4)
            expect(page.locator('[data-admin-member="00000000-0000-4000-8000-000000000009"]')).to_contain_text('Convite pendente')
            assert counts()['writes'] == 1
            record('Invitation targets an existing person and clearly remains pending without email')

            reset()
            page.request.post(base+'/_test/commit-loss')
            agent_row().get_by_role('button', name='Revogar', exact=True).click()
            page.get_by_label('Motivo da alteração', exact=True).fill('Confirmar situação após falha de conexão')
            page.get_by_role('button', name='Confirmar alteração', exact=True).click()
            expect(page.get_by_role('button', name='Conciliar solicitação', exact=True)).to_be_visible()
            assert counts()['writes'] == 1
            expect(page.get_by_role('button', name='Convidar pessoa cadastrada', exact=True)).to_be_disabled()
            page.get_by_role('button', name='Conciliar solicitação', exact=True).click()
            expect(agent_row()).to_contain_text('Revogado')
            assert counts() == {'writes': 1, 'audits': 1, 'receipts': 1}
            record('Lost confirmation blocks new intents and explicit reconciliation reuses the original key')

            reset()
            page.request.post(base+'/_test/remove-revoke-capability')
            page.get_by_role('button', name='Atualizar membros', exact=True).click()
            expect(agent_row().get_by_role('button', name='Revogar', exact=True)).to_have_count(0)
            record('Absent administrative capability removes the advisory action, without widening roles')

            reset()
            page.get_by_role('button', name='Transferir administração', exact=True).click()
            page.get_by_label('Administrador sucessor', exact=True).select_option('00000000-0000-4000-8000-000000000003')
            page.get_by_label('Motivo da alteração', exact=True).fill('Transferência explícita da responsabilidade')
            page.get_by_role('button', name='Confirmar alteração', exact=True).click()
            expect(page.locator('[data-admin-status]')).to_contain_text('Operação registrada')
            # The actor lost the required role in persistent membership; refresh is denied.
            expect(page.locator('[data-admin-member]')).to_have_count(0)
            assert counts()['writes'] == 1
            record('Succession changes the outgoing membership, then stale administrative rows are cleared')

            reset()
            agent_row().get_by_role('button', name='Revogar', exact=True).click()
            page.get_by_label('Motivo da alteração', exact=True).fill('Rascunho privado de administração')
            page.evaluate("window.memberPanel.setAudience({principalId:'00000000-0000-4000-8000-000000000080',workspaceId:'00000000-0000-4000-8000-000000000081'})")
            expect(page.locator('[data-admin-member]')).to_have_count(0)
            expect(page.get_by_role('dialog')).not_to_be_visible()
            assert 'Rascunho privado' not in page.locator('#members-root').inner_text()
            assert page.locator('[data-admin-reason]').input_value() == ''
            record('Audience change clears rows, dialog and private text without a mutation')

            reset()
            page.set_viewport_size({'width': 390, 'height': 844})
            expect(page.get_by_role('button', name='Atualizar membros', exact=True)).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            page.get_by_role('button', name='Convidar pessoa cadastrada', exact=True).focus()
            page.keyboard.press('Enter')
            expect(page.get_by_role('dialog')).to_be_visible()
            page.keyboard.press('Escape')
            expect(page.get_by_role('dialog')).not_to_be_visible()
            record('Mobile layout and keyboard confirmation/cancellation work')
            assert not errors
            record('No browser execution errors under the test CSP')
            print(json.dumps({'checks': checks}, ensure_ascii=False))
        finally:
            browser.close()
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
