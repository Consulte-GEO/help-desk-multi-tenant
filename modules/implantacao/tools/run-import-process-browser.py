#!/usr/bin/env python3
"""Compiles the browser client and runs Chromium against a real local HTTP host.
The server uses the real application service and an explicit memory test repository.
This is NOT PostgreSQL, real identity/storage, the full Vue app, or an XLSX test.
"""
from pathlib import Path
import argparse, json, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
    out=Path(args.output);out.mkdir(parents=True,exist_ok=False)
    results=[];errors=[];passed=False;failure=None;host=None
    def check(name,condition):
        results.append({'name':name,'passed':bool(condition)})
        if not condition:raise AssertionError(name)
    try:
        with tempfile.TemporaryDirectory(prefix='imp03-browser-') as tmp:
            local=ROOT/'frontend/node_modules/.bin/tsc'
            tsc=str(local) if local.exists() else shutil.which('tsc')
            if not tsc:raise RuntimeError('TYPESCRIPT_REQUIRED')
            version=subprocess.check_output([tsc,'--version'],text=True).strip()
            command=[tsc,'-p',str(ROOT/'modules/import-process-client/tsconfig.json'),'--noEmit','false','--rewriteRelativeImportExtensions','true','--rootDir',str(ROOT/'modules'),'--outDir',tmp]
            compiled=subprocess.run(command,capture_output=True,text=True)
            (out/'compile.log').write_text(compiled.stdout+compiled.stderr,encoding='utf-8')
            if compiled.returncode:raise RuntimeError('CLIENT_COMPILATION_FAILED')
            with (out/'host-stderr.log').open('w',encoding='utf-8') as log:
                host=subprocess.Popen(['node','--experimental-strip-types',str(ROOT/'tools/tests/import-process/browser-host.mjs'),tmp],stdout=subprocess.PIPE,stderr=log,text=True)
                url=host.stdout.readline().strip()
                if not url.startswith('http://127.0.0.1:'):raise RuntimeError('LOOPBACK_HOST_FAILED')
                with sync_playwright() as pw:
                    browser=pw.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
                    page=browser.new_page(viewport={'width':1100,'height':820});page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(url);page.wait_for_function('!!window.fixture')
                    page.locator('#open').click();page.wait_for_function("fixture.controller.getState().phase==='ready'")
                    check('retomada pelo HTTP autenticado',page.locator('#version').inner_text()=='1')
                    page.locator('#note').fill('Conferido no navegador');page.locator('#save').click()
                    page.wait_for_function("fixture.controller.getState().phase==='ready'&&fixture.controller.getState().data.process.version===2")
                    check('salvamento confirmado por recibo',page.evaluate('fixture.controller.getState().lastReceipt.version===2'))
                    other=browser.new_page();other.goto(url);other.wait_for_function('!!window.fixture');other.locator('#open').click();other.wait_for_function("fixture.controller.getState().phase==='ready'")
                    page.locator('#note').fill('Alterado pela primeira sessão');page.locator('#save').click();page.wait_for_function('fixture.controller.getState().data.process.version===3')
                    other.locator('#note').fill('Edição que deve ser preservada');other.locator('#save').click();other.wait_for_function("fixture.controller.getState().phase==='conflict'")
                    check('conflito preserva edição da segunda sessão',other.locator('#note').input_value()=='Edição que deve ser preservada')
                    other.locator('#reload').click();other.wait_for_function("fixture.controller.getState().phase==='ready'")
                    check('recarregamento explícito usa versão atual',other.locator('#version').inner_text()=='3');other.close()
                    page.request.post(url+'/fixture/drop-ack');page.locator('#note').fill('Resposta perdida depois do commit');page.locator('#save').click();page.wait_for_function("fixture.controller.getState().phase==='uncertain'")
                    key=page.evaluate('fixture.controller.getState().pendingOperationId')
                    check('ACK perdido não é apresentado como salvo',bool(key) and page.locator('#phase').inner_text()=='uncertain')
                    page.locator('#retry').click();page.wait_for_function("fixture.controller.getState().phase==='ready'")
                    check('retry mantém chave e não duplica revisão',page.evaluate('fixture.controller.getState().lastReceipt.operationId')==key and page.evaluate('fixture.controller.getState().lastReceipt.replayed') and page.locator('#version').inner_text()=='4')
                    page.screenshot(path=str(out/'process-client-fixture.png'),full_page=True)
                    page.locator('#clear').click();check('encerramento remove dados privados do estado',page.evaluate('fixture.controller.getState().data===null&&fixture.controller.getState().draft===null'))
                    check('sem exceções JavaScript no navegador',not errors);browser.close();passed=True
                (out/'compiler.json').write_text(json.dumps({'version':version,'source':'frontend lock' if local.exists() else 'global compiler'},indent=2),encoding='utf-8')
    except Exception as e:
        failure=str(e)
        raise
    finally:
        if host:
            host.terminate()
            try:host.wait(timeout=5)
            except subprocess.TimeoutExpired:host.kill();host.wait()
        (out/'browser-process.json').write_text(json.dumps({'status':'passed' if passed else 'failed','scope':'real_chromium_and_loopback_http_synthetic_identity_storage_not_full_app','results':results,'failure':failure,'javascriptErrors':errors},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':len(results),'scope':'client_controller_loopback_not_full_application'}))
if __name__=='__main__':main()
