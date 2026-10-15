#!/usr/bin/env node
// Offline TEST fixture only: Vue is real; Vuex port and backend below are explicit doubles.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
function build(vuePath){
 const ts=createRequire(path.join(root,'frontend/package.json'))('typescript');
 const file=path.join(root,'frontend/src/components/ImportProcessPanel.vue'),sfc=fs.readFileSync(file,'utf8');
 const match=sfc.match(/^<template>\n([\s\S]+?)\n<\/template>\s*\n<script>\n([\s\S]+?)\n<\/script>\s*\n<style scoped>\n([\s\S]+?)\n<\/style>\s*$/);
 if(!match)throw Error('SFC_SECTIONS_INVALID');
 const modules={};
 function add(file,source){file=path.resolve(file);const id=path.relative(root,file).split(path.sep).join('/');if(modules[id])return id;
  if(!source)source=fs.readFileSync(file,'utf8');
  const r=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  if(r.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('TRANSPILE_FAILED');
  const deps={};modules[id]={code:r.outputText,deps};
  for(const m of r.outputText.matchAll(/require\("([^"]+)"\)/g)){
   if(!m[1].startsWith('.'))throw Error('UNEXPECTED_RUNTIME_DEPENDENCY:'+m[1]);
   deps[m[1]]=add(path.resolve(path.dirname(file),m[1]));
  }return id;
 }
 const entry=add(file,match[2]),binding=add(path.join(root,'modules/import-process-client/vuex-binding.ts'));
 const client=add(path.join(root,'modules/import-process-client/client.ts'));
 const loader=`const definitions=${JSON.stringify(modules)},cache={};function load(id){if(cache[id])return cache[id].exports;const d=definitions[id],m={exports:{}};cache[id]=m;new Function('require','module','exports',d.code)(name=>load(d.deps[name]),m,m.exports);return m.exports;}`;
 const runtime=fs.readFileSync(vuePath,'utf8');
 const script=`${loader}\nconst Panel=load(${JSON.stringify(entry)}).default;Panel.template=${JSON.stringify(match[1])};
const {registerImportProcessSession}=load(${JSON.stringify(binding)}),{ProcessHttpError}=load(${JSON.stringify(client)});
${fs.readFileSync(path.join(__dirname,'review-browser-port-fixture.js'),'utf8')}`;
 const css=':root{--surface:#fff;--surface-alt:#f3f5f8;--border:#d1d7e0;--text:#15283d;--brand-magenta:#b21f67;}body{margin:0;background:#edf0f5;color:var(--text);font:16px/1.55 system-ui;padding:24px}.card{border:1px solid var(--border);border-radius:12px;background:var(--surface)}.card-header,.card-body{padding:24px}.card-header{border-bottom:1px solid var(--border)}.card-title{margin:0;font-size:26px}.card-description{margin:6px 0 0}.kicker{text-transform:uppercase;font-size:12px;color:#a51b60;letter-spacing:.1em}.btn{padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:inherit;font:inherit}.btn.brand{background:#182f49;color:white}.btn:disabled{opacity:.45}.badge{padding:4px 8px;border-radius:6px;background:var(--surface-alt)}.alert{padding:12px;border-left:4px solid #b78b1b;background:var(--surface-alt)}.fixture-notice{max-width:80ch;margin:0 0 20px}h3{margin-top:12px}.dark{--surface:#172637;--surface-alt:#21364b;--border:#425368;--text:#f4f6f8;background:#101c28;color:var(--text)}'+match[3];
 return {runtime,script,html:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body><p class="fixture-notice">Ensaio offline — dados fictícios. Vue real; interface do store e servidor simulados. Nenhuma gravação remota.</p><div id="app"></div></body></html>`,metadata:{vueVersion:runtime.match(/vue v([\d.]+)/)?.[1],vueSha256:crypto.createHash('sha256').update(runtime).digest('hex'),typescript:ts.version,store:'structural_port_with_vue_reactivity_not_vuex_library',backend:'explicit_client_double',network:false,sfcSha256:crypto.createHash('sha256').update(sfc).digest('hex')}};
}
module.exports={build};
if(require.main===module){const[vue,output]=process.argv.slice(2);if(!vue||!output)throw Error('USAGE: build-review-fixture.cjs VUE_GLOBAL_JS OUTPUT_JSON');fs.writeFileSync(output,JSON.stringify(build(vue)),{flag:'wx'});}
