# R01 — Baseline e capacidades de implantação

Data: 14/10/2026. Execução do plano aprovado, primeiro lote. **Não operacional.**

## Bases e alcance da inspeção

| Recurso | Referência | Evidência e limite |
|---|---|---|
| Setup | `Consulte-GEO/setup-implantacao-obras`, `main`, `dcf5607652281bb688f366e6a4f05e07eb698d31` | Ref confirmada pelo conector GitHub nesta execução; quatro arquivos completos recuperados e conferidos pelo Git blob SHA; demais leituras selecionadas. |
| Help Desk | `codex/m1-reproducibilidade`, `5e873fd9e1361501566e37368f8b5147bf2f0c2d` | Referência do planejamento anterior; não é nova auditoria de produção nem nova confirmação do HEAD. Não alterado nesta entrega. |
| Wiki | `main`, `569f331850e639e153768995c311f5657f47fa4e` | Referência documental do plano anterior; não alterada nesta entrega. |

O clone direto foi tentado e recusado por resolução DNS de github.com. O conector permitiu leitura. O workspace usado é um **snapshot parcial**, não clone integral. Não existe aqui prova de build completo, typecheck Vue ou implantação hospedada.

Arquivos completos de referência:

| Caminho | Git blob SHA de origem |
|---|---|
| `frontend/public/assets/similarity-engine.js` | `af565ad05598db77c3bb0e689a3c1608ab442dbc` |
| `frontend/public/assets/similarity-selftest.js` | `04ae63ab658593ed660bf5de53428a4689ba4e5d` |
| `frontend/src/services/geoControleExportService.ts` | `c6679e852133a1cbc2a93942563d7625ae7c6cd5` |
| `frontend/src/services/normalizationService.ts` | `7922071bc28c5d9c2acb5a98117dc511289d06f7` |

Arquivo monolítico lido em trechos: `frontend/public/importa.html`, blob `485678b4e03d6473542875ac6225da6973fc1d7d`. A montagem fornecida é uma transformação ancorada nesse blob; não foi reconstruída uma cópia incompleta desse HTML.

Metadados remotos: `frontend/package.json` 5.0.22-51, blob `e97db9438db69e481425501d2eba7b0fac8e469a`; `frontend/package-lock.json` ainda 5.0.22-45 no pacote raiz, blob `a1b27603ea91ff4825a2d94b00c1bea692b9b6c5`. A transformação sincroniza ambos em **5.0.22-52**, sem alterar dependências/resoluções. O Copilot estático muda 3.4.0 → 3.5.0. Nenhuma dessas versões foi publicada nesta sessão.

## Matriz de capacidades — qualificação ainda necessária

| Destino/operação | O que a fonte mostra | Evidência que falta | Conduta R01 |
|---|---|---|---|
| Modelo técnico SQL Server / cadastro | `jsonGeneratorService.ts` é um alvo distinto | Receptor atual, versão, exemplo aceito e recibo | Preservado; nenhuma chamada/execução. |
| `geomat:criar_obra` / cadastro | `geoControleExportService.ts` produz JSON | Consumidor aceitar schema 1.2.0 e atributos agora separados/normalizados | Exportador candidato corrigido e testado localmente; não habilitar execução automática. |
| XLSX histórico / concretagens e entregas | Copilot monta layout `Importação` | Importador real, campos efetivos, atomicidade, efeitos e leitura de confirmação | Preparação assistida apenas; arquivo gerado não significa importado. |
| Resultados/CPs | Conversor preserva resultados; wiki registra canal laboratorial separado e lacunas | Contrato e identificação exatos do receptor, comportamento de reenvio e revisões | Sem executor, sem inventar CPs. Núcleo de contagem não homologa importação. |
| PDF/laudo | Leitor existente e vínculo documental descrito no plano | Contrato de upload/vínculo, controle de revisão e efeitos na avaliação | Sem alterações de OCR/Edge e sem chamadas pagas. |
| Conciliação | Auditor de plausibilidade existente | Fonte aprovada, recibos e leitura completa do destino | IMP-11 não implementado; total de volume não prova fidelidade. |

**IMP-00 não está concluído:** falta qualificar ao menos um destino real com exemplo aceito e observação da gravação. Esta tabela não substitui teste de contrato ou validação do responsável.

## Preservações

Vue/Vuex, skeleton .NET, banco, migrations, Edge Functions, autenticação, secrets, MFA, flags operacionais e política de merge não foram modificados. O pacote escreve apenas no checkout local indicado, mediante `--apply`, com branch isolada e base conferida. Nenhum dado de cliente integra os testes.
