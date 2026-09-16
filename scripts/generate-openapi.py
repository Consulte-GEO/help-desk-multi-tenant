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
 'Transition':obj({'to':{'type':'string','enum':statuses},'reason':{'type':'string','maxLength':2000}}),
 'Ticket':obj({'id':identifier,**context,'subject':text(200),'description':text(),'status':{'type':'string','enum':['received','in_progress','waiting_for_you','resolved','closed']},'internal_status':{'type':'string','enum':statuses,'description':'Somente equipe autorizada.'},'priority':{'type':'string','enum':['low','normal','high','urgent']},'version':{'type':'integer','minimum':1},'coverage_id':identifier,'contract_version_id':identifier,'created_at':{'type':'string','format':'date-time'},'updated_at':{'type':'string','format':'date-time'}},['id','account_id','product_instance_id','service_code','subject','description','status','priority','version','coverage_id','contract_version_id','created_at','updated_at']),
 'Message':obj({'id':identifier,'ticket_id':identifier,'body':text(),'actor_type':{'type':'string','enum':['human_agent','customer','integration']},'created_at':{'type':'string','format':'date-time'}}),
 'Note':obj({'id':identifier,'ticket_id':identifier,'body':text(),'created_at':{'type':'string','format':'date-time'}}),
 'TicketPage':obj({'items':array(ref('Ticket')),'next_cursor':{'type':['string','null']}}),
 'Resolution':obj({'status':{'type':'string','enum':['resolved','ambiguous','no_coverage']},'candidates':array(obj({'coverage_id':identifier,'contract_id':identifier,'contract_version_id':identifier,'contract_version':{'type':'integer','minimum':1},'valid_until':{'type':['string','null'],'format':'date-time'}}))}),
 'Capabilities':{'type':'object','required':['api_version','release','capabilities'],'properties':{'api_version':{'const':'v1'},'release':{'type':'string'},'capabilities':{'type':'object','additionalProperties':{'type':'boolean'}}}},
 'Principal':{'type':'object','required':['id','kind','workspace_id','grants','scopes'],'properties':{'id':identifier,'kind':{'enum':['human','integration']},'workspace_id':identifier,'workspace_role':{'type':['string','null']},'grants':{'type':'array','items':{'type':'object'}},'product_instance_ids':array(identifier),'scopes':array({'type':'string'})}},
 'PublicConfig':obj({'supabase_url':{'type':['string','null']},'publishable_key':{'type':['string','null']}}),
 'IntegrationToken':obj({'access_token':{'type':'string','pattern':'^hd_session_'},'token_type':{'const':'Bearer'},'expires_at':{'type':'string','format':'date-time'},'workspace_id':identifier}),
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
 if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
 paths.setdefault(path,{})[method]=op
 return op
route('/capabilities','get','getCapabilities','Capacidades disponíveis; não representa prontidão de produção.',ref('Capabilities'),public=True)
route('/public-config','get','getPublicConfig','Somente URL Auth e chave publicável.',ref('PublicConfig'),public=True)
route('/integration-tokens','post','exchangeIntegrationCredential','Troca server-to-server; não utilizar no navegador.',ref('IntegrationToken'),status=201,token=True)
route('/me','get','getPrincipal','Identidade e vínculos atuais no workspace.',ref('Principal'))
route('/contexts/resolve','post','resolveContext','Resolve cobertura vigente ou ambiguidade.',ref('Resolution'),'Context')
listing=route('/tickets','get','listTickets','Lista chamados autorizados por cursor.',ref('TicketPage'))
listing['parameters'] += [{'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':100,'default':25}},{'name':'cursor','in':'query','schema':{'type':'string','maxLength':700}},{'name':'account_id','in':'query','schema':identifier}]
route('/tickets','post','createTicket','Cria chamado com revalidação transacional.',ref('Ticket'),'CreateTicket',status=201,idem=True)
route('/tickets/{ticket_id}','get','getTicket','Consulta chamado e retorna ETag.',ref('Ticket'))['responses']['200']['headers']={'ETag':{'description':'Versão atual entre aspas.','schema':{'type':'string'}}}
for resource,name in [('messages','Message'),('notes','Note')]:
 route('/tickets/{ticket_id}/'+resource,'get','list'+resource.title(), 'Lista '+('conversa pública.' if resource=='messages' else 'notas restritas à equipe.'),obj({'items':array(ref(name)),'next_cursor':{'type':['string','null']}}))
 route('/tickets/{ticket_id}/'+resource,'post','add'+name, 'Adiciona '+('mensagem pública.' if resource=='messages' else 'nota interna, sem outbox externo.'),ref(name),'Body',status=201,idem=True)
route('/tickets/{ticket_id}/transitions','post','transitionTicket','Transição com versão esperada e motivo de reabertura.',ref('Ticket'),'Transition',idem=True,match=True)
route('/tickets/{ticket_id}/timeline','get','getTimeline','Histórico projetado conforme autorização.',ref('Timeline'))
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
api={'openapi':'3.1.1','info':{'title':'Consulte Help Desk — API v1','version':'0.2.0','description':'Contrato M1: paginação, limites e isolamento. Produção bloqueada até homologação. Funcionalidades não implementadas não constam como operações disponíveis.'},'servers':[{'url':'/v1','description':'Mesmo domínio da interface; adaptador Netlify.'}],'paths':paths,'components':{'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer','description':'Supabase access token humano ou hd_session_... M2M de curta duração.'},'integrationKey':{'type':'http','scheme':'bearer','description':'hd_key_... mantida exclusivamente no backend do consumidor.'}},'parameters':parameters,'schemas':schemas}}
(root/'docs/openapi.json').write_text(json.dumps(api,ensure_ascii=False,indent=2)+'\n')
print(len(paths),'paths;',sum(len(v) for v in paths.values()),'operations')
