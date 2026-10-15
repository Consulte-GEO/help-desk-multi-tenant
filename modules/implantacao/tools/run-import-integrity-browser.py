#!/usr/bin/env python3
"""Ensaio focal de motores/ponte com colaboradores sintéticos. Sem rede externa.
Não substitui o browser da aplicação real nem valida leitura/exportação XLSX.
"""
from pathlib import Path
import argparse, json, shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SETUP = r"""() => {
const S=window.SimilarityEngine,I=window.ImportIntegrity;
const make=id=>({_rowId:id,_source:{sheet:'Controle',line:Number(id)},_raw:{slump:120,flow:''},_provenance:{Volume:{provenance:'DADO_ORIGINAL'}},
'Data Concretagem':'01/10/2026',Bloco:'Torre A',Unidade:'1º',Peça:'Laje',Volume:8,Slump:12,Flow:''});
const appState={settings:{slumpSourceMeaning:'auto',strictMode:true},insumos:{estrutura:{pairs:[]}},pre:{candidateRows:[],convertedRows:[],issues:[],corrections:[],proposals:[],decisionLog:[],selectedSheet:'Controle',columns:[{index:0,rawLabel:'Slump'}],mapping:{fields:{Slump:{sourceIndex:0}}}}};
const Utils={esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),isFilled:x=>x!==''&&x!=null};
const message=document.getElementById('message');
const Toast={warn:x=>message.textContent=x,error:x=>message.textContent=x};
let exports=0;
const UI={loading(){},preSetup(){return ''},preMapping(){return ''},prePreview(){return ''},proposalCard(){return '<button data-action="accept-proposal">Aceitar nesta linha</button>'},
render(){document.getElementById('mapping').innerHTML=this.preMapping();document.getElementById('preview').innerHTML=this.prePreview();document.getElementById('result').textContent=JSON.stringify({rows:appState.pre.convertedRows,issues:appState.pre.issues,exports});}};
const Converter={prepare(){Object.assign(appState.pre,{candidateRows:[make('1'),make('2')],issues:[],corrections:[],decisionLog:[],proposals:[]})},group(){return{type:'slump'}},applyGroup(){appState.pre.candidateRows[0].Slump=12},sourceMark(r,f,raw,value){S.mark(r,f,'NORMALIZACAO_AUTOMATICA','Fonte',raw,true)},refreshSummary(){appState.pre.summary={criticals:appState.pre.issues.filter(x=>x.severity==='CRÍTICO').length}}};
const Validators={validateAll(){appState.pre.issues=[]}};
const Actions={resetPreDerived(){appState.pre.candidateRows=[]},selectSheet(name){appState.pre.selectedSheet=name},findRow:id=>appState.pre.candidateRows.find(x=>x._rowId===id),
editRow(id,key,val){const r=this.findRow(id);r[key]=val;S.mark(r,key,'DADO_ORIGINAL','Manual',null,true);Converter.finalize();UI.render()}};
const Exporter={downloadImport(){if(appState.pre.summary.criticals===0)exports++;UI.render()}};
window.ImportLegacyAdapter.install({appState,Converter,Actions,Validators,Exporter,UI,Utils,Toast,Similarity:S,integrity:I,document,requiredFields:[]});
window.fixture={appState,Converter,Actions,Exporter,UI,exports:()=>exports};
document.getElementById('prepare').onclick=()=>{Converter.prepare();Converter.finalize();UI.render()};
document.getElementById('group').onclick=()=>{Actions.editRow('1','Número Concretagem','8');Actions.editRow('2','Número Concretagem','8')};
document.getElementById('export').onclick=()=>Exporter.downloadImport();UI.render();
}"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    results=[];errors=[];completed=False;failure=None
    def check(name,condition):
        results.append({'name':name,'passed':bool(condition)})
        if not condition:raise AssertionError(name)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1280,'height':850});page.on('pageerror',lambda err:errors.append(str(err)))
            # Ensaio DOM offline: nenhuma navegação nem acesso a site bloqueado.
            page.route('**/*',lambda route:route.abort())
            html=(ROOT/'tools/tests/import-integrity/browser-fixture.html').read_text(encoding='utf-8')
            for name in ['similarity-engine','import-integrity','import-legacy-adapter']:
                html=html.replace(f'<script src="../../../frontend/public/assets/{name}.js"></script>','')
            page.set_content(html)
            for name in ['similarity-engine','import-integrity','import-legacy-adapter']:
                page.add_script_tag(path=str(ROOT/f'frontend/public/assets/{name}.js'))
            page.evaluate(SETUP)
            page.locator('#prepare').click()
            check('unidade ausente deixa medição vazia',page.evaluate("fixture.appState.pre.candidateRows.every(r=>r.Slump==='')"))
            page.locator('#export').click();check('pendência impede exportador colaborador',page.evaluate('fixture.exports()===0'))
            page.locator('[data-import-unit-field="Slump"]').select_option('mm');page.locator('#prepare').click()
            check('declaração da origem normaliza 120 mm para 12 cm',page.evaluate('fixture.appState.pre.candidateRows.every(r=>r.Slump===12)'))
            check('eventos permanecem distintos antes da confirmação',page.evaluate("fixture.appState.pre.convertedRows[0]['Número Concretagem']!==fixture.appState.pre.convertedRows[1]['Número Concretagem']"))
            page.locator('#group').click();check('confirmação preservada na revalidação',page.evaluate("fixture.Converter.finalize();fixture.appState.pre.convertedRows.every(r=>r['Número Concretagem']===8)"))
            page.evaluate("fixture.Actions.editRow('1','Slump','12±2')")
            check('faixa manual recusada',page.evaluate('fixture.appState.pre.candidateRows[0].Slump===12') and 'especifica' in page.locator('#message').inner_text().lower())
            page.evaluate("fixture.Actions.editRow('1','Slump','125 mm')")
            check('edição documentada preserva valor e origem',page.evaluate("fixture.appState.pre.candidateRows[0].Slump===12.5&&fixture.appState.pre.candidateRows[0]._freshEvidence.Slump.raw==='125 mm'"))
            page.locator('#export').click();check('sem pendência libera colaborador uma vez',page.evaluate('fixture.exports()===1'))
            page.locator('[data-import-unit-field="Slump"]').select_option('cm')
            page.locator('#export').click()
            check('mudança de unidade invalida exportação já preparada',page.evaluate('fixture.exports()===1') and 'origem' in page.locator('#message').inner_text().lower())
            page.screenshot(path=str(out/'browser-focal.png'),full_page=True)
            check('nenhum erro de JavaScript',not errors);browser.close();completed=True
    except Exception as error:
        failure=str(error)
        raise
    finally:
        (out/'browser-focal.json').write_text(json.dumps({'scope':'offline_dom_synthetic_collaborators_not_full_app','status':'passed' if completed else 'failed','failure':failure,'results':results,'javascriptErrors':errors},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':sum(x['passed'] for x in results),'total':len(results),'scope':'focal_not_full_application'}))

if __name__=='__main__':main()
