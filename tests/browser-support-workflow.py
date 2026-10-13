"""Chromium + real M06 HTTP/domain/serializer; owned HTTPS synthetic state/Auth."""
import json, os, shutil, subprocess, tempfile
from pathlib import Path
from queue import Queue, Empty
from threading import Thread
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
checks=[]
with tempfile.TemporaryDirectory(prefix='helpdesk-m06-browser-') as folder:
    cert=Path(folder)/'cert.pem';key=Path(folder)/'key.pem'
    openssl=shutil.which('openssl') or 'C:/Program Files/Git/usr/bin/openssl.exe'
    subprocess.run([openssl,'req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    env={**os.environ,'HELPDESK_OWNED_WORKFLOW_BROWSER':'synthetic-loopback','HELPDESK_WORKFLOW_TEST_CERT':str(cert),'HELPDESK_WORKFLOW_TEST_KEY':str(key)}
    process=subprocess.Popen(['node','--experimental-strip-types','tests/fixtures/workflow/browser-server.ts'],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        ready=Queue();Thread(target=lambda:ready.put(process.stdout.readline()),daemon=True).start()
        try: line=ready.get(timeout=10)
        except Empty: raise RuntimeError('Owned M06 fixture did not start') from None
        if not line: raise RuntimeError(process.stderr.read()[:1200])
        base=json.loads(line)['url'];assert base.startswith('https://127.0.0.1:')
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
            context=browser.new_context(ignore_https_errors=True);page=context.new_page();page.set_default_timeout(6000)
            for width in [1440,390]:
                page.request.post(base+'/_test/reset');page.set_viewport_size({'width':width,'height':900});page.goto(base)
                expect(page.get_by_role('heading',name='Fixture M06 — identidade e estado sintéticos')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');checks.append({'check':str(width)+' owned fixture layout','result':'passed'})
                public='Planilha <img src=x onerror="window.__injected=true"> solicitada.'
                page.get_by_role('textbox',name='Devolutiva pública').fill(public);page.get_by_role('button',name='Confirmar devolutiva').click();expect(page.get_by_role('status')).to_have_text('Confirmado: 3')
                expect(page.locator('#timeline')).to_contain_text(public.replace('"','\\"'));assert page.request.get(base+'/_test/counts').json()['writes']==1;assert 'PRIVATE_SYNTHETIC_REASON' not in page.locator('#timeline').inner_text();assert page.evaluate('window.__injected') is None;checks.append({'check':str(width)+' public body and privacy via handler','result':'passed'})
                page.get_by_role('button',name='Confirmar devolutiva').click();expect(page.get_by_role('status')).to_have_text('Confirmado: 3 (replay)');assert page.request.get(base+'/_test/counts').json()['writes']==1;checks.append({'check':str(width)+' same intent reconciles once','result':'passed'})
                page.request.post(base+'/_test/close');page.get_by_role('button',name='Confirmar devolutiva').click();expect(page.get_by_role('status')).to_have_text('Recusado: release_gate_closed');assert page.request.get(base+'/_test/counts').json()['writes']==1;checks.append({'check':str(width)+' closed gate causes no mutation','result':'passed'})
            browser.close()
    finally:
        process.terminate()
        try:process.wait(timeout=3)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
result={'fixture':'owned_https_synthetic_identity_and_state','checks':checks}
artifact=root/'evidence'/'consultegeo-m06'/'browser-workflow.json';artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
