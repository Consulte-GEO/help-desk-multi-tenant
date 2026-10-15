#!/usr/bin/env python3
"""Native Vue/Chromium rendering. No navigation, HTTP, native sessionStorage or Vuex-library claim."""
from pathlib import Path
import argparse,json,subprocess,tempfile,shutil,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--vue-runtime',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 out=Path(a.output);out.mkdir(parents=True,exist_ok=False);checks=[];errors=[];report={'status':'failed'}
 def check(name,condition):
  checks.append({'name':name,'passed':bool(condition)})
  if not condition:raise AssertionError(name)
 try:
  with tempfile.TemporaryDirectory(prefix='imp05-dom-') as tmp:
   target=Path(tmp)/'fixture.json'
   subprocess.run(['node',str(ROOT/'tools/tests/import-process/build-review-fixture.cjs'),a.vue_runtime,str(target)],check=True)
   fixture=json.loads(target.read_text());report['runtime']=fixture['metadata']
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1365,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(fixture['html']);page.add_script_tag(content=fixture['runtime']);page.add_script_tag(content=fixture['script'])
    check('desabilitado não lê dados',page.evaluate('fixture.calls.length')==0 and page.get_by_text('Nenhum dado foi consultado.',exact=False).count()==1)
    page.evaluate('fixture.activate()');page.wait_for_selector('[data-testid=server-version]')
    check('Vue real renderiza estado do binding',page.locator('[data-testid=server-version]').inner_text()=='1')
    check('HTML do documento é texto inerte',page.locator('tbody img').count()==0 and not page.evaluate('!!window.xss'))
    page.locator('[data-testid=search]').fill('CP-001');check('busca filtra sem perder origem',page.locator('tbody tr').count()==1)
    page.get_by_role('button',name='Revisar resistencia de CP-001',exact=True).click()
    page.locator('[data-testid=correction-value]').fill('33,1');page.locator('[data-testid=correction-reason]').fill('Conferido no documento original')
    page.locator('[data-testid=apply-correction]').click();page.wait_for_function('fixture.getState().draft.decisions.length===1')
    check('correção preserva original',page.evaluate('fixture.getState().draft.records[0].fields.resistencia.rawValue')=='32,4')
    check('correção só altera o rascunho',page.evaluate('fixture.calls.filter(x=>x==="POST").length')==0)
    page.locator('[data-testid=revision-reason]').fill('Correção conferida pela equipe')
    page.locator('[data-testid=save-revision]').click();page.wait_for_function('fixture.getState().data.process.version===2')
    check('recibo e versão consultada são exibidos separadamente',page.locator('[data-testid=receipt-version]').inner_text()=='2' and page.locator('[data-testid=server-version]').inner_text()=='2')
    page.get_by_role('button',name='Revisar resistencia de CP-001',exact=True).click();page.locator('[data-testid=correction-value]').fill('34');page.locator('[data-testid=correction-reason]').fill('Nova conferência');page.locator('[data-testid=apply-correction]').click()
    page.wait_for_function('fixture.getState().draft.decisions.length===2');page.evaluate('fixture.setMode("conflict")');page.locator('[data-testid=revision-reason]').fill('Conferência concorrente');page.locator('[data-testid=save-revision]').click();page.wait_for_function('fixture.getState().phase==="conflict"')
    check('conflito mantém correção local',page.evaluate('fixture.getState().draft.records[0].fields.resistencia.value')==34)
    check('conflito não habilita salvar sobre versão antiga',page.locator('[data-testid=save-revision]').is_disabled())
    page.locator('[data-testid=reload]').click();check('descarte pede confirmação',page.locator('[data-testid=confirm-reload]').is_visible())
    page.locator('[data-testid=confirm-reload]').click();page.wait_for_function('fixture.getState().phase==="ready"')
    check('descarte recupera valor gravado',page.evaluate('fixture.getState().draft.records[0].fields.resistencia.value')==33.1)
    page.locator('[data-testid=search]').fill('');page.screenshot(path=str(out/'painel-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.evaluate('document.body.classList.add("dark")');page.screenshot(path=str(out/'painel-mobile-dark.png'),full_page=True)
    check('mobile mantém rolagem dentro da tabela',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
    page.evaluate('fixture.makeCancelled()');check('cancelado é somente leitura',all(page.get_by_role('button',name='Revisar',exact=False).nth(i).is_disabled() for i in range(page.get_by_role('button',name='Revisar',exact=False).count())))
    page.evaluate('fixture.deactivate()');check('desativação remove dados da tela',page.get_by_text('Nenhum dado foi consultado.',exact=False).count()==1 and page.locator('tbody tr').count()==0)
    check('módulos legados preservados',page.evaluate('fixture.store.state.setup.preserved && fixture.store.state.validation.preserved && fixture.store.state.export.preserved'))
    check('sem erro JavaScript',not errors)
    report['chromium']=browser.version;browser.close();report['status']='passed'
 except Exception as e:report['error']=str(e);raise
 finally:
  report.update(scope='offline_vue_component_with_test_store_and_client',checks=checks,passed=sum(x['passed'] for x in checks),failed=sum(not x['passed'] for x in checks),javascriptErrors=errors,nativeSessionStorageTested=False,httpTested=False,fullVuexTested=False)
  (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'passed':report['passed'],'scope':report['scope']}))
if __name__=='__main__':main()
