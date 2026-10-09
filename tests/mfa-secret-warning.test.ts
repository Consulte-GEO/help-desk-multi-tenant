import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=()=>readFile(new URL('../web/index.html',import.meta.url),'utf8');

test('CG02 secret warning covers QR, manual key and screenshots before provisioning data',async()=>{
 const source=await html(),warning=/<p\b([^>]*\bid="mfa-secret-warning"[^>]*)>([\s\S]*?)<\/p>/.exec(source);
 assert.ok(warning,'A visible warning for both provisioning secrets must exist');
 assert.doesNotMatch(warning[1]!,/\bhidden\b|aria-hidden="true"/);
 const text=warning[2]!.replace(/<[^>]*>/g,'');
 for(const meaning of [/chave/i,/\bQR\b/,/n[aã]o compartilhe/i,/capturas de tela/i,/suporte n[aã]o precisa/i])assert.match(text,meaning);
 assert.ok(source.indexOf('id="mfa-provision"')<warning.index!);
 assert.ok(warning.index!<source.indexOf('id="mfa-enrollment-qr"'));
});
test('CG02 QR and manual secret have an accessible relationship with the warning',async()=>{
 const source=await html();
 for(const id of ['mfa-enrollment-qr','mfa-enrollment-secret']){
  const tag=new RegExp('<[^>]+\\bid="'+id+'"[^>]*>').exec(source)?.[0];assert.ok(tag);
  const describedBy=/aria-describedby="([^"]+)"/.exec(tag)?.[1]?.split(/\s+/)??[];
  assert.ok(describedBy.includes('mfa-secret-warning'),id+' must reference the warning');
 }
});
test('CG02 initial markup contains neither provisioned secret nor remote QR source',async()=>{
 const source=await html();assert.match(source,/<code\b[^>]*\bid="mfa-enrollment-secret"[^>]*><\/code>/);
 const canvas=/<canvas\b[^>]*\bid="mfa-enrollment-qr"[^>]*>/.exec(source)?.[0];assert.ok(canvas);
 assert.match(canvas,/\bhidden\b/);assert.match(canvas,/width="0"/);assert.match(canvas,/height="0"/);
 assert.doesNotMatch(canvas,/\b(?:src|data-secret|data-uri)=/);
});
