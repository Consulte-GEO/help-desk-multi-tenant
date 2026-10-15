# IMPLEMENTATION REPORT · v5.22.45 · V8

Data: **07/08/2026**
Sistema: **Implantação Consulte GEO**
Fonte de entrada: pacote V7 completo + patches V7 + prompt operacional
Versão entregue: `5.0.22-45`

## 1. Resultado executivo

O ciclo V8 foi executado sobre a fonte fornecida e entregou:

- Pré-importação simplificada com propostas revisáveis;
- SimilarityEngine determinístico e auditável;
- proveniência por campo e XLSX com aba de auditoria;
- manutenção da Pós-importação;
- writer XLSX interno para a exportação técnica do wizard;
- pdf.js self-hosted no leitor de laudos;
- fechamento RLS/RPC por token no Supabase;
- validação de posse nas Edge Functions;
- correções no painel administrativo e remoção de serviço órfão;
- organização do protótipo histórico;
- documentação operacional, relatório, handoff e pacotes de entrega.

O Supabase já está no contrato V8: migrations 016–023 aplicadas,
`submit-for-validation` ativa na versão 4 e `share-draft-link` ativa na versão 1.
O frontend V8, porém, **não foi enviado ao GitHub nem implantado no Netlify**.
Os gates npm oficiais ficaram bloqueados por falha do registry interno, não por
falha funcional identificada no código.

## 2. Reconstrução e baseline

A fonte V7 continha a evolução até v5.22.44. O patch V43→V44 foi usado para
reconstruir uma baseline lógica e preservar a sequência dos commits. O ciclo V8
foi aplicado sem force-push e sem hard delete de ativos históricos.

Referências:

```text
baseline reconstruída V43: c7b0255
fonte V44:                 f663bc9
commit funcional V8:       3178ee05c3bebee5421df14fefd2b05c3f03bdac
base do patch V8:           f663bc9
```

O `main` remoto observado em 07/08/2026 era
`69b2e0d6d7d2612cba46a489dee70bf2f4ae5172`. O deploy Netlify observado ainda
usava `2f35b6cf55236fbd5a7aaa6bcc7da8b901363d56`.

## 3. Pré-importação

### 3.1 Fluxo

`frontend/public/importa.html` passou de seis para cinco etapas:

1. Arquivo;
2. Mapeamento;
3. Valores propostos;
4. Validação;
5. Exportação.

Antes, a etapa inicial exigia seis entradas: arquivo, estrutura, usinas,
laboratórios, traços e idades. Depois da V8, apenas o arquivo é obrigatório para
iniciar; os cinco catálogos passam a ser referências opcionais. A validação por
linha permanece restrita aos oito campos bloqueantes reais do layout final.

O operador confirma o mapeamento, revisa propostas e vê apenas pendências que
afetam o contrato de importação. Catálogos servem como referência: sem catálogo,
o texto do cliente é preservado; sem correspondência segura, o valor não é
substituído.

### 3.2 Layout final

O XLSX de Pré-importação possui:

- `Importação` — layout operacional;
- `Proveniência` — origem, regra, valor original, decisão e aceite do operador.

Campos bloqueantes: Data Concretagem, N.F. DANFE, Volume, Bloco, Unidade,
Concreto, Usina e Laboratorio. Slump/Flow são condicionais. Resultados de
rompimento são mantidos por idade detectada.

### 3.3 Pós-importação

O modo de Pós-importação foi preservado no mesmo Copilot e abriu corretamente ao
fim do E2E browser.

## 4. SimilarityEngine

Arquivos criados:

```text
frontend/public/assets/similarity-engine.js
frontend/public/assets/similarity-selftest.js
tools/run-similarity-tests.js
```

O motor implementa:

- Slump/Flow nominal do traço;
- traço por FCK + aplicação;
- conflito de FCK como pendência;
- Usina/Laboratório únicos para vazios;
- Placa `IMPORT` como padrão operacional;
- Volume padrão somente com autorização explícita;
- aceite, rejeição e proveniência;
- proteção absoluta do dado original.

Proveniências:

```text
DADO_ORIGINAL
NORMALIZACAO_AUTOMATICA
INFERIDO_POR_SIMILARIDADE
PADRAO_OPERACIONAL
PENDENTE_CLIENTE
```

## 5. Exportação Excel

A dependência `xlsx-js-style` foi removida. A exportação técnica do wizard usa
`frontend/src/vendor/xlsxStyleLite.ts` e continua gerando 13 abas. O writer
implementa o subconjunto OOXML usado pelo produto: tipos de célula, estilos,
formatos numéricos, mesclas, filtros, congelamento, dimensões e aba ativa.

Validações executadas:

- ZIP/XML estrutural;
- workbook sintético;
- abertura com `openpyxl`;
- mescla `A4:B4`;
- freeze `A2`;
- filtro `A1:B3`;
- formato `#,##0.00`;
- aba ativa preservada;
- exportação técnica real de 13 abas aberta com sucesso.

Vuex 4 foi preservado. Uma tentativa de store local para contornar o registry
foi revertida e não faz parte do produto.

## 6. Laudos PDF

O grande bloco inline de pdf.js foi extraído para:

```text
frontend/public/vendor/pdf.mjs
frontend/public/vendor/pdf.worker.mjs
```

O teste browser carregou um PDF local, extraiu seis resultados e não registrou
erros de console ou página.

## 7. Correções de produto e organização

- remoção de `setupSubmissionService.ts`, que não tinha consumidores;
- allow-list de cleanup atualizada;
- prioridade do painel admin agora pode ser realmente removida;
- leitura de variáveis em `supabaseClient.ts` compatível com Vite e Node;
- fontes históricas movidas para `prototype/v06/`;
- versão sincronizada em package, Copilot, Pré-análise e IntakeAuditor;
- workflow de Edges deliberadamente não criado sem secrets confirmados.

## 8. Supabase/RLS

### 8.1 Migrations aplicadas

```text
016 close setup_submissions e view admin
017 audit append-only
018 tokens, RPCs e fechamento de drafts/exports/audit
019 hardening admin/tickets/comments e índices
020 allow-list e metadados de auditoria no banco
021 compatibilidade de is_admin() com policies públicas
022 primeiro hardening de escrita do draft
023 reconciliação final concorrente/idempotente por id+token
```

A 023 foi necessária porque a 022 já havia sido registrada quando o contrato de
primeiro save foi refinado. A correção foi incremental, sem editar migration
aplicada.

### 8.2 Modelo de capacidade

O cliente usa `draftId + draftToken`. A anon key deixa de ser tratada como
autorização. Tabelas operacionais não expõem grants diretos de `anon`; o cliente
usa RPCs por token e Edges que revalidam a dupla antes de usar `service_role`.

### 8.3 Auditoria

`setup_audit_events` ficou append-only. O cliente grava por RPC, com allow-list,
tamanho limitado e metadados de fonte/timestamp controlados pelo banco.

### 8.4 Testes remotos

A migration 023 foi exercitada em transação autolimpante:

- criação por UUID/token: OK;
- retry/update pelo mesmo token: OK;
- token incorreto: rejeitado;
- cancelamento: OK;
- segundo cancelamento idempotente: OK;
- dados de teste remanescentes: 0.

Também foram verificadas policies, grants, RLS ativa e leitura pública de ajuda.

## 9. Edge Functions

### Estado remoto confirmado

| Função | Versão | Estado | Observação |
|---|---:|---|---|
| `submit-for-validation` | 4 | ativa | valida id+token+status+lock e compensa parciais |
| `share-draft-link` | 1 | ativa | valida posse e envia link por fragmento |
| `importa-openai` | 1 | ativa | opcional; fora do fluxo determinístico principal |

As duas Edges V8 foram implantadas pelo conector Supabase nesta execução.

### Workflow futuro

Não foi criado `.github/workflows/deploy-edge-functions.yml`. Os secrets do
GitHub não foram confirmados; um workflow nessa condição seria quebrado. Após
cadastrar `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` e um environment
protegido, crie um fluxo manual com confirmação explícita.

As duas Edges V8 já estão ativas no Supabase. Não foi executado caminho positivo
de ticket/e-mail para evitar efeitos reais; uma tentativa de testar apenas erros
por HTTP no container foi bloqueada por DNS.

## 10. Resultados de validação

### 10.1 Gates verdes

| Gate | Resultado |
|---|---:|
| Pré-análise Node | `27/27` |
| SimilarityEngine | `12/12` |
| self-test browser do Copilot | `18/18` |
| Pré-análise browser | `27/27` |
| Pré-importação browser | 10 registros, total excluído, aceite/rejeição OK |
| XLSX da Pré-importação | 2 abas; 10 linhas; 132 proveniências |
| Pós-importação | abriu sem erro |
| laudos PDF browser | 6 resultados; 0 erros |
| contraste | `89 OK, 0 FAIL` |
| smoke estrutural alternativo | `578 OK, 1 FAIL` conhecido |
| transpile TS/Vue/Edge selecionado | 11 alvos; 0 erro |
| writer XLSX | estrutural + `openpyxl` OK |
| `git diff --check` | OK |
| migration 023 remota | todos os cenários OK; cleanup 0 |

O smoke estrutural alternativo usou `ts-node` global e um shim temporário de
`createStore`, removido depois. Ele é evidência complementar e não substitui a
execução oficial com Vuex 4 instalado pelo lockfile.

### 10.2 Gates oficiais bloqueados

| Comando | Resultado |
|---|---|
| `npm ci` | E404 em `vuex@4.1.0` no registry interno |
| `npm run build` | não executável sem a instalação completa |
| `npm run typecheck` | `vue-tsc` não instalado após a falha |
| `npm run smoke` | `tsx` não instalado após a falha |
| `npm run smoke:contrast` | `tsx` não instalado após a falha |
| `npm audit --omit=dev` | endpoint audit retorna 404 |

O bloqueio é ambiental. O release não é declarado “buildado” nem “auditado”
pelos gates oficiais.

## 11. GitHub e Netlify

### GitHub

- branch local `codex/v8-v5.22.45` criada no commit `8d5f6ec`;
- `git push -u origin codex/v8-v5.22.45` foi tentado e falhou por DNS de
  `github.com`, antes da autenticação;
- nenhum push V8 concluído e nenhum force-push executado;
- commits locais e patch completos entregues;
- o conector disponível nesta etapa expôs somente operações de leitura.

### Netlify

- site `setupobras` observado;
- deploy `6a75f5a745722500080cea23` em estado `ready`;
- commit publicado `2f35b6cf55236fbd5a7aaa6bcc7da8b901363d56`;
- V8 não implantada.

O deploy não foi disparado porque o GitHub ligado não contém a árvore V8 e os
gates npm oficiais não fecharam. Disparar o conector nesse estado não publicaria
a fonte validada.

## 12. Implementado, parcial e pendente

### Implementado

- Pré-importação V8;
- SimilarityEngine S1–S12;
- proveniência e XLSX auditável;
- writer XLSX interno;
- laudos com pdf.js local;
- correções admin/serviço órfão;
- organização do protótipo;
- RLS/RPC migrations 016–023;
- Edges V8 implantadas;
- documentação, handoff e pacotes.

### Parcial

- integração remota: Supabase concluído; GitHub/Netlify pendentes;
- validação: gates funcionais/estáticos concluídos; npm oficiais bloqueados;
- E2E remoto de e-mail/admin/status depende do preview frontend V8.

### Pendente antes da produção

1. integrar a V8 em branch/PR no GitHub;
2. usar registry npm íntegro e executar todos os gates oficiais;
3. criar preview Netlify;
4. executar E2E remoto completo;
5. promover produção somente depois do preview;
6. tratar `external_cache` e advisors legados em ciclo separado;
7. criar workflow de Edges somente depois de configurar os secrets.

## 13. Riscos residuais

- `public.external_cache` sem RLS;
- views/functions legadas sinalizadas pelo linter;
- leaked-password protection desabilitada;
- endpoint de audit indisponível no registry desta sessão;
- frontend de produção atual incompatível com a afirmação “V8 homologada”.

## 14. Conclusão

A implementação V8 está consolidada em fonte e patch, com Supabase e Edges no
contrato novo, além de evidência funcional ampla. A promoção do frontend foi
corretamente interrompida porque o código ainda não está no GitHub ligado ao
Netlify e o ambiente não conseguiu instalar o lockfile oficial. O próximo passo
operacional é integrar o pacote em branch, fechar os gates npm em ambiente
íntegro e validar um preview antes da produção.
