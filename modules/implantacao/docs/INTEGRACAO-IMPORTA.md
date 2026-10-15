# Integração do Copilot de planilhas · v5.22.45

## Três modos ativos

| Modo | Entrada | Motor | Saída |
|---|---|---|---|
| Pré-análise | `/pre-analise.html` ou card do Copilot | `assets/intake-auditor.js` + `intake-selftest.js` | diagnóstico, mensagem e relatório |
| Pré-importação | card `mode-pre` | engines inline + `assets/similarity-engine.js` | XLSX `Importação` + `Proveniência` |
| Pós-importação | card `mode-post` | motor inline preservado | auditoria da planilha consolidada |

O arquivo ativo é `frontend/public/importa.html`. O antigo Copilot da raiz foi
movido para `prototype/v06/importa.html` e não é publicado.

O Excel é processado no navegador com
`frontend/public/vendor/xlsx.full.min.js`. A IA é opcional e recebe somente
resumos de ambiguidades; nunca recebe a pasta de trabalho completa.

## Handoff da Pré-análise

`IntakeBridge`/`appState.intake` permite reutilizar aba, cabeçalho, mapeamento e
inventário já calculados. Sem handoff, o mesmo motor determinístico analisa o
arquivo enviado.

## Pipeline da Pré-importação V8

1. **Arquivo:** detecção de workbook/aba/cabeçalho e expansão de mesclas.
2. **Mapeamento:** sinônimos + perfil de conteúdo; operador confirma/corrige.
3. **Valores propostos:** normalização, estrutura, traço e SimilarityEngine;
   aceite/rejeição em massa e por linha.
4. **Validação:** somente o contrato de
   `docs/PRE-IMPORTACAO-CAMPOS.md` bloqueia.
5. **Exportação:** layout operacional limpo + aba de proveniência.

O fluxo caiu de seis para cinco etapas. Cadastros oficiais são apoio opcional,
não pré-requisito para preservar dados detectados. Resultados de rompimento são
mantidos pela idade encontrada no cabeçalho, mesmo sem cadastro interno.

## SimilarityEngine

Arquivos:

```text
frontend/public/assets/similarity-engine.js
frontend/public/assets/similarity-selftest.js
tools/run-similarity-tests.js
```

Regras principais: Slump/Flow a partir do traço, traço por FCK+aplicação,
Usina/Laboratório únicos, placa `IMPORT`, volume somente com autorização e
conflito de FCK como pendência. Nenhuma proposta sobrescreve dado original.

## Validação funcional executada

```bash
node tools/run-intake-tests.js          # 27/27
node tools/run-similarity-tests.js      # 12/12
python3 tools/run-importa-v8-browser-tests.py
```

O browser converteu a planilha de exemplo com 10 registros, aceitou um Slump 12,
rejeitou outro, exportou 10 linhas e 132 registros de proveniência, executou o
self-test da Pré-análise `27/27` e abriu a Pós-importação sem erro.
