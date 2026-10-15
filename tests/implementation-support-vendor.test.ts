import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createContext,runInContext} from 'node:vm';
const file=(path:string)=>readFileSync(new URL('../modules/implantacao/frontend/public/'+path,import.meta.url));

test('reviewed vendored SheetJS is pinned outside npm and roundtrips measurements',()=>{
 const source=file('vendor/xlsx.full.min.js');assert.equal(createHash('sha256').update(source).digest('hex'),'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41');
 const context=createContext({});runInContext(source.toString('utf8'),context);const x=(context as any).XLSX;assert.equal(x.version,'0.20.3');
 const book=x.utils.book_new();x.utils.book_append_sheet(book,x.utils.aoa_to_sheet([['CP','MPa'],['CP01',32.5],['CP02',0]]),'Resultados');
 const result=x.read(x.write(book,{type:'array',bookType:'xlsx'}),{type:'array'});
 assert.deepEqual(JSON.parse(JSON.stringify(x.utils.sheet_to_json(result.Sheets.Resultados))),[{CP:'CP01',MPa:32.5},{CP:'CP02',MPa:0}]);
});

test('both R02 models remain readable and the filled example reaches the actual wizard parser',()=>{
 const context=createContext({console});runInContext(file('vendor/xlsx.full.min.js').toString('utf8'),context);runInContext(file('assets/implantacao-import-core.js').toString('utf8'),context);
 const {XLSX:x,ImplantacaoImportCore:core}=context as any;
 for(const name of ['Modelo-Implantacao-Consulte-GEO-R02.xlsx','Modelo-Implantacao-Consulte-GEO-R02-EXEMPLO-PREENCHIDO.xlsx']){
  const bytes=new Uint8Array(file('modelos/'+name)),book=x.read(bytes,{type:'array'});
  assert.deepEqual(Array.from(book.SheetNames),['Instruções','Obra','Estruturas','Concretos','Peças','Usuários','Fornecedores']);
  if(name.includes('EXEMPLO')){const out=core.parse(bytes,x);assert.equal(out.formato,'novo');assert.equal(out.grupos.length,3);assert.equal(out.concretos.length,3);assert.equal(out.usuariosObra.length,3);assert.equal(out.fornecedores.length,2);}
 }
});
