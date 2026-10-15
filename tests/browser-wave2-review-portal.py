"""Owned Chromium component, real UI modules, synthetic HTTPS API only.
Does not attach to any user browser, authenticate a real person or send email.
"""
import json, mimetypes, os, shutil, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
BASE='https://review.owned.invalid'
checks=[]
SCRIPT=r'''
import {mountOperationalReview} from '/consultegeo-review.js';
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),mode=new URL(location.href).searchParams.get('mode');
const identity={workspaceId:uid(1),principalId:uid(2)},ticket={id:uid(3),account_id:uid(4),version:mode.startsWith('revision')?2:1},formId=uid(5),invitationId=uid(6),ref={connectionId:uid(7),tenantId:'owned',type:'work',id:'encanto'};
const v={schema:1,context:{...identity,accountId:ticket.account_id,ticketId:ticket.id,version:ticket.version,formRevision:1,invitationId:mode==='approval'?invitationId:null},protocol:'CG-10002',status:mode.startsWith('revision')?'waiting_customer':'triage',approval:'pending',form:{definition:{id:formId,version:2,status:'published',title:'Informações da solicitação',fields:[{key:'details',label:'Detalhes da solicitação',type:'text',public:true,required:true,config:{maxLength:2000}}]},formId,formVersion:2,schemaHash:'a'.repeat(64),answers:{details:'Informação original <img src=x onerror=private>'},refs:[ref]},capabilities:{requestApproval:mode==='request',decideApproval:mode==='approval',reviseForm:mode.startsWith('revision')},decision:mode.startsWith('revision')?{decision:'reject',version:2,formRevision:1,at:'2026-10-15T00:00:00.000000Z',reason:'Corrigir o detalhe <img src=x onerror=private>'}:null};
window.fixture={calls:[],commits:0,confirmed:0,draft:null,receipts:{},lostSave:true,lostCommit:true,lostInvitation:true};const f=window.fixture;
const json=(value,status=200,headers={})=>Response.json(value,{status,headers});
async function request(path,init={}){
 const method=init.method??'GET',body=init.body?JSON.parse(init.body):null,headers=new Headers(init.headers),key=headers.get('idempotency-key');f.calls.push({path,method,body,key});
 if(path.endsWith('/review-context'))return json(v);
 if(path.endsWith('/notification-attention'))return json({ticketId:ticket.id,workspaceId:identity.workspaceId,accountId:ticket.account_id,limit:20,resendAvailable:false,items:[{id:uid(20),kind:'support.approval_requested',state:'accepted',attempts:1,attention:false,updatedAt:'2026-10-15T00:00:00.000000Z',nextAttemptAt:null,reason:null},{id:uid(21),kind:'support.created',state:'unknown',attempts:1,attention:true,updatedAt:'2026-10-15T00:00:00.000000Z',nextAttemptAt:null,reason:'send_unknown'}]});
 if(path.includes('/form-drafts/')){
  if(method==='GET')return f.draft?json(f.draft):json({code:'draft_not_found'},404);
  if(f.lostSave&&mode==='revision_absent'){f.lostSave=false;return json({code:'owned_before_write'},503);}
  f.draft={...body,revision:Number(headers.get('if-match').replaceAll('"',''))+1,expiresAt:'2099-10-16T00:00:00.000000Z',status:'editing',ticketId:null};
  if(f.lostSave){f.lostSave=false;return json({code:'owned_unknown'},503);}return json(f.draft,200,{etag:'"'+f.draft.revision+'"'});
 }
 if(path.endsWith('/form-preview'))return json({ticketId:ticket.id,version:2,formRevision:1,previewHash:'b'.repeat(64),publicDiff:[{path:'details',beforePresent:true,afterPresent:true,before:v.form.answers.details,after:f.draft.answers.details}],commitAuthorized:false});
 if(path.endsWith('/approval-challenge'))return json({ticketId:ticket.id,invitationId,ticketVersion:1,formRevision:1,token:'hd_approval_'+'a'.repeat(43),generation:1,expiresAt:'2099-10-16T00:00:00.000000Z',decisionApplied:false});
 if(path.endsWith('/approval-invitations')){if(!f.receipts[key]){f.commits++;f.receipts[key]={ticketId:ticket.id,workspaceId:identity.workspaceId,accountId:ticket.account_id,actorId:identity.principalId,invitationId,ticketVersion:1,formRevision:1,notification:'pending',replayed:false};}if(f.lostInvitation){f.lostInvitation=false;return json({code:'owned_unknown'},503);}return json({...f.receipts[key],replayed:true},202);}
 if(path.endsWith('/approval-decisions')||path.endsWith('/form-revisions')){if(!f.receipts[key]){f.commits++;f.receipts[key]={ticketId:ticket.id,version:ticket.version+1,formRevision:mode.startsWith('revision')?2:1,notification:'pending'};}if(f.lostCommit){f.lostCommit=false;return json({code:'owned_unknown'},503);}return json(f.receipts[key]);}
 throw Error('Unexpected owned request: '+path);
}
window.panel=mountOperationalReview(document.querySelector('#fixture'),{identity,ticket,origin:location.origin,request,canReadAttention:mode==='request',onConfirmed:()=>{f.confirmed++;document.documentElement.dataset.confirmed=String(f.confirmed);}});
await window.panel.load();document.documentElement.dataset.reviewReady='true';
'''
HTML='''<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fixture.css"><title>Revisão · fixture sintética</title></head><body><main id="fixture"></main><script type="module" src="/fixture.js"></script></body></html>'''
def record(name):
 checks.append({'check':name,'result':'passed'});print('Review UI check: '+name,file=sys.stderr,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
 for width in [1440,360]:
  for mode in ['request','approval','revision','revision_absent']:
   context=browser.new_context(viewport={'width':width,'height':1100});page=context.new_page();page.set_default_timeout(7000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def route_owned(route):
    parsed=urlparse(route.request.url)
    if parsed.scheme+'://'+parsed.netloc!=BASE:route.abort();return
    path=parsed.path
    if path=='/':route.fulfill(status=200,content_type='text/html',body=HTML,headers={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'"});return
    if path=='/fixture.js':route.fulfill(status=200,content_type='application/javascript',body=SCRIPT);return
    if path=='/fixture.css':route.fulfill(status=200,content_type='text/css',body='body{display:block;margin:0;padding:16px}#fixture{max-width:900px;margin:0 auto;min-width:0}');return
    base=ROOT/'shared' if path.startswith('/shared/') else ROOT/'web';relative=path[8:] if path.startswith('/shared/') else path.lstrip('/');file=(base/relative).resolve()
    if not file.is_relative_to(base.resolve()) or not file.is_file():route.fulfill(status=404,body='');return
    route.fulfill(status=200,content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream',body=file.read_bytes())
   context.route('**/*',route_owned);page.goto(BASE+'/?mode='+mode);expect(page.locator('html')).to_have_attribute('data-review-ready','true')
   assert page.evaluate('fixture.calls.every(c=>c.method==="GET")');record(f'{width} {mode} opening performs only authenticated projection reads')
   if mode=='request':
    page.get_by_role('button',name='Solicitar aprovação',exact=True).click();expect(page.get_by_role('button',name='Conferir mesma solicitação')).to_be_visible();assert page.evaluate('panel.blocked()');page.get_by_role('button',name='Conferir mesma solicitação').click();expect(page.locator('html')).to_have_attribute('data-confirmed','1');assert page.evaluate('fixture.commits')==1
    writes=page.evaluate('fixture.calls.filter(c=>c.method==="POST")');assert len(writes)==2 and writes[0]['key']==writes[1]['key'] and writes[0]['body']==writes[1]['body'];record(f'{width} explicit invitation reconciles same intent once')
    page.get_by_role('button',name='Consultar estado dos e-mails').click();expect(page.locator('#fixture')).to_contain_text('Aceita pelo provedor');expect(page.locator('#fixture')).to_contain_text('Resultado desconhecido');assert page.get_by_role('button',name='Reenviar',exact=False).count()==0;assert 'Entrega confirmada' not in page.locator('#fixture').inner_text();record(f'{width} independent attention has no resend or false delivery confirmation')
   elif mode=='approval':
    page.get_by_role('button',name='Conferir convite',exact=True).click();decision=page.get_by_label('Sua decisão',exact=True);expect(decision).to_be_visible();decision.select_option('reject');page.get_by_label('Justificativa da decisão',exact=True).fill('Corrigir informações <img src=x onerror=private>');page.get_by_role('button',name='Revisar decisão',exact=True).click();page.get_by_role('button',name='Confirmar solicitação de correção',exact=True).click();expect(page.get_by_role('button',name='Conciliar mesma decisão')).to_be_visible();assert page.evaluate('panel.blocked()');page.get_by_role('button',name='Conciliar mesma decisão').click();expect(page.locator('html')).to_have_attribute('data-confirmed','1');assert page.evaluate('fixture.commits')==1;record(f'{width} explicit approval challenge review and lost-ACK reconciliation')
   else:
    expect(page.locator('#fixture')).to_contain_text('Corrigir o detalhe <img src=x onerror=private>');page.get_by_label('Detalhes da solicitação',exact=True).fill('Informações corrigidas <img src=x onerror=private>');page.get_by_label('Comentário da correção',exact=True).fill('Detalhe corrigido');page.get_by_role('button',name='Salvar e conferir alterações').click();expect(page.get_by_role('button',name='Conferir rascunho salvo',exact=True)).to_be_visible();assert page.evaluate('panel.blocked()');page.get_by_role('button',name='Conferir rascunho salvo',exact=True).click()
    if mode=='revision_absent':
     expect(page.get_by_role('button',name='Tentar salvar o mesmo rascunho',exact=True)).to_be_visible();assert page.evaluate('fixture.calls.filter(c=>c.method==="PUT").length')==1;page.get_by_role('button',name='Tentar salvar o mesmo rascunho',exact=True).click();expect(page.get_by_role('button',name='Tentar salvar o mesmo rascunho',exact=True)).to_be_hidden()
    expect(page.get_by_role('button',name='Conferir rascunho salvo',exact=True)).to_be_hidden();page.get_by_role('button',name='Salvar e conferir alterações').click();expect(page.get_by_role('button',name='Confirmar revisão',exact=True)).to_be_visible();assert page.evaluate('fixture.calls.filter(c=>c.method==="PUT").length')==(2 if mode=='revision_absent' else 1);page.get_by_role('button',name='Confirmar revisão',exact=True).click();expect(page.get_by_role('button',name='Conciliar mesma revisão')).to_be_visible();page.get_by_role('button',name='Conciliar mesma revisão').click();expect(page.locator('html')).to_have_attribute('data-confirmed','1');assert page.evaluate('fixture.commits')==1;record(f'{width} requester saves reconciles previews and revises without duplicate PUT or commit')
   assert page.locator('#fixture img').count()==0;assert 'hd_approval_' not in page.locator('#fixture').inner_text();assert page.evaluate('localStorage.length===0&&sessionStorage.length===0');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;record(f'{width} {mode} safe text responsive layout and no durable credentials')
   folder=ROOT/'evidence'/'email-wave2'/'browser';folder.mkdir(parents=True,exist_ok=True)
   if (width==1440 and mode=='approval') or (width==360 and mode=='revision'):page.screenshot(path=str(folder/f'{mode}-{width}.png'),full_page=True)
   page.evaluate('panel.destroy()');assert page.locator('#fixture').inner_text()=='';record(f'{width} {mode} destruction scrubs panel data');context.close()
 browser.close()
result={'fixture':'owned_https_component_synthetic_api','checks':checks};target=ROOT/'evidence'/'email-wave2'/'browser'/'review-portal.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
