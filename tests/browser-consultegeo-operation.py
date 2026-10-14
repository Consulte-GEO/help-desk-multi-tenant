"""Real authenticated shell and production controllers; bounded synthetic API/Auth.
Owned loopback demo is started by test-ui-local. No external records or emails.
Native PostgreSQL and checklist application proof remain separate required suites.
"""
import json, os, shutil, subprocess, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from helpers.browser_auth_fixture import ROOT, WS, ACCOUNT, TICKET, prepare

PRI='33333333-3333-4333-8333-333333333333'
CONNECTION='77777777-7777-4777-8777-777777777777'
INSTANCE='55555555-5555-4555-8555-555555555555'
COVERAGE='88888888-8888-4888-8888-888888888888'
CONTRACT='99999999-9999-4999-8999-999999999999'
EVENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
FIXTURE='import {publishedCustomerFixture} from "./tests/helpers/consultegeo-customer-fixture.ts";import {projectConsulteGeoCustomerConfiguration} from "./src/application/consultegeo-customer-configuration.ts";const f=await publishedCustomerFixture("questions");console.log(JSON.stringify(projectConsulteGeoCustomerConfiguration(f.record)));'
configuration=json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',FIXTURE],cwd=ROOT,text=True,encoding='utf-8'))
FORM=configuration['entries'][0]['form']
PROFILE='cg-wf-'+FORM['id']+'-v'+str(FORM['version'])
REF={'connectionId':CONNECTION,'tenantId':'local','type':'work','id':'encanto'}
checks=[]
def record(name):
    checks.append({'check':name,'result':'passed'})
    print('Operational UI check: '+name,file=sys.stderr,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    for width in [1440,390]:
        context,page,errors,_=prepare(browser,advanced_access=False)
        page.set_viewport_size({'width':width,'height':1100});page.set_default_timeout(7000)
        state={'created':False,'draft':None,'opening':[],'workflow':[],'opening_lost':True,'workflow_lost':True,'workflow_receipts':{},'messages':[]}
        ticket={'id':TICKET,'account_id':ACCOUNT,'product_instance_id':INSTANCE,'service_code':'questions','subject':'Dúvida sintética da obra','description':'Dados locais de ensaio; nenhum registro externo.','status':'received','internal_status':'new','priority':'normal','version':1,'coverage_id':COVERAGE,'contract_version_id':CONTRACT,'created_at':'2026-10-14T12:00:00.000000Z','updated_at':'2026-10-14T12:00:00.000000Z','assignment':{'state':'unassigned','can_claim':True,'can_release':False},'consultegeo':{'protocol':'CG-10001','profileVersionId':PROFILE,'workflow':True,'requesterId':PRI}}
        def api(route):
            req=route.request;path=urlparse(req.url).path;headers={};status=200
            if path=='/v1/public-config':value={'supabase_url':'https://syntheticproject.supabase.co','publishable_key':'sb_publishable_localtest','operational':True}
            elif path=='/v1/workspaces':value={'items':[{'id':WS,'name':'Consulte GEO sintética'}]}
            elif path=='/v1/me':value={'id':PRI,'kind':'human','workspace_id':WS,'workspace_role':'admin','grants':[{'account_id':ACCOUNT,'role':'agent'}],'scopes':['tickets:read','tickets:write','notes:read','notes:write','contexts:resolve']}
            elif path=='/v1/consultegeo/contexts':value={'schema':1,'workspaceId':WS,'principalId':PRI,'contexts':[{'accountId':ACCOUNT,'accountName':'Cliente sintético','productInstanceId':INSTANCE,'connectionId':CONNECTION,'tenantId':'local','works':[{'id':'encanto','name':'Obra sintética Encanto','ref':REF}]}]}
            elif path=='/v1/consultegeo/request-catalog':
                assert req.post_data_json=={'service':'questions','refs':[REF]}
                value={'schema':1,'context':{'workspaceId':WS,'principalId':PRI,'accountId':ACCOUNT,'refs':[REF],'coverageId':None},'configurations':[configuration]}
            elif path.startswith('/v1/form-drafts/') and req.method=='PUT':
                state['draft']=req.post_data_json;value={**state['draft'],'revision':1,'expiresAt':'2026-10-14T18:00:00.000000Z','status':'editing','ticketId':None};headers={'etag':'"1"'}
            elif path=='/v1/support-requests/preview':
                b=req.post_data_json;value={'valid':True,'commitAuthorized':False,'draftId':b['draftId'],'draftRevision':b['expectedDraftRevision'],'previewHash':'a'*64,'subject':b['subject'],'priority':'normal','clocks':{},'attachmentCount':0}
            elif path=='/v1/support-requests':
                state['opening'].append({'body':req.post_data,'key':req.headers['idempotency-key'],'version':req.headers['if-match']});state['created']=True
                if state['opening_lost']:state['opening_lost']=False;route.abort('failed');return
                value={'ticketId':TICKET,'protocol':'CG-10001','sequence':'10001','workspaceId':WS,'accountId':ACCOUNT,'actorId':PRI,'requesterId':PRI,'draftId':state['draft']['id'],'draftRevision':1,'version':1,'profileVersionId':PROFILE,'formId':FORM['id'],'formVersion':FORM['version'],'priority':'normal','createdAt':ticket['created_at'],'notification':'pending','replayed':True};headers={'etag':'"1"','idempotency-replayed':'true','location':'/v1/tickets/'+TICKET}
            elif path=='/v1/tickets':value={'items':[ticket] if state['created'] else [],'next_cursor':None}
            elif path=='/v1/tickets/'+TICKET:
                value={**ticket,'available_actions':{'ticket_id':TICKET,'version':ticket['version'],'reply':True,'read_notes':True,'add_note':True,'change_priority':True,'claim':False,'release':False,'transitions':[]}}
            elif path=='/v1/tickets/'+TICKET+'/workflow-commands':
                b=req.post_data_json;key=req.headers['idempotency-key'];state['workflow'].append({'body':req.post_data,'key':key,'version':req.headers['if-match']})
                replayed=key in state['workflow_receipts']
                if replayed:value={**state['workflow_receipts'][key],'replayed':True}
                else:
                    assert req.headers['if-match']=='"'+str(ticket['version'])+'"';ticket['version']+=1
                    if b['action']=='start':ticket['internal_status']='open';ticket['status']='in_progress'
                    elif b['action']=='transfer':assert b['targetPrincipalId']==PRI;ticket['assignment']={'state':'mine','can_claim':False,'can_release':True}
                    elif b['action']=='reply':state['messages'].append({'id':EVENT,'ticket_id':TICKET,'body':b['body'],'actor_type':'human_agent','created_at':ticket['updated_at']})
                    value={'ticketId':TICKET,'workspaceId':WS,'accountId':ACCOUNT,'actorId':PRI,'profileVersionId':PROFILE,'version':ticket['version'],'status':ticket['internal_status'],'eventId':EVENT,'replayed':False};state['workflow_receipts'][key]=value
                if b['action']=='start' and state['workflow_lost']:state['workflow_lost']=False;route.abort('failed');return
                headers={'etag':'"'+str(value['version'])+'"','idempotency-replayed':str(value['replayed']).lower()}
            elif path.endswith('/messages'):value={'items':state['messages'],'next_cursor':None}
            elif path.endswith('/notes') or path.endswith('/timeline'):value={'items':[],'next_cursor':None}
            elif '/execution-checklist' in path:status=503;value={'status':503,'code':'checklist_store_unavailable'}
            else:status=404;value={'status':404,'code':'not_found'}
            route.fulfill(status=status,content_type='application/json',headers=headers,body=json.dumps(value))
        page.route('**/v1/**',api)
        page.locator('#email').fill('synthetic@example.test');page.locator('#password').fill(' senha mantida ');page.locator('#submit-login').click();expect(page.locator('#app')).to_be_visible()
        page.locator('#new-ticket').click();dialog=page.locator('#cg-create-dialog');expect(dialog).to_be_visible()
        for label in ['Cliente','Obra','Tipo de atendimento']:expect(dialog.get_by_role('combobox',name=label,exact=True)).to_have_value('')
        assert not state['opening'] and state['draft'] is None;record(str(width)+' current human session discovers explicit customer work and service without creating a draft')
        dialog.get_by_role('combobox',name='Cliente',exact=True).select_option(ACCOUNT);dialog.get_by_role('combobox',name='Obra',exact=True).select_option('encanto');dialog.get_by_role('combobox',name='Tipo de atendimento',exact=True).select_option('questions');dialog.get_by_role('button',name='Carregar formulário',exact=True).click();dialog.get_by_role('combobox',name='Ação desejada',exact=True).select_option('0')
        dialog.get_by_role('textbox',name='Descrição e informações para atendimento').fill('Ensaio operacional sintético')
        dialog.get_by_role('textbox',name='Descrição',exact=True).fill('Dúvida sintética sobre o atendimento')
        dialog.get_by_role('button',name='Salvar rascunho',exact=True).click();dialog.get_by_role('button',name='Revisar solicitação',exact=True).click();expect(dialog.get_by_role('button',name='Confirmar abertura',exact=True)).to_be_enabled();assert not state['created'];screens=ROOT/'evidence'/'consultegeo-operation';screens.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(screens/('opening-'+str(width)+'.png')),full_page=True);record(str(width)+' published form draft and advisory preview require explicit final confirmation')
        dialog.get_by_role('button',name='Confirmar abertura',exact=True).click();expect(dialog.get_by_role('button',name='Conciliar mesma intenção',exact=True)).to_be_enabled();expect(dialog.get_by_role('combobox',name='Cliente',exact=True)).to_be_disabled();dialog.locator('#cg-close-create').click();expect(dialog).to_be_visible();assert state['created'];record(str(width)+' lost opening commit blocks context switching and dialog closing')
        dialog.get_by_role('button',name='Conciliar mesma intenção',exact=True).click();expect(dialog).to_be_hidden();expect(page.locator('#ticket-number')).to_contain_text('CG-10001');assert state['opening'][0]==state['opening'][1];record(str(width)+' same opening bytes key and version reconcile genuine protocol before shell navigation')
        panel=page.locator('#cg-workflow');expect(panel).to_be_visible();expect(page.locator('#transition-area')).to_be_hidden();expect(page.locator('#assignment-form')).to_be_hidden();expect(page.locator('#priority-form')).to_be_hidden();expect(page.locator('#public-tab')).to_be_hidden();expect(page.locator('#composer-label')).to_have_text('Escreva uma nota interna');record(str(width)+' structured workflow replaces incompatible generic public mutations and preserves private notes')
        panel.get_by_role('combobox',name='Ação de atendimento',exact=True).select_option('start');panel.get_by_role('button',name='Revisar ação',exact=True).click();assert not state['workflow'];panel.get_by_role('button',name='Confirmar ação',exact=True).click();expect(panel.get_by_role('button',name='Conciliar atendimento',exact=True)).to_be_visible();expect(panel.get_by_role('combobox',name='Ação de atendimento',exact=True)).to_be_disabled();
        if width==390:page.locator('#hd-back-to-tickets').click()
        page.locator('#new-ticket').click();expect(dialog).to_be_hidden();page.locator('#refresh').click()
        if width==390:page.locator('[data-ticket-id="'+TICKET+'"]').click()
        expect(panel.get_by_role('button',name='Conciliar atendimento',exact=True)).to_be_visible();expect(page.locator('#send-message')).to_be_disabled();record(str(width)+' unknown workflow prevents new creation and refresh; mobile list return preserves reconciliation')
        panel.get_by_role('button',name='Conciliar atendimento',exact=True).click();expect(page.locator('#ticket-number')).to_contain_text('VERSÃO 2');assert state['workflow'][0]==state['workflow'][1];record(str(width)+' explicit workflow reconciliation reuses the exact version key and body once')
        panel.get_by_role('combobox',name='Ação de atendimento',exact=True).select_option('transfer');panel.get_by_role('textbox',name='Motivo da ação',exact=True).fill('Assumir atendimento sintético');panel.get_by_role('button',name='Revisar ação',exact=True).click();panel.get_by_role('button',name='Confirmar ação',exact=True).click();expect(page.locator('#ticket-number')).to_contain_text('VERSÃO 3');assert json.loads(state['workflow'][-1]['body'])['targetPrincipalId']==PRI;record(str(width)+' operator claim targets the current authenticated principal only')
        panel.get_by_role('combobox',name='Ação de atendimento',exact=True).select_option('reply');panel.get_by_role('textbox',name='Resposta pública',exact=True).fill('Texto <img src=x onerror="window.injected=true">');panel.get_by_role('button',name='Revisar ação',exact=True).click();panel.get_by_role('button',name='Confirmar ação',exact=True).click();expect(page.locator('#ticket-number')).to_contain_text('VERSÃO 4');assert page.evaluate('window.injected') is None;record(str(width)+' public response is safely rendered through the structured versioned command')
        assert page.evaluate('localStorage.length+sessionStorage.length')==0;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;page.screenshot(path=str(ROOT/'evidence'/'consultegeo-operation'/('workflow-'+str(width)+'.png')),full_page=True);record(str(width)+' no persistent credentials or horizontal overflow in the authenticated shell')
        page.locator('#logout-mobile' if width==390 else '#logout').click();expect(page.locator('#login-screen')).to_be_visible();assert 'CG-10001' not in page.locator('#cg-workflow').inner_text();assert page.locator('#cg-create-root').inner_text()=='';assert not errors,errors;record(str(width)+' logout scrubs operational forms workflow and ticket metadata')
        context.close()
    browser.close()
result={'fixture':'owned_loopback_native_human_session_synthetic_api','checks':checks}
out=ROOT/'evidence'/'consultegeo-operation'/'browser.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
