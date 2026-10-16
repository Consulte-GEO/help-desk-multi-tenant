"""Add only the implemented, gated summary contract; preserve existing operations."""
from copy import deepcopy

def extend_ticket_summary(api):
    schemas=api['components']['schemas']
    count={'type':'integer','minimum':0,'maximum':9007199254740991}
    statuses=['received','in_progress','waiting_for_you','resolved','closed']
    schemas['TicketSummary']={'type':'object','additionalProperties':False,'required':['as_of','total','statuses'],'properties':{
        'as_of':{'type':'string','format':'date-time','description':'Instante UTC do servidor após a consulta. Não representa snapshot conjunto com a lista.'},
        'total':count,
        'statuses':{'type':'object','additionalProperties':False,'required':statuses,'properties':{k:deepcopy(count) for k in statuses}}},
        'description':'Inteiros seguros não negativos; soma dos estados deve ser igual ao total. Estados internos agrupados conforme a situação pública existente.'}
    listing=api['paths']['/tickets']['get']
    api['paths']['/tickets/summary']={'get':{
        'operationId':'summarizeTickets','summary':'Totais completos da consulta autorizada, antes da paginação.',
        'description':'Requer tickets:read e capacidade ticket_totals na composição local Consulte GEO. Mesmos filtros, identidade, RLS, obras atuais e namespace da lista; responsabilidade exige operador. Não aceita limit/cursor, parâmetros desconhecidos/duplicados ou corpo. Sem cache ou conteúdo de mensagens/notas. Indisponibilidade ou resultado inválido é503, nunca zero presumido. A lista e o resumo são consultas independentes.',
        'security':deepcopy(listing['security']),
        'parameters':[deepcopy(p) for p in listing['parameters'] if p.get('name') not in ['limit','cursor']],
        'responses':{'200':{'description':'Resumo autorizado; no-store.','headers':{'Cache-Control':{'schema':{'const':'no-store'}}},'content':{'application/json':{'schema':{'$ref':'#/components/schemas/TicketSummary'}}}},
            **{str(code):{'description':'Consulta recusada ou indisponível.','content':{'application/problem+json':{'schema':{'$ref':'#/components/schemas/Problem'}}}} for code in [400,401,403,404,405,408,429,503]}}}}
    schemas['PublicConfig']['properties']['ticket_totals']={'type':'boolean','description':'True somente quando a consulta local de totais está montada; não concede acesso.'}

if __name__=='__main__':
    import json
    from pathlib import Path
    target=Path(__file__).resolve().parents[1]/'docs/openapi.json'
    api=json.loads(target.read_text(encoding='utf-8'))
    extend_ticket_summary(api)
    target.write_bytes((json.dumps(api,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
