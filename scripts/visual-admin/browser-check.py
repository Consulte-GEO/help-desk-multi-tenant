#!/usr/bin/env python3
"""UX05: native modules/controllers with synthetic ports, no Auth/SQL/hosted acceptance."""
import argparse,base64,json,re,shutil,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser(description=__doc__);P.add_argument('--output',type=Path,required=True);P.add_argument('--web-root',type=Path,default=Path(__file__).resolve().parents[2]/'web');a=P.parse_args();root=a.web_root.resolve();a.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];cache={}
def ck(name,value,detail=None):
 checks.append({'name':name,'passed':bool(value),'detail':detail})
 if not value:print('FAIL',name,detail)
def module(file):
 file=file.resolve()
 if file not in cache:
  s=file.read_text();s=re.sub(r"(from\s*)(['\"])(\.[^'\"]+)\2",lambda m:m[1]+repr(module(file.parent/m[3])),s);cache[file]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
 return cache[file]
def setup(page,kind):
 css='\n'.join(re.sub(r'@import[^;]+;','',(root/n).read_text()) for n in ['design-tokens.css','consulte-theme.css','dynamic-form.css','form-experience.css','admin-experience.css','admin-members.css'] if (root/n).exists())
 page.set_content('<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--hd-paper);color:var(--hd-ink);font:14px/1.6 var(--hd-font)}main{max-width:1240px;padding:16px;margin:auto}*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}button,input,textarea,select{font:inherit}#outside{margin:16px;min-height:44px}</style><style>'+css+'</style></head><body class="hd-ui"><button id="outside">Fora do painel</button><main><div id="root" class="host-owned" data-host="keep"></div></main></body></html>')
 page.add_script_tag(content="if(!crypto.randomUUID){let n=200;crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');}")
 page.add_script_tag(content=(Path(__file__).parent/'fixture.js').read_text())
 name,file={'members':('mountAdminMembers','admin-members.js'),'configuration':('mountConfigurationPanel','admin-configuration.js'),'editor':('mountFormEditor','admin-forms.js')}[kind]
 script=f"import {{{name}}} from {module(root/file)!r};window.MOUNT=()=>{{window.PANEL?.destroy();window.PANEL={name}(document.getElementById('root'),"+ ('{schema:SCHEMA,submit:SUBMIT}' if kind=='editor' else '{audience:AUDIENCE,request:REQUEST}')+ ");window.C=window.PANEL.controller??window.PANEL;};MOUNT();"
 page.add_script_tag(type='module',content=script);page.wait_for_function('!!window.PANEL')
def reflow(page,label,modal=False):
 for theme in ['light','dark']:
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900});page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
   ck(f'{label} document reflow {width}/{theme}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if modal:ck(f'{label} modal fits {width}/{theme}',page.locator('dialog[open]').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
   bad=page.locator('.hd-admin button, .hd-admin summary').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length && !e.closest("[hidden]")).filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent)')
   ck(f'{label} touch targets {width}/{theme}',not bad,bad)
   if width<=390:
    small=page.locator('.hd-admin input:not([type=checkbox]), .hd-admin textarea, .hd-admin select').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)')
    ck(f'{label} mobile input readability {width}/{theme}',not small,small)
   if width in [390,1440]:page.screenshot(path=str(a.output/f'{label}-{width}-{theme}.png'),full_page=True)
def members(page):
 setup(page,'members');ck('members no request on mount',page.evaluate('CALLS.length===0'))
 assert page.locator('[data-admin-panel="members"]').count()==1,'Missing UX05 member shell'
 ck('members unloaded does not claim empty result','Atualize a lista' in page.locator('#root').inner_text())
 page.get_by_role('button',name='Atualizar membros',exact=True).click();page.wait_for_function('C.view().revision===7')
 ck('member total comes from server not visible rows','42' in page.locator('[data-admin-count]').inner_text())
 ck('member states all named',all(x in page.locator('#root').inner_text() for x in ['Ativo','Convite pendente','Expirado','Revogado']))
 ck('no fake names or email resolution','@' not in page.locator('#root').inner_text())
 reflow(page,'members')
 page.set_viewport_size({'width':390,'height':900});page.evaluate('document.documentElement.dataset.theme="light"')
 target=page.locator('[data-admin-member]').nth(1).get_by_role('button',name='Alterar perfil',exact=True)
 target.click();page.get_by_label('Motivo da alteração',exact=True).fill('Confirmação interna de teste')
 before=page.locator('[data-admin-reason]').evaluate('(e)=>{window.OLD_INPUT=e;return e.value}')
 page.keyboard.press('Escape');ck('member cancel returns focus to initiating row',page.evaluate('document.activeElement.getAttribute("data-admin-action")==="set_role"'))
 target.click();ck('cancel discards unsent reason by existing policy',page.get_by_label('Motivo da alteração',exact=True).input_value()=='')
 page.get_by_role('button',name='Confirmar alteração',exact=True).click();ck('member reason error is inside visible dialog', 'três' in page.locator('dialog[open]').inner_text())
 page.get_by_label('Motivo da alteração',exact=True).fill('Revisão de perfil')
 page.evaluate('MODE="unknown"');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('C.view().uncertain')
 ck('member uncertainty focuses reconciliation',page.evaluate('document.activeElement.textContent.includes("Conciliar")'))
 ck('member uncertain prevents new operation',page.get_by_role('button',name='Convidar pessoa cadastrada').is_disabled())
 page.evaluate('MODE="ok"');page.get_by_role('button',name='Conciliar solicitação',exact=True).click();page.wait_for_function('!C.view().uncertain && !C.view().busy')
 ck('members unknown retry same key and body',page.evaluate('(()=>{const c=CALLS.filter(c=>c.method!=="GET");return c.length===2&&c[0].body===c[1].body&&JSON.stringify(c[0].headers)===JSON.stringify(c[1].headers)})()'))
 page.get_by_role('button',name='Convidar pessoa cadastrada').click();page.get_by_label('Identificador da pessoa cadastrada').fill('email@example.invalid');page.get_by_label('Motivo da alteração',exact=True).fill('Novo membro');page.get_by_role('button',name='Confirmar alteração',exact=True).click()
 ck('member invalid ID does not submit',page.evaluate('CALLS.filter(c=>c.method!=="GET").length===2'))
 page.get_by_label('Identificador da pessoa cadastrada').fill('00000000-0000-4000-8000-000000000050');page.get_by_label('Validade em UTC',exact=True).fill('2026-11-30T15:30:00.123456Z')
 reflow(page,'member-dialog',True)
 page.evaluate('MODE="delay"');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('!!window.MUTATION_DONE');page.keyboard.press('Escape');ck('busy member dialog cannot be dismissed',page.locator('dialog').is_visible())
 ck('UTC input is unchanged in request',page.evaluate('JSON.parse(CALLS.at(-1).body).expires_at==="2026-11-30T15:30:00.123456Z"'))
 page.evaluate('window.DETACHED=[...document.querySelectorAll("#root input,#root textarea")];PANEL.setAudience({workspaceId:ID(100),principalId:ID(101)});MUTATION_DONE()');page.wait_for_timeout(20)
 ck('member audience change scrubs controls and late receipt',page.evaluate('DETACHED.every(e=>e.value==="")') and 'registrado' not in page.locator('#root').inner_text().lower())
 page.evaluate('PANEL.destroy()');ck('member destroy preserves host attributes and clears content',page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('data-host')=='keep')
 setup(page,'members');page.evaluate('CAPABILITIES=[];EMPTY=true;C.load()');page.wait_for_function('C.view().revision===7');ck('member empty list differs from not loaded','Nenhum membro' in page.locator('#root').inner_text());ck('member no invite capability hides invitation',not page.get_by_role('button',name='Convidar pessoa cadastrada').is_visible())
 page.evaluate('GET_REJECT=true;C.load()');page.wait_for_function('!C.view().busy');ck('member refusal does not claim empty result','Nenhum membro' not in page.locator('#root').inner_text())
 setup(page,'members');page.evaluate('C.load()');page.wait_for_function('C.view().revision===7')
 page.locator('[data-admin-member]').nth(0).get_by_role('button',name='Transferir administração',exact=True).click()
 ck('succession offers only an eligible other administrator',page.get_by_label('Administrador sucessor',exact=True).locator('option').count()==2)
 page.get_by_label('Administrador sucessor',exact=True).select_option('00000000-0000-4000-8000-000000000004');page.get_by_label('Motivo da alteração',exact=True).fill('Transferência conferida');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('!C.view().busy&&!C.view().dialog')
 ck('succession uses existing endpoint and does not promote automatically',page.evaluate('(()=>{const c=CALLS.find(c=>c.method!=="GET"),b=JSON.parse(c.body);return c.path.endsWith("/succession")&&b.successor_principal_id===ID(4)&&!("role" in b)})()'))
 page.locator('[data-admin-member]').nth(1).get_by_role('button',name='Revogar',exact=True).click();page.get_by_label('Motivo da alteração',exact=True).fill('Revogação conferida');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('!C.view().busy&&!C.view().dialog')
 ck('revocation remains an explicit request',page.evaluate('CALLS.filter(c=>c.method!=="GET").at(-1).path.endsWith("/revocations")'))
 page.locator('[data-admin-member]').nth(4).get_by_role('button',name='Registrar expiração',exact=True).click();page.get_by_label('Motivo da alteração',exact=True).fill('Expiração conferida');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('!C.view().busy&&!C.view().dialog')
 ck('expiry uses the existing command without changing access elsewhere',page.evaluate('CALLS.filter(c=>c.method!=="GET").at(-1).path.endsWith("/expiry")'))

def configuration(page):
 setup(page,'configuration');ck('configuration no automatic request',page.evaluate('CALLS.length===0'))
 assert page.locator('[data-admin-panel="configuration"]').count()==1,'Missing UX05 configuration shell'
 for kind in ['account','product','instance','service','binding','contract','contract_version','coverage']:
  page.evaluate('(k)=>C.load(k)',kind);page.wait_for_function('C.view().revision===7')
  ck('config no private extras '+kind,'DO_NOT_RENDER_EXTRA' not in page.locator('#root').inner_text())
  page.get_by_role('button',name='Novo registro',exact=True).click();ck('config native modal '+kind,page.locator('dialog').is_visible())
  ck('config fields match original kind '+kind,page.locator('[data-config-field]').count()==page.evaluate('C.view().dialog?Object.keys(C.view().dialog.data).length:0'))
  page.get_by_role('button',name='Cancelar',exact=True).click();ck('config cancel focus '+kind,page.evaluate('document.activeElement.textContent==="Novo registro"'))
 page.evaluate('C.load("contract_version")');page.wait_for_function('!C.view().busy')
 ck('published version has no edit/publish actions',page.locator('[data-config-record]').nth(1).get_by_role('button').count()==0)
 page.get_by_role('button',name='Publicar versão',exact=True).click();ck('publish warning is explicit','não libera atendimento' in page.locator('dialog[open]').inner_text());page.get_by_role('button',name='Cancelar',exact=True).click()
 page.evaluate('C.load("account")');page.wait_for_function('!C.view().busy');reflow(page,'configuration')
 page.get_by_role('button',name='Novo registro',exact=True).click();page.get_by_label('Nome',exact=True).fill('Conta de teste');page.get_by_label('Motivo da alteração',exact=True).fill('ab');page.get_by_role('button',name='Confirmar alteração',exact=True).click()
 ck('config invalid reason is explained inline','três' in page.locator('dialog[open]').inner_text())
 page.get_by_label('Motivo da alteração',exact=True).fill('Cadastro revisado');page.get_by_label('Ativo',exact=True).uncheck()
 page.evaluate('window.KEEP_REASON=document.querySelector("[data-config-reason]");MODE="delay"');page.get_by_role('button',name='Confirmar alteração',exact=True).click();page.wait_for_function('!!window.MUTATION_DONE')
 ck('config busy render reuses exact reason input',page.evaluate('KEEP_REASON===document.querySelector("[data-config-reason]") && KEEP_REASON.value==="Cadastro revisado"'))
 page.keyboard.press('Escape');ck('config Escape does not cancel pending write',page.locator('dialog').is_visible())
 ck('config false stays boolean false',page.evaluate('JSON.parse(CALLS.at(-1).body).data.active===false'))
 page.evaluate('MODE="unknown";MUTATION_DONE()');page.wait_for_function('C.view().uncertain');ck('config unknown focus',page.evaluate('document.activeElement.textContent.includes("Conciliar")'))
 page.evaluate('MODE="ok"');page.get_by_role('button',name='Conciliar solicitação',exact=True).click();page.wait_for_function('!C.view().uncertain&&!C.view().busy')
 ck('config unknown replay exact',page.evaluate('(()=>{const c=CALLS.filter(c=>c.method!=="GET");return c.length===2&&c[0].body===c[1].body&&JSON.stringify(c[0].headers)===JSON.stringify(c[1].headers)})()'))
 page.evaluate('C.load("coverage")');page.wait_for_function('!C.view().busy');page.get_by_role('button',name='Novo registro',exact=True).click();reflow(page,'config-dialog',True)
 page.get_by_label('Motivo da alteração',exact=True).fill('PRIVATE_DRAFT');page.evaluate('window.DETACHED=[...document.querySelectorAll("#root input,#root textarea")];C.setAudience({workspaceId:ID(99),principalId:ID(98)});PANEL.destroy()')
 ck('config destroy scrubs controls and preserves host',page.evaluate('DETACHED.every(e=>e.value==="")') and page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('class')=='host-owned')
def editor(page):
 setup(page,'editor');ck('editor no submit on mount',page.evaluate('CALLS.length===0'))
 assert page.locator('[data-admin-panel="editor"]').count()==1,'Missing UX05 editor shell'
 ck('editor preview starts public',page.locator('[data-editor-section="preview"]').get_by_label('Análise interna de teste').count()==0)
 page.get_by_label('Público da prévia',exact=True).select_option('internal');ck('internal preview is explicit',page.locator('[data-editor-section="preview"]').get_by_label('Análise interna de teste').count()==1)
 page.get_by_label('Público da prévia',exact=True).select_option('customer')
 ck('editor default one prepare action visible',page.locator('[data-editor-prepare]:visible').count()==1)
 reflow(page,'editor')
 page.get_by_label('Definição do formulário (JSON)',exact=True).fill('{invalid');page.get_by_role('button',name='Conferir e visualizar',exact=True).click()
 ck('editor invalid JSON does not send and explains error',page.evaluate('CALLS.length===0') and page.get_by_label('Definição do formulário (JSON)',exact=True).get_attribute('aria-invalid')=='true')
 page.evaluate('window.NEW_SCHEMA={...SCHEMA,title:"Nova prévia"}')
 page.get_by_label('Definição do formulário (JSON)',exact=True).fill(page.evaluate('JSON.stringify(NEW_SCHEMA)'))
 ck('editing JSON marks preview stale','desatualizada' in page.locator('#root').inner_text())
 page.get_by_role('button',name='Conferir e visualizar',exact=True).click();ck('diff uses human label','Título' in page.locator('[data-editor-diff]').inner_text())
 page.get_by_label('Operação',exact=True).select_option('publish');page.get_by_label('Motivo da alteração',exact=True).fill('Revisado');page.get_by_role('button',name='Preparar publicação',exact=True).click();ck('unsaved publish is refused',page.evaluate('PANEL.state()==="idle" && CALLS.length===0'))
 page.get_by_label('Operação',exact=True).select_option('save');page.get_by_role('button',name='Preparar rascunho',exact=True).click();ck('prepare does not submit',page.evaluate('PANEL.state()==="prepared" && CALLS.length===0'))
 ck('confirmation explains operation and reason','Revisado' in page.locator('[data-editor-review]').inner_text())
 page.evaluate('MODE="unknown"');page.get_by_role('button',name='Confirmar operação',exact=True).click();page.wait_for_function('PANEL.state()==="unknown"')
 ck('unknown leaves only reconciliation operative',page.get_by_role('button',name='Conciliar mesma intenção').is_visible() and page.locator('[data-editor-prepare]:visible').count()==0)
 ck('private error not rendered','PRIVATE_SUBMIT_ERROR' not in page.locator('#root').inner_text())
 page.evaluate('MODE="ok"');page.get_by_role('button',name='Conciliar mesma intenção').click();page.wait_for_function('PANEL.state()==="refresh_required"');ck('editor replay keeps same intent',page.evaluate('JSON.stringify(CALLS[0])===JSON.stringify(CALLS[1])'))
 ck('confirmation does not imply publication','Publicado com sucesso' not in page.locator('#root').inner_text())
 page.evaluate('PANEL.reload(SCHEMA)');page.get_by_label('Operação',exact=True).select_option('restore');page.get_by_label('Motivo da alteração',exact=True).fill('Nova versão sem apagar histórico');page.get_by_role('button',name='Preparar nova versão').click();page.evaluate('MODE="delay"');page.get_by_role('button',name='Confirmar operação').click();page.wait_for_function('!!window.MUTATION_DONE')
 page.evaluate('window.DETACHED=[...document.querySelectorAll("#root textarea,#root input")];PANEL.clearAudience();MUTATION_DONE()');page.wait_for_timeout(20)
 ck('editor clear drops schema, reasons and late outcome',page.evaluate('PANEL.state()==="cleared" && DETACHED.every(e=>e.value==="")') and 'Cadastro de solicitação' not in page.locator('#root').inner_text())
 page.evaluate('PANEL.destroy()');ck('editor destroy leaves host reusable',page.locator('#root').inner_text()=='' and page.locator('#root').get_attribute('class')=='host-owned')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':900},reduced_motion='reduce');page.set_default_timeout(4000);page.on('pageerror',lambda e:errors.append(str(e)))
  for name,fn in [('members',members),('configuration',configuration),('editor',editor)]:
   try:fn(page)
   except Exception as e:ck(name+' bench completed',False,str(e));print(traceback.format_exc())
  ck('no uncaught browser errors',not errors,errors);version=browser.version;browser.close()
finally:
 result={'suite':'UX05','scope':'Native optional admin mounts and controllers, synthetic ports; not app/HTTP/Auth/SQL/CI acceptance','browser':locals().get('version'),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'pageErrors':errors}
 (a.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['passed'],'passed',result['failed'],'failed')
raise SystemExit(1 if result['failed'] else 0)
