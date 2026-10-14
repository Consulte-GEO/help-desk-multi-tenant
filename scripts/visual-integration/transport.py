"""Test transport only. Synthetic HTTP responses only. Offline module-URL adaptation lives in runtime.py.
No application-state substitute, external API call or real credential.
"""
import base64,copy,json,mimetypes,time
from pathlib import Path
from urllib.parse import urlsplit,parse_qs

ORIGIN='https://helpdesk.example.test'
AUTH='https://fixtureproject.supabase.co'
def uid(n): return '00000000-0000-4000-8000-'+str(n).zfill(12)
def jwt(n):
 def enc(v):return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid(n),'aal':'aal1','exp':int(time.time())+3600})+'.synthetic_signature_not_a_credential'
AT='2026-10-13T12:00:00.000Z'

class Transport:
 def __init__(self,repo,operational=True,team=True):
  self.repo=Path(repo);self.operational=operational;self.team=team;self.calls=[];self.assets=[];self.missing=[]
  self.me_id=uid(2);self.auth_error=None;self.workspaces=1;self.me_error=None;self.notes_error=False
  self.ambiguous=False;self.lost_create=False;self.lost_message=False;self.reject_priority=False
  self.fail_detail_status=403;self.fail_detail=set();self.fail_list=False;self.fail_refresh=False;self.extra_factors=[];self.deferred={};self.block={};self.create_intents={};self.message_intents={}
  self.tickets=[self.ticket(11,'Não consigo concluir a aprovação', 'Ao aprovar a concretagem, a tela apresenta um aviso. Preciso de orientação.'), self.ticket(12,'Resultado do ensaio não aparece','O resultado lançado não aparece no relatório autorizado.')]
  self.messages={t['id']:[{'id':uid(100+i),'ticket_id':t['id'],'body':'Olá! Conte-nos o que aconteceu.','actor_type':'human_agent','created_at':AT}] for i,t in enumerate(self.tickets)}
  self.notes={t['id']:[{'id':uid(200+i),'ticket_id':t['id'],'body':'Nota interna sintética: conferência da equipe.','created_at':AT}] for i,t in enumerate(self.tickets)}
 def ticket(self,n,subject,description):
  return dict(id=uid(n),account_id=uid(3),product_instance_id=uid(4),service_code='support',subject=subject,description=description,priority='normal',status='received',version=1,coverage_id=uid(5),contract_version_id=uid(6),created_at=AT,updated_at=AT)
 def projected(self,t,detail=False):
  x=copy.deepcopy(t)
  if self.team:
   x['internal_status']='new' if x['status']=='received' else 'open'
   x['assignment']={'state':'unassigned','can_claim':True,'can_release':False}
  if detail:x['available_actions']={'ticket_id':x['id'],'version':x['version'],'reply':True,'read_notes':self.team,'add_note':self.team,'change_priority':self.team,'claim':self.team,'release':False,'transitions':[{'to':'open','requires_reason':False}] if self.team else []}
  return x
 def answer(self,route,data=None,status=200,headers=None):
  route.fulfill(status=status,body='' if status==204 else json.dumps(data,ensure_ascii=False),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,**(headers or {})})
 def deny(self,route,status=503,code='fixture_unavailable'):
  self.answer(route,{'status':status,'code':code,'detail':'Solicitação não confirmada no cenário de teste.'},status)
 def release(self,key):
  deferred=self.deferred.pop(key,[]);self.block.pop(key,None)
  for route in deferred:self.dispatch(route,skip_block=True)
 def dispatch(self,route,skip_block=False):
  req=route.request;u=urlsplit(req.url);path=u.path;method=req.method;query=parse_qs(u.query)
  # Every request is intercepted. Nothing contacts a provider or production.
  if req.url.startswith(ORIGIN) and (path=='/' or path.endswith(('.js','.css','.png'))):
   file=self.repo/('shared/'+path[len('/shared/'):] if path.startswith('/shared/') else 'web/'+('index.html' if path=='/' else path.lstrip('/')))
   if not file.is_file():self.missing.append(path);route.fulfill(status=404,body='Fixture asset missing');return
   mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'}[file.suffix]
   self.assets.append({'path':path,'mime':mime,'bytes':file.stat().st_size});route.fulfill(status=200,body=file.read_bytes(),headers={'Content-Type':mime,'X-Content-Type-Options':'nosniff'});return
  if not skip_block:
   self.calls.append({'path':path,'query':query,'method':method,'body':req.post_data,'headers':{k:v for k,v in req.headers.items() if k in ['idempotency-key','if-match','x-workspace-id']}})
   for key,prefix in self.block.items():
    if path.startswith(prefix):self.deferred.setdefault(key,[]).append(route);return
  if method=='OPTIONS':route.fulfill(status=204,headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return
  if path=='/demo-config':self.answer(route,{},404);return
  if path=='/v1/public-config':self.answer(route,{'supabase_url':AUTH,'publishable_key':'sb_publishable_synthetic_not_real','operational':self.operational});return
  if path=='/auth/v1/token':
   if self.auth_error:self.deny(route,self.auth_error,'login_failed');return
   if query.get('grant_type')==['refresh_token'] and self.fail_refresh:self.deny(route);return
   self.answer(route,{'token_type':'bearer','access_token':jwt(int(self.me_id[-12:])),'refresh_token':'synthetic_refresh_never_valid','expires_in':3600,'user':{'id':self.me_id,'factors':self.extra_factors}});return
  if path=='/auth/v1/logout':self.answer(route,status=204);return
  if path=='/v1/workspaces':self.answer(route,{'items':[{'id':uid(1+i),'name':'Operação de teste '+str(i+1)} for i in range(self.workspaces)]});return
  if path=='/v1/me':
   if self.me_error:self.deny(route,self.me_error);return
   self.answer(route,{'id':self.me_id,'kind':'human','workspace_role':'admin' if self.team else 'customer','grants':[{'role':'agent' if self.team else 'customer'}]});return
  if path=='/v1/support-contexts':self.answer(route,{'items':[{'account_id':uid(3),'account_name':'Cliente fictício','product_instance_id':uid(4),'product_name':'Consulte GEO','environment':'production','service_code':'support','service_name':'Suporte'}],'next_cursor':None});return
  if path=='/v1/contexts/resolve':
   self.answer(route,{'status':'ambiguous','candidates':[{'coverage_id':uid(5),'contract_id':uid(6),'contract_version':1},{'coverage_id':uid(7),'contract_id':uid(8),'contract_version':2}]} if self.ambiguous else {'status':'resolved'});return
  if path=='/v1/tickets' and method=='GET':
   if self.fail_list:self.deny(route);return
   items=self.tickets
   if query.get('q'):items=[t for t in items if query['q'][0].casefold() in t['subject'].casefold()]
   if query.get('status'):items=[t for t in items if t['status']==query['status'][0]]
   if query.get('priority'):items=[t for t in items if t['priority']==query['priority'][0]]
   self.answer(route,{'items':[self.projected(t) for t in items],'next_cursor':None});return
  if path=='/v1/tickets' and method=='POST':
   key=req.headers.get('idempotency-key');payload=req.post_data_json
   if key not in self.create_intents:
    t=self.ticket(30+len(self.create_intents),payload['subject'],payload['description']);t.update(payload);self.tickets.insert(0,t);self.create_intents[key]=copy.deepcopy(self.projected(t));self.messages[t['id']]=[];self.notes[t['id']]=[]
   if self.lost_create:self.lost_create=False;self.deny(route);return
   self.answer(route,self.create_intents[key]);return
  if path.startswith('/v1/tickets/'):
   bits=path.split('/');tid=bits[3];tail='/'.join(bits[4:]);t=next((t for t in self.tickets if t['id']==tid),None)
   if not t:self.deny(route,404);return
   if not tail and method=='GET':
    if tid in self.fail_detail:self.deny(route,self.fail_detail_status);return
    self.answer(route,self.projected(t,True));return
   if not tail and method=='PATCH':
    if self.reject_priority:self.deny(route,412,'version_conflict');return
    t['priority']=req.post_data_json['priority'];t['version']+=1;self.answer(route,self.projected(t,True));return
   if tail in ['messages','notes']:
    if tail=='notes' and self.notes_error:self.deny(route,403);return
    collection=self.messages if tail=='messages' else self.notes
    if method=='POST':
     key=req.headers.get('idempotency-key')
     if key not in self.message_intents:
      msg={'id':uid(500+len(self.message_intents)),'ticket_id':tid,'created_at':AT,'body':req.post_data_json['body']}
      if tail=='messages':msg['actor_type']='human_agent' if self.team else 'customer'
      collection[tid].append(msg);self.message_intents[key]=msg
     if self.lost_message:self.lost_message=False;self.deny(route);return
     self.answer(route,self.message_intents[key]);return
    self.answer(route,{'items':collection[tid],'next_cursor':None});return
   if tail=='timeline':self.answer(route,{'items':[{'id':uid(700),'type':'ticket.created','created_at':AT,'data':{}}],'next_cursor':None});return
   if tail=='transitions':t['status']='in_progress';t['version']+=1;self.answer(route,self.projected(t,True));return
   if tail=='assignments':self.answer(route,{});return
  self.missing.append(method+' '+req.url);self.deny(route,404)
