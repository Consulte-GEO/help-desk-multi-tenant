"""Focused, observable notes recovery in the existing owned loopback demo.

Synthetic in-memory data only. Does not prove hosted Auth, PostgreSQL or resolve
historical CI timing failures merely by succeeding once.
"""
import json
import os
import shutil
import re
from playwright.sync_api import sync_playwright, expect

checks = []

def record(name):
    checks.append({'check': name, 'result': 'passed'})

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),
        args=['--no-sandbox'],
    )
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda _error: errors.append('pageerror'))
    unavailable = True
    note_requests = []
    pattern = re.compile(r'.*/v1/tickets/[^/]+/notes\?limit=50$')

    def notes_response(route):
        note_requests.append(route.request.method)
        if unavailable:
            route.fulfill(status=503, content_type='application/problem+json',
                          body='{"code":"unavailable","detail":"Synthetic notes outage"}')
        else:
            route.continue_()

    def is_notes_response(response):
        return response.request.method == 'GET' and pattern.fullmatch(response.url) is not None

    try:
        page.goto('http://127.0.0.1:4317/', wait_until='domcontentloaded')
        page.get_by_role('button', name='Explorar demonstração', exact=True).click()
        expect(page.locator('#note-tab')).to_be_visible()
        expect(page.locator('#messages')).to_contain_text('Olá! Recebemos a solicitação')
        page.locator('#note-tab').click()
        private_draft = 'Rascunho privado sintético: nunca publicar automaticamente.'
        page.locator('#message-body').fill(private_draft)
        page.route(pattern, notes_response)

        with page.expect_response(is_notes_response) as observed:
            page.locator('#refresh').click()
        assert observed.value.status == 503
        expect(page.locator('#notes-status')).to_contain_text('Notas indisponíveis')
        expect(page.locator('#notes')).to_have_text('')
        expect(page.locator('#note-tab')).to_be_hidden()
        expect(page.locator('#public-tab')).to_be_visible()
        expect(page.locator('#message-body')).not_to_have_value(private_draft)
        record('Notes outage removes private content and never adopts the internal draft as a public reply')

        expect(page.locator('#notes-retry')).to_be_visible()
        expect(page.locator('#notes-section')).to_have_attribute('open', '')
        record('Notes failure exposes a visible recovery action inside an open section')

        # Keep the interceptor installed. Change its explicit state only after the
        # previous observed response has been reflected in the DOM.
        with page.expect_response(is_notes_response) as observed:
            page.locator('#notes-retry').click()
        assert observed.value.status == 503
        expect(page.locator('#notes-status')).to_contain_text('Notas indisponíveis')
        expect(page.locator('#notes-retry')).to_be_visible()
        expect(page.locator('#messages')).to_contain_text('Olá! Recebemos a solicitação')
        record('A second explicit failed recovery preserves the public conversation and retry action')

        unavailable = False
        with page.expect_response(is_notes_response) as observed:
            page.locator('#notes-retry').click()
        assert observed.value.status == 200
        expect(page.locator('#note-tab')).to_be_visible()
        expect(page.locator('#notes-retry')).to_be_hidden()
        expect(page.locator('#notes-status')).to_have_text('')
        page.locator('#note-tab').click()
        expect(page.locator('#message-body')).to_have_value(private_draft)
        record('Successful explicit recovery restores only the separate internal draft')

        # The normal profile-change implementation, not DOM injection, changes audience.
        page.locator('#profile').select_option('laboratory')
        expect(page.locator('#stat-total')).to_have_text('1')
        expect(page.locator('#ticket-title')).to_have_text('Relatório de ensaio não foi concluído')
        expect(page.locator('#notes-section')).to_be_hidden()
        expect(page.locator('#notes')).to_have_text('')
        expect(page.locator('#note-tab')).to_be_hidden()
        expect(page.locator('#message-body')).not_to_have_value(private_draft)
        record('Changing to the client audience removes notes and the private draft')
        assert note_requests == ['GET', 'GET', 'GET']
        assert not errors
        record('The three explicit attempts produce only three note reads and no browser errors')
        print(json.dumps({'checks': checks}, ensure_ascii=False))
    except Exception:
        # Closed-schema diagnostic only: no note text, request URL, user ID or credentials.
        diagnostic = page.evaluate('''() => ({
          retryHidden: document.getElementById('notes-retry').hidden,
          notesHidden: document.getElementById('notes-section').hidden,
          notesOpen: document.getElementById('notes-section').open,
          detailHidden: document.getElementById('ticket-detail').hidden,
          appHidden: document.getElementById('app').hidden
        })''')
        print(json.dumps({'checks': checks, 'failed': True, 'ui_state': diagnostic,
                          'note_read_count': len(note_requests)}, ensure_ascii=False))
        raise
    finally:
        browser.close()
