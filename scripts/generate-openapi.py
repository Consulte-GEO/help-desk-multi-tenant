"""Generate the deliberately bounded, implemented API contract; no speculative endpoints."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
identifier={'type':'string','pattern':'^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$','description':'Identificador opaco; entidades persistidas no PostgreSQL usam UUID.'}
def obj(properties,required=None):return {'type':'object','additionalProperties':False,'properties':properties,'required':required or list(properties)}
def ref(name):return {'$ref':'#/components/schemas/'+name}
def array(schema):return {'type':'array','items':schema}
text=lambda n=12000:{'type':'string','minLength':1,'maxLength':n}
context={'account_id':identifier,'product_instance_id':identifier,'service_code':text(80)}
statuses=['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled']
schemas={
 'Problem':obj({'type':{'type':'string'},'title':{'type':'string'},'status':{'type':'integer'},'code':{'type':'string'},'detail':{'type':'string'},'request_id':{'type':'string'}}),
 'Context':obj(context),
 'CreateTicket':obj({**context,'subject':{'type':'string','minLength':3,'maxLength':200},'description':text(),'priority':{'type':'string','enum':['low','normal','high','urgent']},'coverage_id':identifier},['account_id','product_instance_id','service_code','subject','description','priority']),
 'Body':obj({'body':text()}),
 'AssignmentChange':obj({'action':{'type':'string','enum':['claim','release']},'reason':{'type':'string','minLength':1,'maxLength':2000,'description':'Motivo interno obrigatório, sem caracteres de controle.'}}),
 'AssignmentSummary':obj({'state':{'type':'string','enum':['unassigned','mine','other']},'can_claim':{'type':'boolean'},'can_release':{'type':'boolean'}}),
 'PriorityChange':obj({'priority':{'type':'string','enum':['low','normal','high','urgent']},'reason':{'type':'string','minLength':1,'maxLength':2000,'description':'Motivo interno obrigatório, após trim, sem caracteres de controle. Não enviado ao cliente nem à outbox.'}}),
 'Transition':obj({'to':{'type':'string','enum':statuses},'reason':{'type':'string','maxLength':2000}}),
 'Ticket':obj({'id':identifier,**context,'subject':text(200),'description':text(),'status':{'type':'string','enum':['received','in_progress','waiting_for_you','resolved','closed']},'internal_status':{'type':'string','enum':statuses,'description':'Somente equipe autorizada.'},'assignment':{**ref('AssignmentSummary'),'description':'Somente operador humano autorizado. Estado consultivo, não autorização; não contém principal ID.'},'priority':{'type':'string','enum':['low','normal','high','urgent']},'version':{'type':'integer','minimum':1},'coverage_id':identifier,'contract_version_id':identifier,'created_at':{'type':'string','format':'date-time'},'updated_at':{'type':'string','format':'date-time'}},['id','account_id','product_instance_id','service_code','subject','description','status','priority','version','coverage_id','contract_version_id','created_at','updated_at']),
 'Message':obj({'id':identifier,'ticket_id':identifier,'body':text(),'actor_type':{'type':'string','enum':['human_agent','customer','integration']},'created_at':{'type':'string','format':'date-time'}}),
 'Note':obj({'id':identifier,'ticket_id':identifier,'body':text(),'created_at':{'type':'string','format':'date-time'}}),
 'TicketPage':obj({'items':array(ref('Ticket')),'next_cursor':{'type':['string','null']}}),
 'Resolution':obj({'status':{'type':'string','enum':['resolved','ambiguous','no_coverage']},'candidates':array(obj({'coverage_id':identifier,'contract_id':identifier,'contract_version_id':identifier,'contract_version':{'type':'integer','minimum':1},'valid_until':{'type':['string','null'],'format':'date-time'}}))}),
 'Capabilities':{'type':'object','required':['api_version','release','capabilities'],'properties':{'api_version':{'const':'v1'},'release':{'type':'string'},'capabilities':{'type':'object','additionalProperties':{'type':'boolean'}}}},
 'Principal':{'type':'object','required':['id','kind','workspace_id','grants','scopes'],'properties':{'id':identifier,'kind':{'enum':['human','integration']},'workspace_id':identifier,'workspace_role':{'type':['string','null']},'grants':{'type':'array','items':{'type':'object'}},'product_instance_ids':array(identifier),'scopes':array({'type':'string'})}},
 'PublicConfig':obj({'supabase_url':{'type':['string','null']},'publishable_key':{'type':['string','null']}}),
 'IntegrationToken':obj({'access_token':{'type':'string','pattern':'^hd_session_[A-Za-z0-9_-]{43}$'},'token_type':{'const':'Bearer'},'expires_at':{'type':'string','format':'date-time'},'workspace_id':identifier}),
 'Timeline':{'type':'object','required':['items','next_cursor'],'properties':{'next_cursor':{'type':['string','null']},'items':{'type':'array','items':{'type':'object','required':['id','type','created_at','data'],'properties':{'id':identifier,'type':{'type':'string'},'created_at':{'type':'string','format':'date-time'},'data':{'type':'object'}}}}}}
}
parameters={
 'Workspace':{'name':'X-Workspace-Id','in':'header','required':True,'schema':identifier,'description':'Seletor validado contra vínculos vivos; não concede autorização.'},
 'Idempotency':{'name':'Idempotency-Key','in':'header','required':True,'schema':{'type':'string','pattern':'^[A-Za-z0-9._:-]{16,128}$'}},
 'IfMatch':{'name':'If-Match','in':'header','required':True,'schema':{'type':'string','pattern':'^"[1-9][0-9]*"$'}},
 'TicketId':{'name':'ticket_id','in':'path','required':True,'schema':identifier}
}
def param(name):return {'$ref':'#/components/parameters/'+name}
def response(schema,desc):return {'description':desc,'content':{'application/json':{'schema':schema}}}
paths={}
def route(path,method,operation,summary,output,body=None,status=200,idem=False,match=False,public=False,token=False):
 op={'operationId':operation,'summary':summary,'security':[] if public else [{'integrationKey':[]} if token else {'bearerAuth':[]}],'parameters':[] if public or token else [param('Workspace')],'responses':{str(status):response(output,'Operação concluída.'),'default':{'description':'Erro seguro padronizado.','content':{'application/problem+json':{'schema':ref('Problem')}}}}}
 if '{ticket_id}' in path:op['parameters'].append(param('TicketId'))
 if idem:
  op['parameters'].append(param('Idempotency'));op['responses']['200']=response(output,'Resposta original reproduzida, ou operação concluída.')
  for code in ['200',str(status)]:op['responses'][code]['headers']={'Idempotency-Replayed':{'schema':{'type':'string','enum':['true','false']},'description':'Indica reprodução de resultado anterior.'}}
 if match:op['parameters'].append(param('IfMatch'))
 if body:
  op['requestBody']={'required':True,'description':'Objeto JSON UTF-8, até 65.536 bytes; sem compressão. Recebimento limitado a 5 segundos na aplicação.', 'content':{'application/json':{'schema':ref(body)}}}
  for code,description in [('400','JSON, UTF-8, campos ou comprimento inválidos.'),('408','Prazo de recebimento do corpo excedido.'),('413','Corpo acima de 64 KiB.'),('415','Content-Type ou compressão não suportados.')]:
   op['responses'][code]={'description':description,'content':{'application/problem+json':{'schema':ref('Problem')}}}

 paths.setdefault(path,{})[method]=op
 return op
route('/capabilities','get','getCapabilities','Capacidades disponíveis; não representa prontidão de produção.',ref('Capabilities'),public=True)
route('/public-config','get','getPublicConfig','Somente URL Auth e chave publicável.',ref('PublicConfig'),public=True)
route('/integration-tokens','post','exchangeIntegrationCredential','Troca server-to-server; não utilizar no navegador.',ref('IntegrationToken'),status=201,token=True)
revoke=route('/integration-tokens/current','delete','revokeCurrentIntegrationSession','Encerra somente a sessão M2M curta apresentada. Não revoga a credencial nem outras sessões.',{},status=204,public=True)
revoke['security']=[{'integrationSession':[]}]
revoke['description']='Server-to-server. Sem body, query ou X-Workspace-Id. A mesma resposta 204 é retornada para sessão inexistente ou já encerrada; não consulta vínculos ativos. Limite de entrada continua aplicado. Chamadas já em andamento não são canceladas retroativamente.'
revoke['responses']['204']={'description':'Sessão apresentada encerrada ou já ausente. Corpo vazio.','headers':{'Cache-Control':{'schema':{'const':'no-store'}}}}
for code,description in [('400','Corpo ou seletor de consulta não permitido.'),('401','Bearer não corresponde a sessão M2M curta.'),('408','Stream de corpo não encerrou em cinco segundos.'),('503','Encerramento indisponível ou confirmação transacional incerta; não considerar logout concluído.')]:
 revoke['responses'][code]={'description':description,'content':{'application/problem+json':{'schema':ref('Problem')}}}
route('/me','get','getPrincipal','Identidade e vínculos atuais no workspace.',ref('Principal'))
schemas['SupportContextOption']=obj({**context,'account_name':text(160),'product_name':text(160),'environment':{'type':'string','enum':['development','staging','production']},'service_name':text(160)})
schemas['SupportContextPage']=obj({'items':{**array(ref('SupportContextOption')),'maxItems':100},'next_cursor':{'type':['string','null'],'maxLength':1600}})
catalog=route('/support-contexts','get','listSupportContexts','Contas, sistemas e serviços elegíveis para o ator atual.',ref('SupportContextPage'))
catalog['description']='Requer contexts:resolve. Opções agrupadas por conta, instância e serviço; apenas coberturas habilitadas, publicadas, ativas e vigentes. Não expõe políticas ou IDs contratuais. É uma descoberta consultiva, não uma reserva nem garantia de criação. Resolve/create revalidam. Cursor por identificadores, vinculado a ator/workspace/filtro, sem snapshot entre páginas. Atualizar a lista após mudanças de vínculo/cobertura.'
catalog['parameters'] += [{'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':100,'default':50}},{'name':'cursor','in':'query','schema':{'type':'string','minLength':1,'maxLength':1600}},{'name':'account_id','in':'query','schema':identifier}]
catalog['responses']['200']['headers']={'Cache-Control':{'schema':{'const':'no-store'}}}
route('/contexts/resolve' ,'post','resolveContext','Resolve cobertura vigente ou ambiguidade.',ref('Resolution'),'Context')
listing=route('/tickets','get','listTickets','Lista chamados autorizados por cursor; parâmetros duplicados ou seletores explicitamente vazios são recusados.',ref('TicketPage'))
listing['parameters'] += [{'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':100,'default':25}},{'name':'cursor','in':'query','schema':{'type':'string','minLength':1,'maxLength':700}},{'name':'account_id','in':'query','schema':identifier}]
listing['description']='Busca literal em assunto ou UUID completo, com dobra de caixa ASCII/Latin-1 determinística e acentos significativos. Não pesquisa descrição, mensagens nem notas. Filtros combinam por AND e são aplicados antes do LIMIT no escopo autorizado. Não é busca full-text, ranking ou totalização. Cursor vinculado a ator, workspace, conta e filtros; alterações de filtros exigem reinício. Páginas são vivas, não snapshot. Cursor anterior sem novos filtros permanece compatível. Campos explicitamente vazios são inválidos; omita filtros não utilizados.'
listing['parameters'] += [
 {'name':'q','in':'query','schema':{'type':'string','minLength':2,'maxLength':120},'description':'Após trim: 2 a 120 pontos de código Unicode, sem controles ou surrogates. Texto literal; % e _ não são curingas. Apenas assunto ou UUID completo.'},
 {'name':'status','in':'query','schema':{'type':'string','enum':['received','in_progress','waiting_for_you','resolved','closed']},'description':'Situação pública. Não aceita seletores de estados internos.'},
 {'name':'priority','in':'query','schema':{'type':'string','enum':['low','normal','high','urgent']}}]
listing['responses']['200']['headers']={'Cache-Control':{'schema':{'const':'no-store'}}}
route('/tickets','post','createTicket','Cria chamado com revalidação transacional.',ref('Ticket'),'CreateTicket',status=201,idem=True)
route('/tickets/{ticket_id}','get','getTicket','Consulta chamado e retorna ETag.',ref('Ticket'))['responses']['200']['headers']={'ETag':{'description':'Versão atual entre aspas.','schema':{'type':'string'}}}
assignment=route('/tickets/{ticket_id}/assignments','post','changeTicketAssignment','Assume para si ou libera responsabilidade, sem conceder acesso.',ref('Ticket'),'AssignmentChange',idem=True,match=True)
assignment['description']='Somente operador humano autorizado da conta com tickets:read e tickets:write. Claim somente para si em chamado desocupado; um admin não pode tomar ocupado. Release pelo responsável ou admin do workspace. Sem transferência arbitrária, filas, recálculo de SLA ou evento externo. Encerrado/cancelado: 409. Versão antiga: 412. No-op também valida versão. Motivo somente no histórico interno; cliente e integração não recebem assignment. Reenvio idêntico devolve resultado original, com reautorização. GET obtém estado atual.'
assignment['responses']['200']['headers']['ETag']={'schema':{'type':'string'},'description':'Versão desta resposta, não necessariamente a atual em replay.'}
for code,description in [('403','Não operador, scope ausente ou release de outro sem papel admin.'),('409','Ocupado, terminal ou conflito da chave.'),('412','Versão desatualizada.'),('428','If-Match ausente.'),('503','Indisponível ou resultado incerto; não repetir com outra chave automaticamente.')]:
 assignment['responses'][code]={'description':description,'content':{'application/problem+json':{'schema':ref('Problem')}}}
priority=route('/tickets/{ticket_id}','patch','changeTicketPriority','Altera somente prioridade, com motivo interno, versão e chave de reenvio.',ref('Ticket'),'PriorityChange',idem=True,match=True)
priority['description']='Somente operador humano autorizado da conta com tickets:read e tickets:write. Não permite alterar conta, contrato, estado ou SLA. Cliente, gestor de conta e integração não são operadores. If-Match antigo: 412; ausência: 428; inválido: 400. Motivo interno de 1–2000 pontos de código após trim, sem controles. Encerrados/cancelados: 409. Mesma prioridade mantém versão e não cria evento, mas valida versão/permissão e registra resposta idempotente. Reenvio reautoriza operador e retorna a versão original; consulte GET para a versão atual. Erro após COMMIT pode significar resultado incerto: não reenviar automaticamente com chave nova.'
priority['responses']['200']['headers']['ETag']={'schema':{'type':'string'},'description':'Versão da resposta; em replay pode não ser a mais recente.'}
for code,description in [('403','Operador ou capacidade não autorizados.'),('404','Recurso não visível.'),('409','Estado terminal, conflito de chave ou dados.'),('412','Versão divergente. Recarregue e revise antes de confirmar.'),('428','If-Match obrigatório.'),('503','Resultado indisponível ou incerto. Não presumir ausência de gravação.')]:
 priority['responses'][code]={'description':description,'content':{'application/problem+json':{'schema':ref('Problem')}}}
for resource,name in [('messages','Message'),('notes','Note')]:
 route('/tickets/{ticket_id}/'+resource,'get','list'+resource.title(), 'Lista '+('conversa pública.' if resource=='messages' else 'notas restritas à equipe.'),obj({'items':array(ref(name)),'next_cursor':{'type':['string','null']}}))
 route('/tickets/{ticket_id}/'+resource,'post','add'+name, 'Adiciona '+('mensagem pública.' if resource=='messages' else 'nota interna, sem outbox externo.'),ref(name),'Body',status=201,idem=True)
route('/tickets/{ticket_id}/transitions','post','transitionTicket','Transição com versão esperada e motivo de reabertura.',ref('Ticket'),'Transition',idem=True,match=True)
route('/tickets/{ticket_id}/timeline','get','getTimeline','Histórico projetado conforme autorização.',ref('Timeline'))
paths['/tickets/{ticket_id}/timeline']['get']['description']='Histórico vivo paginado. Mudança de prioridade projeta from/to/version; reason somente para operador autorizado. Notas internas não aparecem ao cliente. Conteúdo de mensagens/notas não é incluído. Cursor não autoriza o recurso. A interface limita-se a 500 eventos carregados e a API continua paginada.'
# Explicit pagination and quota behavior; newest first, cursor scoped to resource and actor.
for resource in ['messages','notes','timeline']:
 paths['/tickets/{ticket_id}/'+resource]['get']['parameters'] += [
  {'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':100,'default':50}},
  {'name':'cursor','in':'query','schema':{'type':'string','minLength':1,'maxLength':700}}]
for methods in paths.values():
 for op in methods.values():
  op['responses']['429']={'description':'Limite temporário. O intervalo é mínimo para nova tentativa, não garantia de sucesso.',
   'headers':{'Retry-After':{'schema':{'type':'integer','minimum':1,'maximum':60}}},
   'content':{'application/problem+json':{'schema':ref('Problem')}}}
parameters['Idempotency']['description']='Resposta por 7 dias; registro antirrepetição por 90 dias. Após expirar, HTTP 409; consulte o recurso antes de usar nova chave.'
api={'openapi':'3.1.1','info':{'title':'Consulte Help Desk — API v1','version':'0.9.0','description':'Contrato M1: paginação, limites, validação de entrada e isolamento. Produção bloqueada até homologação. Funcionalidades não implementadas não constam como operações disponíveis.'},'servers':[{'url':'/v1','description':'Mesmo domínio da interface; adaptador Netlify.'}],'paths':paths,'components':{'securitySchemes':{'integrationSession':{'type':'http','scheme':'bearer','description':'Somente hd_session_ seguido de 43 caracteres base64url. Nunca login humano ou hd_key_.'},'bearerAuth':{'type':'http','scheme':'bearer','description':'Supabase access token humano ou hd_session_... M2M de curta duração.'},'integrationKey':{'type':'http','scheme':'bearer','description':'hd_key_... mantida exclusivamente no backend do consumidor.'}},'parameters':parameters,'schemas':schemas}}
(root/'docs/openapi.json').write_text(json.dumps(api,ensure_ascii=False,indent=2)+'\n')
print(len(paths),'paths;',sum(len(v) for v in paths.values()),'operations')
