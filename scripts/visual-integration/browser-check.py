#!/usr/bin/env python3
"""Full original app/controller, synthetic fetch only. Offline mode does not qualify HTTP/CSP."""
import argparse,json,hashlib,sys,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from transport import Transport,uid
from runtime import setup_offline,inline_logos
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--match',default='');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
ROOT=Path(__file__).resolve().parents[2];checks=[];cases=[]
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:print('FAIL',name,detail,flush=True)
def login(page):
 page.locator('#email').fill('person@example.invalid');page.locator('#password').fill('synthetic-password');page.locator('#submit-login').click();expect(page.locator('#app')).to_be_visible();page.wait_for_timeout(100)
def first(page):
 page.locator('.ticket-card').first.click();expect(page.locator('#ticket-detail')).to_be_visible();page.wait_for_timeout(40)
def request(page):
 if page.locator('#hd-back-to-tickets').is_visible():page.locator('#hd-back-to-tickets').click()
 page.locator('#new-ticket').click();expect(page.locator('#hd-opening-next')).to_be_enabled();page.locator('#hd-opening-next').click();page.locator('#subject').fill('Pedido sintético da bancada');page.locator('#description').fill('Descrição sintética da solicitação.');page.locator('#hd-opening-next').click();expect(page.locator('#hd-opening-step-3')).to_be_visible()
def posts(f,suffix):return [c for c in f.calls if c['method']=='POST' and c['path'].endswith(suffix)]

def gate(page,f):
 login(page);ck('gate: contagens indisponíveis',page.locator('#stat-total').inner_text()=='—');ck('gate: nenhum GET de negócio',not any('/v1/tickets' in c['path'] for c in f.calls));ck('gate: ações bloqueadas',page.locator('#new-ticket').is_disabled() and page.locator('#refresh').is_disabled());ck('gate: avançados ocultos/inertes',page.locator('[data-advanced-access]').evaluate_all('(es)=>es.every(e=>e.hidden&&e.inert)'))
 page.locator('#hd-nav-toggle').click();page.locator('[data-view=guide]').click();expect(page.locator('#guide-view')).to_be_visible();ck('guia: não descreve sessão autenticada como banco em memória','A demonstração utiliza memória' not in page.locator('#guide-view').inner_text());page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();ck('saída: senha e lista limpas',page.locator('#password').input_value()=='' and page.locator('.ticket-card').count()==0)
def customer(page,f):
 login(page);first(page);ck('cliente: nenhum GET interno',not any(c['path'].endswith('/notes') for c in f.calls));ck('cliente: ferramentas e nota ocultas',page.locator('#note-tab').is_hidden() and page.locator('#hd-ticket-tools').is_hidden());ck('cliente: sem nota interna no DOM','Nota interna sintética' not in page.content());page.locator('#message-body').fill('Resposta do cliente');page.locator('#send-message').click();expect(page.locator('#messages')).to_contain_text('Resposta do cliente');ck('cliente: um envio',len(posts(f,'/messages'))==1)
def drafts(page,f):
 login(page);first(page);page.locator('#message-body').fill('Rascunho público');page.locator('#note-tab').click();page.locator('#message-body').fill('Rascunho privado');ck('nota: placeholder corresponde ao canal','interna' in page.locator('#message-body').get_attribute('placeholder'));page.locator('#public-tab').click();ck('canais: público preservado',page.locator('#message-body').input_value()=='Rascunho público');page.locator('#note-tab').click();ck('canais: privado preservado',page.locator('#message-body').input_value()=='Rascunho privado');ck('nota: aviso explícito visível',page.locator('#hd-internal-warning').is_visible());page.locator('#hd-back-to-tickets').click();first(page);ck('voltar/abrir: mesmo rascunho',page.locator('#message-body').input_value()=='Rascunho privado')
def identifiers(page,f):
 login(page);values=page.locator('.ticket-card .card-top>span:first-child').all_text_contents();ck('IDs: mesmo prefixo não é ambíguo',len(set(values))==len(values),values)
def happy(page,f):
 login(page);request(page);ck('revisão não cria chamado',not f.create_intents);page.locator('#submit-create').click();expect(page.locator('#create-dialog')).not_to_be_visible();expect(page.locator('#ticket-title')).to_have_text('Pedido sintético da bancada');ck('abertura: único efeito',len(f.create_intents)==1)
def ambiguous(page,f):
 login(page);f.ambiguous=True;request(page);page.locator('#submit-create').click();expect(page.locator('#coverage-choice')).to_be_visible();ck('cobertura: sem seleção automática',page.locator('#coverage-choice').input_value()=='' and not f.create_intents);page.locator('#coverage-choice').select_option(uid(7));page.locator('#submit-create').click();expect(page.locator('#create-dialog')).not_to_be_visible();ck('cobertura: escolha enviada',next(iter(f.create_intents.values()))['coverage_id']==uid(7))
def recover(page,f):
 login(page);f.lost_create=True;request(page);page.locator('#submit-create').click();expect(page.locator('#submit-create')).to_have_text('Recuperar abertura');ck('incerto: campos bloqueados',page.locator('#subject').is_disabled());page.locator('#cancel-create').click();page.locator('#new-ticket').click();expect(page.locator('#submit-create')).to_have_text('Recuperar abertura');page.locator('#submit-create').click();expect(page.locator('#create-dialog')).not_to_be_visible();calls=posts(f,'/tickets');ck('recuperar: mesma chave/corpo',len(calls)==2 and calls[0]['headers']==calls[1]['headers'] and calls[0]['body']==calls[1]['body']);ck('recuperar: um efeito',len(f.create_intents)==1)
def lost_message(page,f):
 login(page);first(page);f.lost_message=True;page.locator('#message-body').fill('Não repetir automaticamente');page.locator('#send-message').click();page.wait_for_timeout(100);expect(page.locator('#send-message')).to_be_enabled();ck('mensagem incerta: rascunho preservado',page.locator('#message-body').input_value()=='Não repetir automaticamente');ck('mensagem incerta: sem replay automático',len(posts(f,'/messages'))==1)
 original=page.locator('#ticket-title').inner_text();page.locator('#hd-back-to-tickets').click();page.locator('.ticket-card').nth(1).click();expect(page.locator('#notification')).to_contain_text('Conclua ou recupere');ck('mensagem incerta: outro chamado não substitui a intenção',page.locator('#ticket-title').inner_text()==original)
 page.locator('.ticket-card').first.click();page.locator('#hd-back-to-tickets').click();page.locator('.ticket-card').first.click();expect(page.locator('#message-body')).to_be_disabled();ck('mensagem incerta: edição bloqueada até conciliação',page.locator('#send-message').inner_text()=='Conciliar envio anterior');page.locator('#send-message').click();expect(page.locator('#message-body')).to_have_value('');calls=posts(f,'/messages');ck('mensagem: mesma intenção explícita',len(calls)==2 and calls[0]['headers']==calls[1]['headers'] and calls[0]['body']==calls[1]['body'])
def priority(page,f):
 login(page);first(page);page.locator('#hd-ticket-tools>summary').click();page.locator('#ticket-priority').select_option('high');page.locator('#priority-reason').fill('Motivo local preservado');f.reject_priority=True;page.locator('#save-priority').click();expect(page.locator('#priority-reload')).to_be_visible();ck('412: motivo preservado',page.locator('#priority-reason').input_value()=='Motivo local preservado');ck('412: seção de aviso aberta',page.locator('#hd-ticket-tools').get_attribute('open') is not None);ck('412: um PATCH',sum(c['method']=='PATCH' for c in f.calls)==1)
def revocation(page,f):
 login(page);first(page);page.locator('#note-tab').click();page.locator('#message-body').fill('SEGREDO_RASCUNHO');f.fail_detail.add(f.tickets[0]['id']);page.locator('#hd-back-to-tickets').click();page.locator('.ticket-card').first.click();expect(page.locator('#hd-detail-read-status')).to_contain_text('não está disponível');ck('403: cabeçalho e descrição removidos do DOM',page.locator('#ticket-title').text_content()=='' and page.locator('#ticket-description').text_content()=='');ck('403: cache da lista descartado',page.locator('.ticket-card').count()==0);ck('403: nota/rascunho removidos',page.locator('#notes').text_content()=='' and page.locator('#message-body').input_value()=='');ck('403: sem repetição indiscriminada',page.locator('#hd-detail-retry').is_hidden())
def notes(page,f):
 login(page);first(page);f.notes_error=True;page.locator('#hd-back-to-tickets').click();first(page);expect(page.locator('#notes-status')).to_contain_text('indisponíveis');ck('notas recusadas: público permanece',page.locator('#messages').inner_text()!='');ck('notas recusadas: sem escritor nem conteúdo antigo',page.locator('#note-tab').is_hidden() and page.locator('#notes').text_content()=='')
def filters(page,f):
 login(page);page.locator('#hd-filter-disclosure>summary').click();page.locator('#priority-filter').select_option('urgent');ck('filtros: rascunho identificado',page.locator('#hd-filter-draft').is_visible());ck('filtros: sem busca ao digitar',sum(c['path']=='/v1/tickets' for c in f.calls)==1);page.locator('#apply-filters').click();expect(page.locator('.list-empty')).to_be_visible();ck('filtros: query enviada',any(c['query'].get('priority')==['urgent'] for c in f.calls));page.locator('#clear-filters').click();expect(page.locator('.ticket-card')).to_have_count(2)
def late(page,f):
 login(page);tid=f.tickets[1]['id'];page.evaluate('(p)=>NETWORK_FIXTURE.block("detail",p)','/v1/tickets/'+tid);page.locator('.ticket-card').nth(1).click();expect(page.locator('#hd-detail-read-status')).to_contain_text('Carregando');page.locator('#hd-back-to-tickets').click();page.evaluate('NETWORK_FIXTURE.release("detail")');page.wait_for_timeout(120);ck('tardia: permanece lista',page.locator('#tickets-view').get_attribute('data-inbox-pane')=='list');ck('tardia: foco não está oculto',page.evaluate('document.activeElement.getClientRects().length>0'))
def logout(page,f):
 login(page);tid=f.tickets[1]['id'];page.evaluate('(p)=>NETWORK_FIXTURE.block("detail",p)','/v1/tickets/'+tid);page.locator('.ticket-card').nth(1).click();page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();page.evaluate('NETWORK_FIXTURE.release("detail")');page.wait_for_timeout(120);ck('logout: tardia não restaura dados',page.locator('#ticket-title').text_content()=='' and page.locator('.ticket-card').count()==0)
def invalid_login(page,f):
 f.auth_error=400;page.locator('#email').fill('person@example.invalid');page.locator('#password').fill('synthetic-secret');page.locator('#submit-login').click();page.wait_for_timeout(150);ck('falha: sem /me nem chamado',not any(c['path'] in ['/v1/me','/v1/tickets'] for c in f.calls));ck('falha: senha limpa',page.locator('#password').input_value()=='');ck('falha: mensagem sem segredo','synthetic-secret' not in page.content());ck('falha: mensagem presente',len(page.locator('#login-status').inner_text())>0)
def multi(page,f):
 f.workspaces=2;page.locator('#email').fill('person@example.invalid');page.locator('#password').fill('synthetic-secret');page.locator('#submit-login').click();expect(page.locator('#login-status')).to_contain_text('operação');ck('multi: sem workspace manual ou /me',page.locator('#workspace').is_hidden() and not any(c['path']=='/v1/me' for c in f.calls))
def matrix(page,f):
 login(page)
 for theme in ['light','dark']:
  page.locator('#hd-theme-app').select_option(theme)
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(15)
   ck(f'caixa {theme}/{width}: sem overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   minimum=16 if width<=670 else 14
   ck(f'caixa {theme}/{width}: inputs >={minimum}px',page.locator('#ticket-filters input,#ticket-filters select').evaluate_all('(es,min)=>es.filter(e=>e.getClientRects().length).every(e=>parseFloat(getComputedStyle(e).fontSize)>=min)',minimum))
  page.set_viewport_size({'width':390,'height':844});first(page);page.evaluate('scrollTo(0,0)');page.screenshot(path=str(a.output/f'atendimento-390-{theme}.png'),full_page=True);page.locator('#hd-back-to-tickets').click();page.set_viewport_size({'width':1440,'height':900});page.evaluate('scrollTo(0,0)');page.screenshot(path=str(a.output/f'caixa-1440-{theme}.png'),full_page=True);page.set_viewport_size({'width':390,'height':844})


def notfound(page,f):
 f.fail_detail_status=404;revocation(page,f)
def transient(page,f):
 login(page);first(page);page.locator('#message-body').fill('Rascunho após falha temporária');f.fail_detail_status=503;f.fail_detail.add(f.tickets[0]['id']);page.locator('#hd-back-to-tickets').click();page.locator('.ticket-card').first.click();expect(page.locator('#hd-detail-retry')).to_be_visible();ck('503: rascunho não apagado',page.locator('#message-body').input_value()=='Rascunho após falha temporária');ck('503: nenhum envio',len(posts(f,'/messages'))==0);f.fail_detail.clear();page.locator('#hd-detail-retry').click();expect(page.locator('#ticket-detail')).to_be_visible();ck('503: rascunho disponível após GET explícito',page.locator('#message-body').input_value()=='Rascunho após falha temporária')
def session_pause(page,f):
 login(page);first(page);page.locator('#message-body').fill('Retomar sem envio automático');f.fail_refresh=True;page.evaluate('window.ux09Now=Date.now;Date.now=()=>ux09Now()+3599000');page.locator('#send-message').click();expect(page.locator('#retry-session')).to_be_visible();ck('sessão: pausa preserva rascunho',page.locator('#message-body').input_value()=='Retomar sem envio automático');ck('sessão: negócio não despachado',len(posts(f,'/messages'))==0);f.fail_refresh=False;page.locator('#retry-session').click();expect(page.locator('#session-banner')).not_to_be_visible();ck('sessão: renovar não reenvia gravação',len(posts(f,'/messages'))==0);page.locator('#send-message').click();expect(page.locator('#message-body')).to_have_value('');ck('sessão: confirmação explícita envia uma vez',len(posts(f,'/messages'))==1)
def pending_send(page,f):
 login(page);first(page);page.locator('#message-body').fill('Mensagem pendente');page.evaluate('(p)=>NETWORK_FIXTURE.block("send",p)','/v1/tickets/'+f.tickets[0]['id']+'/messages');page.locator('#send-message').click();expect(page.locator('#send-message')).to_be_disabled();page.locator('#message-form').dispatch_event('submit');page.wait_for_timeout(40);ck('envio pendente: somente uma requisição',page.evaluate('NETWORK_FIXTURE.pending("send")')==1);page.evaluate('NETWORK_FIXTURE.release("send")');expect(page.locator('#message-body')).to_have_value('');ck('envio pendente: somente um efeito',len(f.message_intents)==1)
def identity_change(page,f):
 login(page);first(page);page.locator('#note-tab').click();page.locator('#message-body').fill('PRIVADO_EQUIPE_ANTERIOR');page.locator('#logout-mobile').click();expect(page.locator('#login-screen')).to_be_visible();f.team=False;f.me_id=uid(25);login(page);first(page);ck('outra identidade: sem rascunho da anterior',page.locator('#message-body').input_value()=='');ck('outra identidade: nota não está no DOM','PRIVADO_EQUIPE_ANTERIOR' not in page.content() and 'Nota interna sintética' not in page.content());ck('outra identidade: ações internas ocultas',page.locator('#note-tab').is_hidden() and page.locator('#hd-ticket-tools').is_hidden())
def keyboard(page,f):
 # Real native form validity and real modal focus; no synthetic UI state switch.
 page.locator('#email').focus();page.keyboard.press('Enter');expect(page.locator('#hd-access-error-email')).to_be_visible();ck('teclado: e-mail inválido associado',page.locator('#email').get_attribute('aria-invalid')=='true');login(page);page.locator('#hd-nav-toggle').focus();page.keyboard.press('Enter');expect(page.locator('[data-view=guide]')).to_be_visible();page.keyboard.press('Escape');ck('teclado: menu devolve foco',page.evaluate('document.activeElement.id')=='hd-nav-toggle');page.locator('#new-ticket').click();page.keyboard.press('Escape');expect(page.locator('#create-dialog')).not_to_be_visible();ck('teclado: fechar modal não cria chamado',not f.create_intents);ck('teclado: foco visível após modal',page.evaluate('document.activeElement.getClientRects().length>0'));ck('atalho: fora da tela sem foco',page.locator('#hd-skip-main').evaluate('(e)=>e.getBoundingClientRect().bottom<=0'));page.locator('#hd-skip-main').focus();ck('atalho: visível ao receber foco',page.locator('#hd-skip-main').evaluate('(e)=>e.getBoundingClientRect().top>=0'))

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or os.environ.get('BROWSER_EXECUTABLE'),headless=True,args=['--no-sandbox'])
 for name,fn,kw in [('gate-fechado',gate,{'operational':False}),('cliente',customer,{'team':False}),('rascunhos',drafts,{}),('identificadores',identifiers,{}),('abertura',happy,{}),('ambiguidade',ambiguous,{}),('recuperar-abertura',recover,{}),('mensagem-incerta',lost_message,{}),('prioridade',priority,{}),('revogacao',revocation,{}),('notas-recusadas',notes,{}),('filtros',filters,{}),('detalhe-tardio',late,{}),('saida-tardia',logout,{}),('login-recusado',invalid_login,{}),('multiplas-operacoes',multi,{}),('responsividade',matrix,{}),('detalhe-nao-encontrado',notfound,{}),('falha-temporaria',transient,{}),('pausa-sessao',session_pause,{}),('duplo-envio',pending_send,{}),('troca-identidade',identity_change,{}),('teclado',keyboard,{})]:
  if a.match and a.match not in name:continue
  start=len(checks);context=None;errors=[]
  try:
   context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page();page.set_default_timeout(2500);page.on('pageerror',lambda e:errors.append(str(e)));context.route('**/*',lambda r:r.abort());f=Transport(ROOT,**kw);setup_offline(page,f);expect(page.locator('#submit-login')).to_be_enabled();page.wait_for_timeout(30);inline_logos(page,ROOT);fn(page,f);ck(name+': sem exceções JS',not errors,errors);ck(name+': rotas conhecidas',not f.missing,f.missing)
  except Exception as e:
   ck(name+': execução completa',False,str(e).split('Call log:')[0][-900:])
   if context:
    try:page.screenshot(path=str(a.output/(name+'-falha.png')),full_page=True)
    except Exception:pass
  finally:
   if context:context.close()
   ok=all(c['passed'] for c in checks[start:]);cases.append({'name':name,'passed':ok,'checks':len(checks)-start});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 browser.close()
report={'mode':'offline-full-app-synthetic-transport','original_controller_replaced':False,'legacy_css_loaded':True,'cases':cases,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for d in ['web','shared'] for f in (ROOT/d).rglob('*') if f.is_file()},'limits':['no HTTP/CSP approval','no hosted Auth, SQL or deployment','offline import URLs and randomUUID shim']}
(a.output/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'passed':report['passed'],'failed':report['failed'],'cases':len(cases)}));sys.exit(1 if report['failed'] else 0)
