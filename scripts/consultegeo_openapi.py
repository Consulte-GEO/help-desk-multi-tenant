"""M06 additive contracts. Called by the canonical OpenAPI generator."""
def extend_consultegeo(s):
    schemas=s['components']['schemas'];params=s['components']['parameters']
    ref=lambda name:{'$ref':'#/components/schemas/'+name}
    pr=lambda name:{'$ref':'#/components/parameters/'+name}
    params['ChecklistIfMatch']={'in':'header','name':'If-Match','required':True,'schema':{'type':'string','pattern':'^"(0|[1-9][0-9]*)"$'}}
    params['Origin']={'in':'header','name':'Origin','required':True,'schema':{'type':'string','format':'uri'},'description':'Origem HTTPS exata configurada no servidor.'}
    params['ConfigurationId']={'in':'path','name':'configuration_id','required':True,'schema':{'type':'string','format':'uuid'}}
    params['ConfigurationVersion']={'in':'path','name':'version','required':True,'schema':{'type':'integer','minimum':1}}
    action_fields={'start':{},'triage':{},'reply':{'body':{'type':'string','minLength':1,'maxLength':12000}},'customer_reply':{'body':{'type':'string','minLength':1,'maxLength':12000}},'request_customer':{'body':{'type':'string','minLength':1,'maxLength':12000}},'handoff':{'target':{'enum':['internal','third_party']},'reason':{'type':'string','minLength':1,'maxLength':2000}},'resolve':{'body':{'type':'string','minLength':1,'maxLength':12000}},'close':{},'reopen':{'reason':{'type':'string','minLength':1,'maxLength':2000}},'cancel':{'reason':{'type':'string','minLength':1,'maxLength':2000}},'transfer':{'targetPrincipalId':{'type':'string','format':'uuid'},'reason':{'type':'string','minLength':1,'maxLength':2000}}}
    schemas['SupportWorkflowCommand']={'oneOf':[{'type':'object','additionalProperties':False,'properties':{'action':{'const':action},**fields},'required':['action',*fields]} for action,fields in action_fields.items()]}
    receipt_fields={k:{'type':'string','format':'uuid'} for k in ['ticketId','workspaceId','accountId','actorId','eventId']}
    receipt_fields.update(profileVersionId={'type':'string','minLength':1,'maxLength':100},version={'type':'integer','minimum':2},status={'enum':['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled']},replayed={'type':'boolean'})
    schemas['SupportWorkflowReceipt']={'type':'object','additionalProperties':False,'properties':receipt_fields,'required':list(receipt_fields)}
    schemas['PublicWorkflowInteraction']={'type':'object','additionalProperties':False,'properties':{'action':{'enum':['request_customer','customer_reply','resolve']},'body':{'type':'string','minLength':1,'maxLength':12000},'version':{'type':'integer','minimum':2}},'required':['action','body','version']}
    schemas['ConsulteGeoConfigurationCommand']={'oneOf':[{'type':'object','additionalProperties':False,'properties':{'action':{'const':action},'entity_revision':{'type':'integer','minimum':0 if action=='save' else 1},'reason':{'type':'string','minLength':1,'maxLength':2000},**({'definition':{'type':'object','description':'Definição Consulte GEO validada pelo compilador M04.'}} if action=='save' else {'id':{'type':'string','format':'uuid'},'version':{'type':'integer','minimum':1}})},'required':['action','entity_revision','reason',*(['definition'] if action=='save' else ['id','version'])]} for action in ['save','publish','restore']]}
    schemas['ConsulteGeoConfigurationResult']={'type':'object','required':['revision'],'properties':{'revision':{'type':'integer','minimum':1},'record':{'type':'object'},'records':{'type':'array','maxItems':500,'items':{'type':'object'}},'replayed':{'type':'boolean'}},'description':'Estado/recibo administrativo M04, acessível somente com MFA e capability; nunca emitido ao solicitante.'}
    mark={'action':{'const':'mark'},'itemId':{'type':'string','maxLength':100},'status':{'enum':['done','not_applicable','pending']},'expectedTicketVersion':{'type':'integer','minimum':1},'expectedChecklistRevision':{'type':'integer','minimum':0},'evidenceRefs':{'type':'array','maxItems':100,'items':{'type':'string','maxLength':200}},'reason':{'type':['string','null'],'maxLength':2000},'acknowledgeRisk':{'type':'boolean'}}
    schemas['ExecutionChecklistMark']={'type':'object','additionalProperties':False,'properties':mark,'required':list(mark)}
    schemas['ExecutionChecklistEvidenceQuery']={'type':'object','additionalProperties':False,'properties':{'expectedTicketVersion':{'type':'integer','minimum':1},'expectedChecklistRevision':{'type':'integer','minimum':0},'before':{'oneOf':[{'type':'null'},{'type':'object','additionalProperties':False,'properties':{'id':{'type':'string','format':'uuid'},'at':{'type':'string','format':'date-time'}},'required':['id','at']}]}},'required':['expectedTicketVersion','expectedChecklistRevision','before']}
    schemas['ExecutionChecklistResult']={'type':'object','description':'Snapshot/recibo privado M03; revisão no ETag. Sem acesso público ou fallback de evidência.'}
    def operation(method,name,summary,response,parameters,request=None):
     op={'operationId':name,'summary':summary,'parameters':parameters,'security':[{'BearerAuth':[]}],'responses':{'200':{'description':'Operação concluída; no-store.','content':{'application/json':{'schema':ref(response)}}}}}
     for status in [400,401,403,404,409,412,413,415,428,429,503]:op['responses'][str(status)]={'description':'Requisição recusada ou confirmação indisponível.','content':{'application/problem+json':{'schema':ref('Problem')}}}
     if request:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
     return op
    base='/admin/consultegeo/configurations'
    s['paths'][base]={'get':operation('GET','listConsulteGeoConfigurations','Lista configurações com MFA e forms.read.','ConsulteGeoConfigurationResult',[]),'post':operation('POST','commandConsulteGeoConfiguration','Salva, publica ou restaura configuração com MFA e capability.','ConsulteGeoConfigurationResult',[pr('Origin'),pr('IfMatch'),pr('Idempotency')],'ConsulteGeoConfigurationCommand')}
    s['paths'][base]['post']['responses']['201']=s['paths'][base]['post']['responses']['200']
    s['paths'][base+'/{configuration_id}/versions/{version}']={'get':operation('GET','getConsulteGeoConfiguration','Consulta versão exata com MFA e forms.read.','ConsulteGeoConfigurationResult',[pr('ConfigurationId'),pr('ConfigurationVersion')])}
    s['paths']['/tickets/{ticket_id}/workflow-commands']={'post':operation('POST','commandSupportWorkflow','Comando nomeado no workflow publicado e escopo completo do chamado.','SupportWorkflowReceipt',[pr('TicketId'),pr('Origin'),pr('IfMatch'),pr('Idempotency')],'SupportWorkflowCommand')}
    base='/internal/tickets/{ticket_id}/execution-checklist'
    s['paths'][base]={'get':operation('GET','getExecutionChecklist','Leitura interna do checklist fixado no chamado.','ExecutionChecklistResult',[pr('TicketId')])}
    s['paths'][base+'/marks']={'post':operation('POST','markExecutionChecklist','Confirma execução e evidência sob revisão do checklist.','ExecutionChecklistResult',[pr('TicketId'),pr('Origin'),pr('ChecklistIfMatch'),pr('Idempotency')],'ExecutionChecklistMark')}
    s['paths'][base+'/evidence']={'post':operation('POST','queryExecutionChecklistEvidence','Consulta evidência interna com escopo e revisão atuais.','ExecutionChecklistResult',[pr('TicketId'),pr('Origin'),pr('ChecklistIfMatch')],'ExecutionChecklistEvidenceQuery')}
    # Use the actual existing security scheme rather than inventing a second bearer contract.
    scheme='bearerAuth'
    for path,methods in s['paths'].items():
     if 'consultegeo' in path or 'workflow-commands' in path or 'execution-checklist' in path:
      for op in methods.values():op['security']=[{scheme:[]}]
    cap=schemas['Capabilities'];cap.setdefault('properties',{})['consultegeo']={'type':'object','additionalProperties':False,'properties':{'source_ready':{'type':'boolean'},'origin_ready':{'type':'boolean'}},'required':['source_ready','origin_ready']}
    for name in ['consultegeo_configuration','support_workflow','execution_checklist']:cap['properties']['capabilities'].setdefault('properties',{})[name]={'type':'boolean'}
    # M09b publishes catalogue and durable drafts only; no submission contract yet.
    uuid={'type':'string','format':'uuid'}
    resource={'type':'object','additionalProperties':False,'properties':{'connectionId':uuid,'tenantId':{'type':'string','minLength':1,'maxLength':256},'type':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,31}$'},'id':{'type':'string','minLength':1,'maxLength':256}},'required':['connectionId','tenantId','type','id']}
    refs={'type':'array','minItems':1,'maxItems':100,'uniqueItems':True,'items':resource,'description':'Seletores opacos de um único contexto. Não concedem acesso.'}
    schemas['ConsulteGeoCatalogQuery']={'type':'object','additionalProperties':False,'properties':{'service':{'enum':['user_access','questions','backup','new_work','structure_adjustment','problem']},'refs':refs},'required':['service','refs']}
    schemas['ConsulteGeoCustomerConfiguration']={'type':'object','additionalProperties':False,'properties':{'schema':{'const':1},'product':{'const':'CONSULTE_GEO'},'id':uuid,'version':{'type':'integer','minimum':1},'contentHash':{'type':'string','pattern':'^[a-f0-9]{64}$'},'service':schemas['ConsulteGeoCatalogQuery']['properties']['service'],'title':{'type':'string','minLength':1,'maxLength':200},'entries':{'type':'array','minItems':1,'maxItems':5,'items':{'type':'object','description':'Ação/prioridade/label, form público publicado e serviceWindow. Sem checklist/capabilities/dados internos.'}}},'required':['schema','product','id','version','contentHash','service','title','entries']}
    context_fields={k:uuid for k in ['workspaceId','principalId','accountId']};context_fields.update(refs=refs,coverageId={'type':['string','null'],'format':'uuid','description':'Ainda não selecionada nesta etapa.'})
    schemas['ConsulteGeoCatalogResult']={'type':'object','additionalProperties':False,'properties':{'schema':{'const':1},'context':{'type':'object','additionalProperties':False,'properties':context_fields,'required':list(context_fields)},'configurations':{'type':'array','maxItems':20,'items':ref('ConsulteGeoCustomerConfiguration')}},'required':['schema','context','configurations']}
    draft_fields={k:uuid for k in ['id','accountId','formId']};draft_fields.update(refs=refs,formVersion={'type':'integer','minimum':1,'maximum':2147483647},answers={'type':'object','description':'Respostas incompletas comuns permitidas; nunca conferem aptidão para envio.'})
    schemas['ConsulteGeoDraftInput']={'type':'object','additionalProperties':False,'properties':draft_fields,'required':list(draft_fields)}
    result_fields={**draft_fields,'revision':{'type':'integer','minimum':1},'expiresAt':{'type':'string','format':'date-time'},'status':{'const':'editing'},'ticketId':{'type':'null'}}
    schemas['ConsulteGeoDraft']={'type':'object','additionalProperties':False,'properties':result_fields,'required':list(result_fields)}
    params['FormDraftId']={'in':'path','name':'draft_id','required':True,'schema':uuid}
    base='/consultegeo/request-catalog'
    s['paths'][base]={'post':operation('POST','queryConsulteGeoRequestCatalog','Consulta formulários públicos após autorização da pessoa, conta, produto e todas as obras.','ConsulteGeoCatalogResult',[pr('Origin')],'ConsulteGeoCatalogQuery')}
    base='/form-drafts/{draft_id}'
    s['paths'][base]={'get':operation('GET','getConsulteGeoFormDraft','Retoma rascunho próprio com fonte atual.','ConsulteGeoDraft',[pr('FormDraftId')]),'put':operation('PUT','saveConsulteGeoFormDraft','Salva respostas sob CAS; replay da mesma intenção não cria nova revisão.','ConsulteGeoDraft',[pr('FormDraftId'),pr('Origin'),pr('ChecklistIfMatch')],'ConsulteGeoDraftInput')}
    for path in ['/consultegeo/request-catalog',base]:
     for op in s['paths'][path].values():op['security']=[{'bearerAuth':[]}]
    for op in s['paths'][base].values():op['responses']['200']['headers']={'ETag':{'schema':{'type':'string','pattern':'^"[1-9][0-9]*"$'}}}
    for name in ['consultegeo_request_catalog','form_drafts','support_requests']:cap['properties']['capabilities'].setdefault('properties',{})[name]={'type':'boolean'}
