"""Response headers for implemented core receipts and access operations."""
def extend_response_headers(spec):
    operations=[('/tickets','post',['200','201'],True,True),
                ('/tickets/{ticket_id}','get',['200'],True,False),
                ('/tickets/{ticket_id}','patch',['200'],True,False),
                ('/tickets/{ticket_id}/assignments','post',['200'],True,False),
                ('/tickets/{ticket_id}/transitions','post',['200'],True,False),
                ('/tickets/{ticket_id}/messages','post',['200','201'],False,False),
                ('/tickets/{ticket_id}/notes','post',['200','201'],False,False)]
    for path,method,statuses,version,location in operations:
        for status in statuses:
            headers=spec['paths'][path][method]['responses'][status].setdefault('headers',{})
            if method!='get':
                headers['Idempotency-Replayed']={**headers['Idempotency-Replayed'],'required':True}
            if version:
                headers['ETag']={'required':True,'schema':{'type':'string','pattern':'^"[1-9][0-9]*"$'},'description':'Versão atual entre aspas.' if method=='get' else 'Versão do recibo original; pode ser histórica em replay.'}
            if location:
                headers['Location']={'required':True,'schema':{'type':'string','pattern':'^/v1/tickets/[A-Za-z0-9][A-Za-z0-9_-]{0,99}$'},'description':'Caminho relativo do chamado criado, preservado em replay.'}

    # These routes precede selected-workspace/business authorization. Keep their
    # declarations scoped; this does not mount a capability or change admission.
    from copy import deepcopy
    access_headers={
        'AccessNoStore':{'required':True,'schema':{'type':'string','const':'no-store'}},
        'AccessNoSniff':{'required':True,'schema':{'type':'string','const':'nosniff'}},
        'AccessNoReferrer':{'required':True,'schema':{'type':'string','const':'no-referrer'}},
        'AccessRequestId':{'required':True,'schema':{'type':'string','format':'uuid','pattern':'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'}},
        'AccessUnavailableRetryAfter':{'required':True,'schema':{'type':'string','const':'2'}}
    }
    spec['components'].setdefault('headers',{}).update(access_headers)
    privacy={'Cache-Control':'AccessNoStore','X-Content-Type-Options':'AccessNoSniff',
             'Referrer-Policy':'AccessNoReferrer','X-Request-Id':'AccessRequestId'}
    for path,method in [('/workspaces','get'),('/integration-tokens','post'),('/integration-tokens/current','delete')]:
        responses=spec['paths'][path][method]['responses']
        if '503' not in responses:
            responses['503']=deepcopy(responses['default'])
            responses['503']['description']='Serviço temporariamente indisponível; não confirma sessão ou encerramento.'
        for status,response in responses.items():
            headers=response.setdefault('headers',{})
            headers.update({name:{'$ref':'#/components/headers/'+target} for name,target in privacy.items()})
            if status=='429':
                headers['Retry-After']={'required':True,'schema':{'type':'integer','minimum':1,'maximum':60}}
            if status=='503':
                headers['Retry-After']={'$ref':'#/components/headers/AccessUnavailableRetryAfter'}
    spec['components']['schemas']['WorkspacePage']['properties']['items']['maxItems']=50
