#!/usr/bin/env python3
"""UX03 focused native Chromium bench. Actual DOM/ES modules and shared form parser.
Opening callbacks are synthetic; no app.js, Auth, HTTP, CSP or PostgreSQL E2E.
"""
from __future__ import annotations
import argparse,base64,json,re,shutil,sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from visual_fixture_html import without_scripts
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True);p.add_argument('--web-root',type=Path,default=HERE.parents[1]/'web')
p.add_argument('--suite',choices=['dynamic','opening','all'],default='all');p.add_argument('--baseline',action='store_true')
a=p.parse_args();root=a.web_root.resolve();repo=root.parent;a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];cache={}
def ck(name,ok,details=None):
 checks.append({'name':name,'passed':bool(ok),'details':details})
 if not ok:print('FAIL',name,details)
def data_url(source):return 'data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
def module_url(file):
 file=file.resolve()
 if file not in cache:
  s=file.read_text()
  def sub(m):return m.group(1)+repr(module_url(file.parent/m.group(3)))
  s=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",sub,s)
  cache[file]=data_url(s)
 return cache[file]
def css_files(names):return '\n'.join(re.sub(r'@import[^;]+;','',(root/f).read_text()) for f in names if (root/f).exists())
def dynamic_setup(page):
 css=css_files(['styles.css','design-tokens.css','consulte-theme.css','dynamic-form.css','form-experience.css'])
 page.set_content('<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="hd-ui"><main style="max-width:860px;margin:auto;padding:16px"><h1>Solicitação de suporte</h1><button id="outside" type="button" class="secondary">Fora do formulário</button><section id="dynamic"></section><button id="validate" type="button" class="primary">Conferir dados</button></main></body></html>')
 page.add_script_tag(type='module',content=f"import {{mountDynamicForm}} from {repr(module_url(root/'dynamic-form.js'))};\n"+'''
const field=(key,type='text',required=true,config={maxLength:80},isPublic=true)=>({key,type,label:({name:'Nome do solicitante',flag:'Você já tentou novamente?',trigger:'Detalhar quando escrever sim',conditional:'Descrição complementar',rows:'Participantes',table:'Dados em tabela',ref:'Referência autorizada',files:'Arquivos de evidência',choices:'Canais de retorno'})[key]??key,required,public:isPublic,config});
window.SCHEMA={id:'support-request',version:1,status:'published',title:'Dados da solicitação',fields:[field('name'),field('flag','boolean',true,{}),field('trigger','text',false),{...field('conditional','text',true),when:{field:'trigger',equals:'sim'}},field('private','text',false,{maxLength:80},false),field('rows-0-name','text',false),field('rows','repeater',true,{minRows:1,maxRows:2,fields:[field('name')]}),field('choices','multiselect',true,{maxItems:2,options:[{value:'email',label:'E-mail'},{value:'portal',label:'Portal'}]}),field('table','table_paste',false,{minRows:0,maxRows:2,fields:[field('label'),field('quantity','integer',true,{min:'1',max:'10'})]}),field('ref','lookup',false,{resolver:'authorized'}),field('files','file',false,{maxItems:2})]};
window.mountTest=(answers={})=>{window.FORM?.destroy();window.FORM=mountDynamicForm(document.getElementById('dynamic'),{schema:SCHEMA,answers,chooseLookup:()=>new Promise(resolve=>window.LOOKUP_DONE=resolve),chooseFiles:async()=>['fixture-file']});};
mountTest();document.getElementById('validate').onclick=()=>FORM.validate({focus:true});
''');page.wait_for_function('!!window.FORM')
def dynamic_tests(page):
 dynamic_setup(page)
 ck('client never receives internal field in DOM',page.locator('[data-field="private"]').count()==0)
 page.locator('[data-field="trigger"]').focus();page.locator('[data-field="trigger"]').press_sequentially('sim',delay=10)
 ck('conditional edit preserves typed text and caret',page.locator('[data-field="trigger"]').input_value()=='sim' and page.evaluate('document.activeElement.getAttribute("data-field")')=='trigger')
 page.evaluate('FORM.validate()')
 has_summary=page.locator('.hd-form-errors').count()>0
 ck('human error summary is rendered',has_summary)
 ck('boolean allows an explicit false distinct from absence',page.locator('select[data-field="flag"]').count()==1)
 page.evaluate('FORM.addRow("rows")')
 ids=page.locator('#dynamic [id]').evaluate_all('(nodes)=>nodes.map(n=>n.id)');ck('generated field IDs are unique even with colliding key spelling',len(ids)==len(set(ids)))
 if a.baseline:return
 if not has_summary:return
 page.evaluate('mountTest()');page.locator('#validate').click()
 ck('explicit validation focuses summary',page.evaluate('document.activeElement.classList.contains("hd-form-errors")'))
 ck('invalid control receives aria-invalid',page.get_attribute('[data-field="name"]','aria-invalid')=='true')
 desc=page.get_attribute('[data-field="name"]','aria-describedby') or ''
 ck('error and help references resolve',bool(desc) and page.evaluate('(ids)=>ids.every(id=>!!document.getElementById(id))',desc.split()))
 page.locator('.hd-form-errors button').filter(has_text='Nome do solicitante').first.click()
 ck('summary link focuses invalid input',page.evaluate('document.activeElement.getAttribute("data-field")')=='name')
 page.locator('[data-field="name"]').fill('Cliente fictício');page.locator('select[data-field="flag"]').select_option('false')
 page.locator('[data-form-add="rows"]').click();page.locator('[data-field="rows.0.name"]').fill('Pessoa de teste')
 page.locator('[data-field="choices:email"]').check()
 ck('required boolean false is valid with other required answers',page.evaluate('FORM.validate().valid'))
 ck('false is kept as boolean payload, not string',page.evaluate('FORM.draftAnswers().flag === false'))
 page.locator('[data-field="name"]').fill('Nome atualizado');ck('caret remains stable on ordinary typing',page.evaluate('document.activeElement.getAttribute("data-field")')=='name')
 page.locator('[data-field="trigger"]').focus();page.locator('[data-field="trigger"]').press_sequentially('sim',delay=10)
 ck('conditional field becomes available',page.locator('[data-field="conditional"]').count()==1)
 page.locator('[data-field="conditional"]').fill('Dado condicional temporário');page.locator('[data-field="trigger"]').fill('nao')
 ck('hidden field is removed and its answer cleared',page.locator('[data-field="conditional"]').count()==0 and page.evaluate('!("conditional" in FORM.draftAnswers())'))
 page.locator('[data-form-add="rows"]').click()
 ck('added row receives focus',page.evaluate('document.activeElement.getAttribute("data-field")')=='rows.1.name')
 ck('row limit is visible and add button is disabled',page.locator('[data-form-add="rows"]').is_disabled() and '2 de 2' in page.locator('[data-form-group="rows"]').inner_text())
 page.locator('[data-field="rows.1.name"]').fill('Segunda pessoa');page.locator('[data-form-remove="rows.1"]').click()
 ck('remove retains other row answer',page.locator('[data-field="rows.0.name"]').input_value()=='Pessoa de teste')
 ck('remove returns focus to a remaining actionable field',page.evaluate('document.activeElement.getAttribute("data-field")')=='rows.0.name')
 page.locator('[data-field="table:paste"]').fill('label\tquantity\nMaterial\t2');page.locator('[data-form-paste="table"]').click()
 ck('paste uses original bounded parser and normalized values',page.evaluate('FORM.draftAnswers().table[0].quantity === "2"'))
 page.locator('[data-field="table:paste"]').fill('bad\tcolumns\nx\t2');page.locator('[data-form-paste="table"]').click()
 ck('invalid paste preserves prior table data and pasted text',page.evaluate('FORM.draftAnswers().table[0].label === "Material"') and page.locator('[data-field="table:paste"]').input_value()=='bad\tcolumns\nx\t2')
 ck('paste rejection has an accessible field-level error',page.get_attribute('[data-field="table:paste"]','aria-invalid')=='true')
 page.locator('[data-field="rows.0.name"]').fill('');page.evaluate('FORM.validate()')
 ck('nested error uses human row label', 'Participantes / Linha 1 / Nome do solicitante' in page.locator('.hd-form-errors').inner_text())
 page.locator('.hd-form-errors button').filter(has_text='Participantes / Linha 1').click();ck('nested error focuses exact row input',page.evaluate('document.activeElement.getAttribute("data-field")')=='rows.0.name')
 page.locator('[data-field="rows.0.name"]').fill('Restaurado')
 page.evaluate('()=>{window.LOOKUP_TASK=FORM.choose("ref");}');page.locator('#outside').focus();page.evaluate('LOOKUP_DONE("scoped-reference")');page.wait_for_timeout(50)
 ck('async lookup does not take focus from outside',page.evaluate('document.activeElement.id')=='outside')
 ck('lookup is still only a reference, never commit authorization',page.evaluate('FORM.snapshot().commitAuthorized===false && FORM.draftAnswers().ref==="scoped-reference"'))
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'dynamic reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   ck(f'dynamic accessible input height {width}/{theme}',page.locator('[data-field="name"]').bounding_box()['height']>=44)
   if width in [390,1440]:page.screenshot(path=str(a.output/f'dynamic-{width}-{theme}.png'),full_page=True)
 page.evaluate('window.LOOKUP_TASK=FORM.choose("ref");FORM.setAudience("internal");LOOKUP_DONE("stale-value")');page.wait_for_timeout(40)
 ck('audience change rejects stale lookup and clears old answers',page.evaluate('!FORM.draftAnswers().ref && !FORM.draftAnswers().name'))
 ck('internal field mounts only for explicit internal audience',page.locator('[data-field="private"]').count()==1)
 page.evaluate('FORM.setAudience("customer")');ck('switching back removes internal DOM',page.locator('[data-field="private"]').count()==0)
 page.evaluate('window.LOOKUP_TASK=FORM.choose("ref");FORM.destroy();LOOKUP_DONE("after-destroy")');page.wait_for_timeout(40)
 ck('destroy removes content and prevents late reply from reviving it',page.locator('#dynamic').inner_text()=='')

def opening_setup(page):
 html=without_scripts((root/'index.html').read_text());html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I)
 css=css_files(['styles.css','design-tokens.css','consulte-theme.css','inbox-workspace.css','form-experience.css'])
 page.set_content(html.replace('</head>','<style>'+css+'</style></head>'),wait_until='domcontentloaded')
 page.add_script_tag(type='module',content=f"import {{mountOpeningWizard}} from {repr(module_url(root/'opening-wizard.js'))};\nimport {{createTicketCreateState,retryCreateIntent}} from {repr(module_url(root/'ticket-create-state.js'))};\n"+'''
const $=id=>document.getElementById(id);
window.ORIGINAL=Object.fromEntries(['context-choice','subject','description','priority','coverage-choice','submit-create','create-form'].map(id=>[id,$(id)]));
window.RUNTIME={status:'loading',canSubmit:false,pending:false,unresolved:false,ambiguous:false};window.SENDS=[];
window.CREATION=createTicketCreateState(()=> 'fixture-intent-original');const who={workspace:'fixture-workspace',principal:'fixture-principal',session:1};CREATION.reset(who);
window.OPENING=mountOpeningWizard(document);
window.UPDATE=part=>{RUNTIME={...RUNTIME,...part};$('context-choice').disabled=RUNTIME.status!=='ready'||RUNTIME.pending||RUNTIME.unresolved;
 for(const id of ['subject','description','priority','coverage-choice'])$(id).disabled=RUNTIME.pending||RUNTIME.unresolved;
 $('submit-create').disabled=(!RUNTIME.canSubmit&&!RUNTIME.unresolved)||RUNTIME.pending;$('submit-create').textContent=RUNTIME.unresolved?'Recuperar abertura':'Validar e abrir chamado';$('coverage-label').hidden=!RUNTIME.ambiguous;OPENING.update(RUNTIME);};
window.READY=()=>{const option=document.createElement('option');option.value='fixture-context';option.textContent='Conta fictícia · Novo Consulte GEO · Suporte';$('context-choice').replaceChildren(option);UPDATE({status:'ready',canSubmit:true});};
window.SHOW=()=>{$('create-dialog').showModal();OPENING.open();};
$('create-form').onsubmit=event=>{event.preventDefault();if(CREATION.busy())return;if(!CREATION.intent())CREATION.prepare({account_id:'fixture-account',product_instance_id:'fixture-instance',service_code:'support',subject:$('subject').value.trim(),description:$('description').value.trim(),priority:$('priority').value,...(RUNTIME.ambiguous?{coverage_id:$('coverage-choice').value}:{})});window.OP=CREATION.begin();if(!OP)return;SENDS.push(retryCreateIntent(OP,who));UPDATE({pending:true,unresolved:true});};
$('close-dialog').onclick=()=>$('create-dialog').close();$('cancel-create').onclick=()=>$('create-dialog').close();
window.UNCERTAIN=()=>{CREATION.fail(OP);UPDATE({pending:false,unresolved:true});};
UPDATE({});SHOW();
''');page.wait_for_function('!!window.OPENING')
def opening_tests(page):
 if not (root/'opening-wizard.js').exists():ck('opening native module exists',False);return
 opening_setup(page)
 ck('guided opening mounts without changing original controls',page.evaluate('Object.entries(ORIGINAL).every(([id,n])=>document.getElementById(id)===n)'))
 ck('catalog step visible and review submit hidden',page.locator('#hd-opening-step-1').is_visible() and page.locator('#submit-create').is_hidden())
 ck('catalog loading cannot advance',page.locator('#hd-opening-next').is_disabled())
 for state in ['empty','error']:
  page.evaluate('(s)=>UPDATE({status:s,canSubmit:false})',state);ck('catalog '+state+' cannot advance',page.locator('#hd-opening-next').is_disabled())
 page.evaluate('READY()');page.locator('#context-choice').press('Enter')
 # Native Enter on a select need not submit on every platform; explicitly submit the form.
 page.evaluate('document.getElementById("create-form").requestSubmit()')
 ck('Enter/submit on context advances, not writes',page.locator('#hd-opening-step-2').is_visible() and page.evaluate('SENDS.length')==0)
 page.locator('#subject').focus();page.evaluate('UPDATE({status:"error",canSubmit:false})')
 ck('catalog refusal moves focus out of newly hidden detail step',page.evaluate('document.activeElement.id')=='hd-opening-title-1')
 page.evaluate('READY();document.getElementById("create-form").requestSubmit()')
 page.locator('#subject').fill('   ');page.locator('#hd-opening-next').click()
 ck('invalid fields prevent review and show summary',page.locator('#hd-opening-errors').is_visible() and page.locator('#hd-opening-step-2').is_visible())
 ck('error summary receives focus',page.evaluate('document.activeElement.id')=='hd-opening-errors')
 page.locator('#hd-opening-errors button').filter(has_text='assunto').click();ck('wizard error focuses subject',page.evaluate('document.activeElement.id')=='subject')
 page.locator('#subject').fill('Dúvida sobre envio de solicitação')
 text='<img src=x onerror=alert(1)> Relato fictício — não enviar.'
 page.locator('#description').fill(text);page.locator('#priority').select_option('high');page.locator('#hd-opening-next').click()
 ck('review exposes the same submitted text safely',text in page.locator('.hd-opening-review').inner_text() and page.locator('.hd-opening-review img').count()==0)
 ck('review alone never writes a ticket',page.evaluate('SENDS.length')==0)
 ck('review has a current-step accessible indicator',page.locator('#hd-opening-steps [aria-current="step"]').inner_text()=='3. Revisão')
 page.locator('#hd-opening-back').click();ck('back preserves form content',page.locator('#description').input_value()==text and page.locator('#priority').input_value()=='high')
 page.locator('#hd-opening-next').click();page.evaluate('document.getElementById("subject").value="Alteração sem evento";document.getElementById("create-form").requestSubmit()')
 ck('programmatic edit without new review is stopped',page.evaluate('SENDS.length')==0 and page.locator('#hd-opening-step-2').is_visible())
 page.locator('#hd-opening-next').click()
 page.evaluate('''()=>{const c=document.getElementById('coverage-choice');const empty=document.createElement('option');empty.value='';empty.textContent='Selecione a cobertura';const o=document.createElement('option');o.value='fixture-coverage';o.textContent='Contrato autorizado · versão 1';c.replaceChildren(empty,o);UPDATE({ambiguous:true});document.getElementById('create-form').requestSubmit();}''')
 ck('ambiguous coverage cannot be silently selected',page.evaluate('SENDS.length')==0 and page.locator('#coverage-choice').input_value()=='')
 ck('coverage error stays within review',page.locator('#hd-opening-step-3').is_visible() and page.get_attribute('#coverage-choice','aria-invalid')=='true')
 page.locator('#coverage-choice').select_option('fixture-coverage')
 page.locator('#hd-opening-back').click()
 page.locator('#subject').fill('Orientação para emitir um relatório')
 page.locator('#description').fill('Ao solicitar o relatório, o processamento não foi concluído. Preciso de orientação para conferir os dados e tentar novamente. Exemplo fictício de atendimento.')
 page.locator('#hd-opening-next').click()
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'opening reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   bounds=page.locator('#create-dialog').bounding_box();ck(f'dialog fits viewport {width}/{theme}',bounds['x']>=0 and bounds['x']+bounds['width']<=width+1)
   ck(f'confirmation touch target {width}/{theme}',page.locator('#submit-create').bounding_box()['height']>=44)
   if width in [390,1440]:page.locator('#create-dialog').screenshot(path=str(a.output/f'review-{width}-{theme}.png'))
 page.evaluate('document.getElementById("create-form").requestSubmit();document.getElementById("create-form").requestSubmit()')
 ck('double submit produces one original intent',page.evaluate('SENDS.length')==1)
 ck('pending state keeps controls and navigation locked',page.locator('#subject').is_disabled() and page.locator('#hd-opening-back').is_disabled())
 page.evaluate('UNCERTAIN()')
 ck('uncertain result offers original recovery, not a new form',page.locator('#submit-create').inner_text()=='Recuperar abertura' and page.locator('#hd-opening-back').is_hidden())
 page.locator('#cancel-create').click();page.wait_for_timeout(30)
 ck('closing clears copied review and errors',page.locator('.hd-opening-review').inner_text()=='' and page.locator('#hd-opening-errors').is_hidden())
 page.evaluate('SHOW()');page.locator('#submit-create').click()
 ck('recovery reuses the original state module key and byte-exact body',page.evaluate('SENDS.length===2 && SENDS[0].headers["idempotency-key"]===SENDS[1].headers["idempotency-key"] && SENDS[0].body===SENDS[1].body'))
 page.evaluate('UNCERTAIN();OPENING.reset();CREATION.reset(null)');page.locator('#cancel-create').click();page.wait_for_timeout(30)
 ck('identity reset clears all newly duplicated user text',text not in page.locator('.hd-opening-review').inner_text())
 page.evaluate('OPENING.dispose()')
 ck('dispose restores native validation and original structure',page.evaluate('!document.getElementById("create-form").noValidate && document.getElementById("subject").closest("label").parentElement.id==="create-form"'))
 ck('dispose preserves original nodes and removes wizard',page.locator('#hd-opening-steps').count()==0 and page.evaluate('Object.entries(ORIGINAL).every(([id,n])=>document.getElementById(id)===n)'))
 ck('advanced security surfaces remain hidden and inert',page.evaluate('[...document.querySelectorAll("[data-advanced-access]")].every(n=>n.hidden&&n.inert)'))

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':900},reduced_motion='reduce');page.set_default_timeout(3500);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  if a.suite in ['dynamic','all']:dynamic_tests(page)
  if a.suite in ['opening','all']:
   opening_tests(page)
 except Exception as e:ck('bench completed without harness error',False,str(e))
 ck('no browser JavaScript exception',not errors,errors);browser.close()
report={'scope':__doc__,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'errors':errors}
(a.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('CHECKS',len(checks),'PASS',report['passed'],'FAIL',report['failed']);sys.exit(1 if report['failed'] else 0)
