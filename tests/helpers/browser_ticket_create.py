"""Lost creation receipts: real loopback API, browser transport faults only."""
import json, re
from playwright.sync_api import expect

def ticket_button(page, subject):
    return page.get_by_role('button', name=re.compile(r'^Abrir chamado: ' + re.escape(subject) + r' · identificador .+$'))

def begin_details(page):
    expect(page.locator('#hd-opening-next')).to_be_enabled()
    page.locator('#hd-opening-next').click()
    expect(page.locator('#hd-opening-step-2')).to_be_visible()

def review_draft(page):
    page.locator('#hd-opening-next').click()
    expect(page.locator('#hd-opening-step-3')).to_be_visible()
    expect(page.locator('#submit-create')).to_be_visible()


def verify_pre_dispatch_validation(page, record):
    page.locator('#profile').select_option('laboratory')
    expect(page.locator('#identity-name')).to_have_text('Portal do cliente')
    page.locator('#new-ticket').click()
    expect(page.locator('#submit-create')).to_be_enabled()
    begin_details(page)
    page.locator('#subject').fill('  a ')
    page.locator('#description').fill('   ')
    page.locator('#hd-opening-next').click()
    expect(page.locator('#hd-opening-errors')).to_be_visible()
    expect(page.locator('#subject')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('#description')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('#subject')).to_be_enabled()
    expect(page.locator('#description')).to_be_enabled()
    expect(page.locator('#submit-create')).to_have_text('Validar e abrir chamado')
    page.locator('#subject').fill('Rascunho corrigido antes do envio')
    page.locator('#description').fill('O erro de preenchimento não pode travar o pedido.')
    review_draft(page)
    page.locator('#submit-create').click()
    expect(page.locator('#create-dialog')).not_to_be_visible()
    expect(page.locator('#ticket-title')).to_have_text('Rascunho corrigido antes do envio')
    record('Trim-invalid draft remains editable and can be corrected before creation dispatch')

def verify_confirmation_read_failure(page, record):
    page.locator('#profile').select_option('laboratory')
    expect(page.locator('#identity-name')).to_have_text('Portal do cliente')
    page.locator('#new-ticket').click()
    expect(page.locator('#submit-create')).to_be_enabled()
    begin_details(page)
    subject = 'Chamado confirmado antes de falhar a leitura'
    page.locator('#subject').fill(subject)
    page.locator('#description').fill('A leitura falhou depois da confirmação da gravação.')
    def list_failure(route):
        route.fulfill(status=503, content_type='application/problem+json', json={'code':'unavailable','detail':'Leitura de chamados indisponível.'})
    page.route('**/v1/tickets?*', list_failure)
    review_draft(page)
    page.locator('#submit-create').click()
    expect(page.locator('#create-dialog')).not_to_be_visible()
    expect(page.locator('#notification')).to_contain_text('Leitura de chamados indisponível.')
    page.unroute('**/v1/tickets?*', list_failure)
    page.locator('#refresh').click()
    expect(ticket_button(page, subject)).to_have_count(1)
    page.locator('#new-ticket').click()
    expect(page.locator('#submit-create')).to_have_text('Validar e abrir chamado')
    expect(page.locator('#subject')).to_have_value('')
    page.locator('#cancel-create').click()
    record('Read failure after confirmed creation is reported without reopening unknown or duplicating the ticket')

def verify_create_recovery(page, record):
    page.locator('#profile').select_option('laboratory')
    expect(page.locator('#identity-name')).to_have_text('Portal do cliente')
    for scenario in ['expired', 'ambiguous']:
        page.locator('#new-ticket').click()
        expect(page.locator('#submit-create')).to_be_enabled()
        begin_details(page)
        subject = 'Recuperação de abertura ' + scenario
        page.locator('#subject').fill(subject)
        page.locator('#description').fill('Pedido fictício com confirmação perdida.')
        requests, receipts, resolutions = [], [], []
        def resolve(route):
            resolutions.append(route.request.post_data)
            response = route.fetch()
            body = response.json()
            if receipts:
                body['status'] = 'no_coverage' if scenario == 'expired' else 'resolved'
                if scenario == 'expired': body['candidates'] = []
            elif scenario == 'ambiguous':
                body['status'] = 'ambiguous'
                body['candidates'].append({**body['candidates'][0], 'coverage_id': 'coverage-other'})
            route.fulfill(response=response, json=body)
        def create(route):
            requests.append((route.request.headers['idempotency-key'], route.request.post_data))
            response = route.fetch()
            assert response.status in [200, 201], response.text()
            receipts.append(response.json())
            if len(receipts) == 1: route.abort('failed')
            else: route.fulfill(response=response)
        page.route('**/v1/contexts/resolve', resolve)
        page.route('**/v1/tickets', create)
        review_draft(page)
        page.locator('#submit-create').click()
        if scenario == 'ambiguous':
            expect(page.locator('#coverage-label')).to_be_visible()
            page.locator('#coverage-choice').select_option('coverage-lab')
            page.locator('#submit-create').click()
        expect(page.locator('#notification')).to_contain_text('A abertura não foi confirmada.')
        assert len(receipts) == 1
        resolution_count = len(resolutions)
        expect(page.locator('#subject')).to_be_disabled()
        expect(page.locator('#context-choice')).to_be_disabled()
        page.locator('#cancel-create').click()
        page.locator('#new-ticket').click()
        expect(page.locator('#subject')).to_have_value(subject)
        expect(page.locator('#submit-create')).to_have_text('Recuperar abertura')
        page.locator('#submit-create').click()
        expect(page.locator('#create-dialog')).not_to_be_visible()
        expect(page.locator('#ticket-title')).to_have_text(subject)
        assert len(requests) == 2 and requests[0] == requests[1], requests
        assert len(resolutions) == resolution_count, 'Retry must reach replay without resolving again'
        assert receipts[0] == receipts[1]
        if scenario == 'ambiguous': assert json.loads(requests[1][1])['coverage_id'] == 'coverage-lab'
        page.unroute('**/v1/contexts/resolve', resolve)
        page.unroute('**/v1/tickets', create)
        record('Lost creation receipt recovers original key/payload without new resolution: ' + scenario)
        record('Closing/reopening preserves unresolved creation and prevents editing: ' + scenario)
    page.locator('#new-ticket').click()
    expect(page.locator('#submit-create')).to_be_enabled()
    begin_details(page)
    page.locator('#subject').fill('Recibo incompatível na abertura')
    page.locator('#description').fill('Teste fictício de recibo e isolamento de sessão.')
    def invalid_receipt(route):
        response = route.fetch()
        assert response.status == 201
        route.fulfill(response=response, json={})
    page.route('**/v1/tickets', invalid_receipt)
    review_draft(page)
    page.locator('#submit-create').click()
    expect(page.locator('#create-help')).to_contain_text('confirmação')
    expect(page.locator('#notification')).to_contain_text('Resposta incompatível')
    expect(page.locator('#submit-create')).to_have_text('Recuperar abertura')
    expect(page.locator('#create-dialog')).to_be_visible()
    record('Malformed creation receipt never confirms or unlocks a new creation')
    page.unroute('**/v1/tickets', invalid_receipt)
    page.locator('#cancel-create').click()
    page.locator('#profile').select_option('school')
    expect(page.locator('#ticket-list')).to_contain_text('boletins')
    page.locator('#new-ticket').click()
    expect(page.locator('#subject')).to_have_value('')
    expect(page.locator('#submit-create')).to_have_text('Validar e abrir chamado')
    expect(page.locator('#context-choice')).not_to_contain_text('Laboratório Horizonte')
    page.locator('#cancel-create').click()
    record('Changing session clears unresolved creation without exposing the previous account draft')
