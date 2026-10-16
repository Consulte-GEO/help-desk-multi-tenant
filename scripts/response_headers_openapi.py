"""Response header declarations for the implemented core receipts only."""
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
