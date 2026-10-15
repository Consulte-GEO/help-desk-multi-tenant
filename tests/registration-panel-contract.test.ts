import test from 'node:test';import assert from 'node:assert/strict';
const path='../web/registration-automation.js',panel:any=await import(path).catch(()=>({}));
test('exports the optional read-only registration panel without mounting or reading',()=>assert.equal(typeof panel.mountRegistrationAutomation,'function'));
