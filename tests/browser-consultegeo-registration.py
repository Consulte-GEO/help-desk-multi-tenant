"""Owned loopback UI fixture. No external users, tickets, or emails."""
import json, os, shutil, subprocess, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from helpers.browser_auth_fixture import ROOT, WS, ACCOUNT, prepare

PRI='33333333-3333-4333-8333-333333333333'
CONNECTION='77777777-7777-4777-8777-777777777777'
INSTANCE='55555555-5555-4555-8555-555555555555'
REF={'connectionId':CONNECTION,'tenantId':'local','type':'work','id':'encanto'}
fixture="import {publishedCustomerFixture} from './tests/helpers/consultegeo-customer-fixture.ts';import {createRegistrationConfiguration} from './src/application/consultegeo-registration-operation.ts';import {projectConsulteGeoCustomerConfiguration} from './src/application/consultegeo-customer-configuration.ts';const f=await publishedCustomerFixture('user_access',d=>Object.assign(d,createRegistrationConfiguration(d.id,d.calendar)));console.log(JSON.stringify(projectConsulteGeoCustomerConfiguration(f.record)));"
configuration=json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',fixture],cwd=ROOT,text=True,encoding='utf-8'))
checks=[]
def record(name):
    checks.append({'check':name,'result':'passed'})
    print('Cadastro UI check: '+name,file=sys.stderr,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    for width in [1440,390]:
        context,page,errors,_=prepare(browser,advanced_access=False,consultegeo_intake=True)
        page.set_viewport_size({'width':width,'height':1100});page.set_default_timeout(7000)
        drafts=[]
        def api(route):
            req=route.request;path=urlparse(req.url).path;headers={}
            if path=='/v1/public-config':value={'supabase_url':'https://syntheticproject.supabase.co','publishable_key':'sb_publishable_localtest','consultegeo_intake':True}
            elif path=='/v1/workspaces':value={'items':[{'id':WS,'name':'Consulte GEO sintética'}]}
            elif path=='/v1/me':value={'id':PRI,'kind':'human','workspace_id':WS,'workspace_role':'admin','grants':[{'account_id':ACCOUNT,'role':'agent'}],'scopes':['tickets:read','tickets:write','notes:read','notes:write','contexts:resolve']}
            elif path=='/v1/consultegeo/contexts':value={'schema':1,'workspaceId':WS,'principalId':PRI,'contexts':[{'accountId':ACCOUNT,'accountName':'Cliente sintético','productInstanceId':INSTANCE,'connectionId':CONNECTION,'tenantId':'local','works':[{'id':'encanto','name':'Obra sintética Encanto','ref':REF}]}]}
            elif path=='/v1/consultegeo/request-catalog':
                assert req.post_data_json=={'service':'user_access','refs':[REF]}
                value={'schema':1,'context':{'workspaceId':WS,'principalId':PRI,'accountId':ACCOUNT,'refs':[REF],'coverageId':None},'configurations':[configuration]}
            elif path.startswith('/v1/form-drafts/') and req.method=='PUT':
                drafts.append(req.post_data_json);value={**req.post_data_json,'revision':len(drafts),'expiresAt':'2026-10-14T23:00:00.000000Z','status':'editing','ticketId':None};headers={'etag':'"'+str(len(drafts))+'"'}
            elif path=='/v1/tickets':value={'items':[],'next_cursor':None}
            else:route.fallback();return
            route.fulfill(status=200,content_type='application/json',headers=headers,body=json.dumps(value))
        page.route('**/v1/**',api)
        page.locator('#email').fill('synthetic@example.test');page.locator('#password').fill(' senha mantida ');page.locator('#submit-login').click();expect(page.locator('#app')).to_be_visible()
        page.locator('#new-ticket').click();dialog=page.locator('#cg-create-dialog');expect(dialog).to_be_visible()
        service=dialog.get_by_role('combobox',name='Tipo de atendimento',exact=True)
        expect(service.locator('option').nth(1)).to_have_text('Cadastros e acessos')
        record(str(width)+' Cadastro is the first service in Novo chamado')
        dialog.get_by_role('combobox',name='Cliente',exact=True).select_option(ACCOUNT);dialog.get_by_role('combobox',name='Obra',exact=True).select_option('encanto');service.select_option('user_access');dialog.get_by_role('button',name='Carregar formulário',exact=True).click()
        action=dialog.get_by_role('combobox',name='Ação desejada',exact=True);expect(action.locator('option').nth(1)).to_have_text('Novo cadastro');expect(action.locator('option').nth(5)).to_have_text('Liberar usuário em obra');action.select_option('0')
        kind=dialog.locator('[data-field="registration_kind"]')
        for category,field in [('user','person_name'),('mix','mix_fck'),('plant','plant_name'),('laboratory','laboratory_name'),('block','block_strength'),('ceramic','ceramic_name'),('cable','cable_diameter'),('supplier','supplier_document')]:
            kind.select_option(category);expect(dialog.locator('[data-field="'+field+'"]')).to_be_visible()
            record(str(width)+' '+category+' shows its required conditional fields')
        kind.select_option('user');dialog.locator('[data-field="person_name"]').fill('Pessoa sintética');dialog.locator('[data-field="person_email"]').fill('pessoa@example.invalid');dialog.locator('[data-field="requested_group"]').fill('Operador')
        kind.select_option('mix');expect(dialog.locator('[data-field="person_email"]')).to_have_count(0)
        dialog.locator('[data-field="mix_type"]').select_option('concrete');dialog.locator('[data-field="mix_aggregate"]').select_option('brita_1')
        for key,value in [('mix_fck','30'),('mix_slump','12'),('mix_tolerance','2'),('mix_supplier','Usina sintética'),('details','Solicitação sintética de traço')]:dialog.locator('[data-field="'+key+'"]').fill(value)
        dialog.get_by_role('textbox',name='Descrição',exact=True).fill('Solicitação sintética para a obra selecionada')
        dialog.get_by_role('button',name='Salvar rascunho',exact=True).click()
        expect(dialog.get_by_role('button',name='Revisar solicitação',exact=True)).to_be_enabled()
        assert len(drafts)==1 and drafts[0]['answers']['mix_fck']=='30' and drafts[0]['answers']['registration_kind']=='mix'
        assert all(key not in drafts[0]['answers'] for key in ['person_name','person_email','requested_group'])
        record(str(width)+' category switching scrubs hidden user data before draft persistence')
        assert not errors, errors
        context.close()
    browser.close()
print(json.dumps({'checks':checks,'business_mutations_dispatched':0,'native_opening_tested_here':False},ensure_ascii=False))
