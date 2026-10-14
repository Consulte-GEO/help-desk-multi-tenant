import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');

test('UX01 supplies isolated branding and theme entry points', () => {
  for (const name of ['web/brand-profile.js','web/theme-init.js','web/brand-shell.js','web/design-tokens.css','web/consulte-theme.css']) {
    assert.ok(existsSync(new URL(name, root)), `missing visual module ${name}`);
  }
});
test('UX01 wires the presentation layer without removing the application controller', () => {
  const html = read('web/index.html');
  assert.match(html, /data-helpdesk-ds="1"/);
  assert.match(html, /data-brand="consulte-geo"/);
  assert.match(html, /src="\/app.js"/);
  assert.match(html, /src="\/theme-init.js"/);
  assert.match(html, /src="\/brand-shell.js"/);
  assert.match(html, /href="\/consulte-theme.css"/);
});
test('UX01 ships every visual dependency through the real build allowlist', () => {
  const build = read('scripts/build.mjs');
  for (const name of ['brand-profile.js','brand-shell.js','theme-init.js','design-tokens.css','consulte-theme.css','consulte-geo-color.png','consulte-geo-white.png']) {
    assert.ok(build.includes(name), `build does not ship ${name}`);
  }
});
test('UX01 preserves protected access containers and disabled initial admission', () => {
  const html=read('web/index.html');
  assert.equal((html.match(/data-advanced-access hidden inert/g) || []).length,4);
  assert.match(html,/id="app" class="shell" hidden/);
  assert.match(html,/id="submit-login" class="primary" type="submit" disabled/);
  assert.match(html,/id="submit-create" disabled/);
  assert.match(html,/id="password" type="password" autocomplete="current-password" maxlength="4096" required/);
  assert.match(html,/id="message-body" rows="3" maxlength="12000" required/);
});
test('UX01 presentation code has no business transport or credential access', () => {
  for (const name of ['web/brand-profile.js','web/brand-shell.js','web/theme-init.js']) {
    assert.ok(existsSync(new URL(name,root)),`missing ${name}`);
    const code=read(name);
    assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|\/v1\/|supabase|authorization\s*:/i);
    assert.doesNotMatch(code,/innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/);
    assert.doesNotMatch(code,/\.disabled\s*=|removeAttribute\(['"](?:hidden|inert|disabled)['"]\)/);
  }
});
test('UX01 branding profiles are closed and non-authoritative', async () => {
  assert.ok(existsSync(new URL('web/brand-profile.js',root)),'missing brand profiles');
  const mod=await import(new URL('web/brand-profile.js',root).href);
  assert.equal(mod.getBrandProfile('consulte-geo').name,'Consulte GEO');
  assert.equal(mod.getBrandProfile('neutral').name,'Central de atendimento');
  for(const value of [null,undefined,'other','__proto__','constructor','<img src=x onerror=alert(1)>']) {
    assert.equal(mod.getBrandProfile(value).id,'neutral');
  }
  assert.ok(Object.isFrozen(mod.getBrandProfile('consulte-geo')));
  assert.equal(mod.getBrandProfile('neutral').logoColor,null);
  for(const field of ['workspace','tenant','scopes','role','contract']) assert.ok(!(field in mod.getBrandProfile('consulte-geo')));
});
test('UX01 only persists an enumerated presentation preference and survives unavailable storage', () => {
  assert.ok(existsSync(new URL('web/theme-init.js',root)),'missing theme bootstrap');
  const code=read('web/theme-init.js');
  for(const value of ['auto','light','dark','INVALID','<script>']){
    const attributes:Record<string,string>={};const keys:string[]=[];
    runInNewContext(code,{document:{documentElement:{setAttribute:(k:string,v:string)=>attributes[k]=v}},localStorage:{getItem:(key:string)=>{keys.push(key);return value;}}});
    assert.deepEqual(keys,['helpdesk.ui.theme']);
    assert.equal(attributes['data-theme'],['light','dark','auto'].includes(value)?value:'auto');
  }
  const attributes:Record<string,string>={};
  runInNewContext(code,{document:{documentElement:{setAttribute:(k:string,v:string)=>attributes[k]=v}},localStorage:{getItem:()=>{throw Error('SecurityError');}}});
  assert.equal(attributes['data-theme'],'auto');
});

test('UX01 demo server can resolve all seven new same-origin assets without widening its routes', () => {
  const demo=read('scripts/demo.ts');
  for(const name of ['brand-profile.js','brand-shell.js','theme-init.js','design-tokens.css','consulte-theme.css','consulte-geo-color.png','consulte-geo-white.png']) {
    assert.ok(demo.includes(name),`demo missing ${name}`);
  }
  assert.match(demo,/server\.listen\(port,'127\.0\.0\.1'/);
  assert.match(demo,/default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'/);
});
