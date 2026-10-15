"""Add the prepared E06 contract without rebuilding unrelated API operations."""
import json
from pathlib import Path

def extend_registration_review(s):
    schemas=s['components']['schemas']
    ref=lambda name:{'$ref':'#/components/schemas/'+name}
    pr=lambda name:{'$ref':'#/components/parameters/'+name}
    uuid={'type':'string','format':'uuid'}
    cap=schemas['Capabilities']
    def operation(method,name,summary,response,parameters):
        op={'operationId':name,'summary':summary,'parameters':parameters,'security':[{'bearerAuth':[]}],'responses':{'200':{'description':'Consulta autorizada; no-store.','content':{'application/json':{'schema':ref(response)}}}}}
        for status in [400,401,403,404,409,429,503]:
            op['responses'][str(status)]={'description':'Consulta recusada ou indisponível.','content':{'application/json':{'schema':ref('Problem')}}}
        return op
    # Prepared E06 routes are mounted with a closed server qualification flag.
    # No environment setting can qualify or install HDA persistence.
    review_field={'type':'object','additionalProperties':False,'properties':{'key':{'type':'string'},'label':{'type':'string'},'value':{'type':'string','maxLength':1024},'truncated':{'type':'boolean'}},'required':['key','label','value','truncated']}
    schemas['RegistrationReviewField']=review_field
    caps={'edit':{'const':False},'approve':{'const':False},'execute':{'const':False}}
    schemas['RegistrationReviewCapabilities']={'type':'object','additionalProperties':False,'properties':caps,'required':list(caps)}
    detail={k:{'type':'array','maxItems':128,'items':ref('RegistrationReviewField')} for k in ['requested','targets','proposal']}
    detail.update(effects={'type':'array','items':{'type':'string'}},blockers={'type':'array','items':{'type':'string'}},draftRevision={'type':'integer','minimum':0},draftHash={'type':['string','null'],'pattern':'^[a-f0-9]{64}$'},historyLoaded={'const':False})
    schemas['RegistrationReviewDetail']={'type':'object','additionalProperties':False,'properties':detail,'required':list(detail)}
    context={k:uuid for k in ['workspaceId','accountId','ticketId','operationId']}
    common={'schema':{'const':1},'context':{'type':'object','additionalProperties':False,'properties':context,'required':list(context)},'revision':{'type':'integer','minimum':1},'inputRevision':{'type':'integer','minimum':1},'status':{'enum':['queued_analysis','analyzing','draft_ready','needs_information','manual_review','analysis_failed','cancelled']},'observedAt':{'type':'string','format':'date-time'},'expiresAt':{'type':'string','format':'date-time'},'capabilities':ref('RegistrationReviewCapabilities')}
    for audience,name in [('customer','RegistrationReviewCustomer'),('internal','RegistrationReviewInternal')]:
     fields={**common,'audience':{'const':audience},'detail':{'type':'null'} if audience=='customer' else ref('RegistrationReviewDetail')}
     schemas[name]={'type':'object','additionalProperties':False,'properties':fields,'required':list(fields)}
     path=('/internal' if audience=='internal' else '')+'/tickets/{ticket_id}/registration-review'
     op=operation('GET','getRegistrationReview'+audience.title(),'Consulta preparada da automação de cadastro; desabilitada até qualificação HDA.','RegistrationReviewCustomer' if audience=='customer' else 'RegistrationReviewInternal',[pr('Workspace'),pr('TicketId')])
     op['security']=[{'bearerAuth':[]}];op['x-status']='prepared/gated'
     op['description']='Flag de servidor ausente/false em produção: 503 antes de autenticação e SQL. Após qualificação formal, consulta transacional com ACL atual da conta, chamado, todas as obras e grant HDA. Visibilidade fixa pela rota; nenhum parâmetro audience, bindingId ou operationId é aceito. A rota interna exige operador atual no banco. Não aceita corpo nem query string. Sem edição, aprovação, execução, ledger, fila ou histórico inventado; janela máxima de observação de 60 segundos.'
     op['responses']['503']['description']='Consulta preparada, bloqueada por qualificação ou persistência HDA indisponível. Não representa rascunho ausente.'
     op['responses']['404']['description']='Sem operação persistida visível; nenhum rascunho é fabricado.'
     s['paths'][path]={'get':op}
    cap['properties']['capabilities'].setdefault('properties',{})['registration_review']={'type':'boolean','default':False,'description':'False em produção até promoção formal de HDA e qualificação da montagem.'}

if __name__=='__main__':
    path=Path(__file__).resolve().parents[1]/'docs/openapi.json'
    spec=json.loads(path.read_text(encoding='utf-8'))
    extend_registration_review(spec)
    path.write_bytes((json.dumps(spec,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
