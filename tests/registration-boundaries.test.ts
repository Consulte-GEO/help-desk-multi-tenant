import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../src/domain/',import.meta.url);
test('domain registration modules do not import connector implementations',()=>{
 for(const name of readdirSync(root).filter(n=>n.startsWith('registration-')&&n.endsWith('.ts'))){
  const code=readFileSync(new URL(name,root),'utf8');assert.ok(!/from\s+['"][^'"]*connectors\//.test(code),name+' must depend on domain contracts, not adapters');
 }
});
