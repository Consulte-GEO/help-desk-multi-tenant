# Implementation Report · Implantação Consulte GEO v5.22.16

## Resumo executivo

**Pedido do Thiago**:

1. Alterar label "Carregar Exemplo Comum" para "Carregar Exemplo Modelo Simplificado".
2. No dropdown "Modelo de preenchimento":
   - "Cliente Comum" → "Simplificado"
   - "Modelo com Projetista" → "Modelo Completo"

Versão de texto puro — sem mudança funcional, sem mudança de schema,
sem mudança de contrato JSON, sem mudança de validação. Apenas
relabel de 3 strings visíveis na interface.

**Build verde · typecheck verde · 161 smokes pipeline · 78 smokes contraste.**

## Decisão registrada — não tocar nos valores do enum

O dropdown e os exemplos usam internamente os valores `'comum'` e
`'modelo_projeto'` como chaves do enum `ModeloPreenchimento`. Esses
valores são referenciados em:

- `validationService.ts` — branching de regras
- `excelExportService.ts` — exportação técnica
- `mocks/exampleSnapshots.ts` — pré-cadastros
- `models/setup.models.ts` — tipo TypeScript
- `store/modules/setup.ts` — mutations
- `views/SetupPage.vue`, `views/ReviewView.vue`, `views/ClientStatusView.vue`

Trocar os valores do enum por novas chaves seria mudança de schema:
quebra rascunhos salvos no Supabase, quebra exemplos antigos, quebra
o JSON técnico exportado. **Mantidos como estão**. Só o `<option>` (o
texto visível) foi alterado.

## Decisão registrada — não harmonizei a Etapa 3 sem pedido

Na Etapa 3 (`Step3GruposEditor.vue`) existe um **radio pill** que
controla o **mesmo valor** (`modeloPreenchimento`) com labels:

- "Modelo Simplificado" (já estava assim)
- "Modelo Completo com Projetista"

Comparando com os novos labels do dropdown da Etapa 1:

| Local | Valor `'comum'` | Valor `'modelo_projeto'` |
|---|---|---|
| Etapa 1 — dropdown (v5.22.16) | **Simplificado** | **Modelo Completo** |
| Etapa 3 — radio pill (mantida) | Modelo Simplificado | Modelo Completo com Projetista |

Você não pediu para mexer na Etapa 3, então deixei como está. Se
quiser harmonizar (tornar 100% idênticos), é mais um patch de uma
linha — me avise e eu gero a v5.22.17.

## Ambiente usado

- Node 22.x, npm 10.9.7
- Vite 5.4.21
- vue-tsc + TypeScript strict
- Sandbox Linux sem credenciais Supabase / Resend

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/AppShell.vue` (linha 41) | "Carregar exemplo comum" → "Carregar exemplo modelo simplificado" |
| `frontend/src/components/Step1DadosBasicos.vue` (linhas 118–119) | `<option>Cliente comum</option>` → `<option>Simplificado</option>` e `<option>Modelo com projetista</option>` → `<option>Modelo Completo</option>` |
| `frontend/package.json` | versão `5.0.22-15` → `5.0.22-16` |
| `README.md` | seção destacada v5.22.16 |

## Arquivos criados

- `IMPLEMENTATION-REPORT-V522-16.md` (este arquivo)

## Arquivos removidos

Nenhum.

## Resíduos intencionais — comentários técnicos (não visíveis)

Os termos antigos sobreviveram em **comentários de código** (não
afetam a interface):

```
frontend/src/mocks/exampleSnapshots.ts:18    /* Exemplo 1: Cliente comum                                            */
frontend/src/mocks/exampleSnapshots.ts:110   /* Exemplo 2: Modelo com projetista                                    */
frontend/src/services/validationService.ts:271   /* --- Modelo com projetista: número da estrutura obrigatório ----- */
```

Decisão: deixados como contexto histórico do código. Comentários de
linha não aparecem ao usuário. Se preferir limpar para coerência de
vocabulário interno, são 3 edições triviais — peça que faço.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | Sem novas deps |
| `npx tsx smoke-contrast.ts` | 78 OK / 0 FAIL | Inalterado vs v5.22.15 |
| `npx tsx smoke-pipeline.ts` | 161 OK / 0 FAIL | Inalterado vs v5.22.15 |
| `npm run build` | OK 7.28s · 149 modules | Bundle inalterado |
| `vue-tsc --noEmit` | OK | Sem alteração de tipos |

## Implementado com sucesso

- [x] Botão "Carregar exemplo comum" agora exibe "Carregar exemplo modelo simplificado"
- [x] Dropdown da Etapa 1: "Cliente comum" → "Simplificado"
- [x] Dropdown da Etapa 1: "Modelo com projetista" → "Modelo Completo"
- [x] Build verde, smokes verdes, contrato JSON intacto

## Parcialmente implementado

Nenhum item.

## Não implementado (por opção, não por bloqueio)

- Harmonização do radio pill da Etapa 3 com o novo vocabulário do
  dropdown. Aguarda confirmação sua antes de mexer.
- Limpeza dos 3 comentários internos que ainda usam o vocabulário
  antigo. Aguarda confirmação sua.

## Regressões evitadas

- Nenhum valor de enum foi alterado → rascunhos antigos no Supabase
  continuam funcionando.
- Nenhum schema JSON foi tocado → consumidores downstream intactos.
- `validationService.ts` ainda branching corretamente em `'comum'`
  vs `'modelo_projeto'`.
- `excelExportService.ts` ainda gera a célula "Modelo de
  preenchimento" com o valor interno (`'comum'` ou `'modelo_projeto'`).
  Se quiser que o Excel mostre o label novo, é outro patch.

## Validações realizadas

| Validação | Resultado |
|---|---|
| Contraprova grep "Cliente comum/Comum" em código visível | NENHUM (só em 1 comentário de mock) |
| Contraprova grep "Modelo com projetista" em código visível | NENHUM (só em 2 comentários internos) |
| Contraprova grep "exemplo comum" | NENHUM |
| Smoke pipeline | 161 OK / 0 FAIL |
| Smoke contraste | 78 OK / 0 FAIL |
| Build de produção | OK 7.28s |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
Nenhum.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum — versão 100% frontend cosmético.

## Pendências que exigem ação manual

Nenhuma. O patch é puro relabel; pode ir direto para produção.

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-16.zip
cd implantacao-consulte-geo-v05-22-16/frontend
npm install
npx tsx smoke-contrast.ts   # 78 OK / 0 FAIL
npx tsx smoke-pipeline.ts   # 161 OK / 0 FAIL
npm run build               # build verde
npm run dev
```

Em seguida, no navegador:

1. Topbar até Etapa 2: o botão à direita diz "Carregar exemplo modelo simplificado".
2. Etapa 1, campo "Modelo de preenchimento": o dropdown lista "Simplificado" e "Modelo Completo".
3. Selecionar "Modelo Completo": os campos extras (`idCRM`, etc.) aparecem — comportamento idêntico ao da v5.22.15.

## Como publicar no Netlify

Sem alteração. `git add -A`, commit, push → Netlify rebuilda automaticamente.

## Como configurar Supabase

Sem alteração nesta versão.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto — esta versão é exclusivamente cosmética.

## Próximo ciclo recomendado

Aguardar sua decisão sobre:

1. Harmonizar a Etapa 3 (radio pill) com o novo vocabulário?
2. Limpar os 3 comentários internos que ainda usam "Cliente comum" / "Modelo com projetista"?
3. Atualizar o Excel exportado para mostrar o label visível ao invés do valor de enum interno?
