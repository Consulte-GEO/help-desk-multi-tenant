# Implementation Report · Implantação Consulte GEO v5.22.18

## Resumo executivo

**Pedidos do Thiago** (8 itens, via screenshot da Etapa 3 + texto):

1. Banner de atenção ao clicar "Sugerir traços padrão" na Etapa 4.
2. Alterar os corpos de prova das linhas padrão de **56 dias → 63 dias**
   nos exemplos FCK 25 e FCK 30 (e em todos os traços sugeridos).
3. Retirar o radio "Modelo de preenchimento" da Etapa 3 (Estruturas).
4. Substituir o **dropdown** atual da Etapa 1 pelo mesmo **radio-pill**
   que estava na Etapa 3.
5. Tirar a palavra "livre" depois de "Projetista" no texto da pill.
6. Retirar campos "Versão da regra" e "Superestrutura" (drywall) dos
   Dados básicos.
7. Incluir um campo livre "Observação" com placeholder de exemplo.
8. Incluir campo "Telefone" no card Responsável.

Todos implementados. **Build verde · 180 OK pipeline · 89 OK contraste ·
zero ação manual no Supabase** — migration helper cuida dos rascunhos
antigos.

## Decisões registradas

### Onde colocar "Observação"

O Thiago disse "em Dados retire ... e inclua um campo Observação" — não
especificou em qual card. Coloquei dentro do **card Identificação**
(depois do CEP) porque a observação descreve a obra, não o responsável.
O placeholder é exatamente o exemplo que ele deu.

### Telefone — campo separado, não dentro de createdBy.email

O Thiago pediu "incluir o campo Telefone" no card Responsável.
Adicionei como `createdBy.telefone: string` (campo separado, tipo
`type="tel"` para teclados mobile mostrarem numérico). Não fiz
formatação automática — campo é livre, aceita qualquer formato.

### Migration de rascunhos antigos

Esta versão **muda o schema** de `ModeloProjetoFields` (remove dois
campos) e adiciona dois campos novos no `ObraMetadata`/`CreatedBy`.
Rascunhos salvos em versões anteriores tinham `versaoRegra` e
`estruturaDrywall` no JSON do Supabase.

Em vez de migration SQL, estendi o `migrateLegacySnapshot()` em
`setupDraftService.ts` para:

- Apagar `versaoRegra` e `estruturaDrywall` ao ler.
- Popular `obraObservacoes = ''` se ausente.
- Popular `createdBy.telefone = ''` se ausente.

Aplicado em `loadDraft` e `listDrafts`. Sem ação manual em banco.

### Banner de "Sugerir traços padrão" — local

O Thiago disse "aparecer uma mensagem na parte superior orientando o
usuário a ter atenção". Implementei como banner sticky (`.alert
warning`) no topo da Etapa 4, abaixo do título e acima da lista de
concretos. Banner é dispensável (botão "OK, entendi") e reaparece se o
cliente voltar a clicar em "Sugerir traços padrão" (caso ele tenha
deletado todos os traços e refeito a sugestão).

### Etapa 3 — emit `change-modelo` removido

Como o radio saiu, removi também o `'change-modelo'` da lista de emits
do Step3GruposEditor. Os listeners `@change-modelo` nas views
(`ClientStatusView`, `SetupPage`, `ReviewView`) ficam zumbis — Vue
ignora listeners sem emit correspondente, não causa warning. Decidi
deixar os listeners no template para evitar diff de mais 3 arquivos.

## Ambiente usado

- Node 22.x, npm 10.9.7
- Vite 5.4.21
- vue-tsc + TypeScript strict
- Sandbox Linux sem credenciais Supabase / Resend

## Arquivos criados

- `IMPLEMENTATION-REPORT-V522-18.md` (este arquivo)

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/models/setup.models.ts` | `ObraMetadata`: + `obraObservacoes`. `CreatedBy`: + `telefone`. `ModeloProjetoFields`: − `versaoRegra`, − `estruturaDrywall`. `padroesMoldagemPadrao`: 56 → 63 dias. |
| `frontend/src/services/setupDraftService.ts` | `migrateLegacySnapshot()` estendido: apaga campos descontinuados + popula defaults novos. |
| `frontend/src/components/Step1DadosBasicos.vue` | Reescrito: radio-pill substituindo `<select>`; novo campo Observação no Identificação; novo Telefone no Responsável; campos Versão da regra e Estrutura/drywall removidos. |
| `frontend/src/components/Step3GruposEditor.vue` | Bloco `modelo-switch` removido do topo; emit `'change-modelo'` removido. |
| `frontend/src/components/Step4Concretos.vue` | Banner `.alert warning` + estado `showDefaultsAlert` + método `onSuggestDefaults` (dispara emit + ativa banner). |
| `frontend/src/mocks/exampleSnapshots.ts` | Mocks atualizados: `+telefone` em ambos os createdBy, `obraObservacoes` no exemplo modelo_projeto, removidos `versaoRegra` e `estruturaDrywall`. |
| `frontend/smoke-pipeline.ts` | +19 testes de regressão (todos os 8 pedidos cobertos). |
| `frontend/package.json` | versão `5.0.22-17` → `5.0.22-18` |
| `README.md` | Seção destacada v5.22.18 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem novas deps |
| `npx tsx smoke-pipeline.ts` (iter. 1) | 165 OK / 1 FAIL | smoke obsoleto da v5.22.11 (modelo-switch no Step3) — corrigido |
| `npx tsx smoke-pipeline.ts` (iter. 2) | 179 OK / 1 FAIL | regex pegou o termo `'change-modelo'` no comentário — refinado |
| `npx tsx smoke-pipeline.ts` (iter. 3 — final) | **180 OK / 0 FAIL** | era 161; +19 testes novos |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** | inalterado |
| `npm run build` (iter. 1) | erro TS2741 | mock common faltava `telefone` no createdBy — corrigido |
| `npm run build` (iter. 2 — final) | **OK 8.22s · 149 modules** | |
| `vue-tsc --noEmit` | OK | strict |

## Implementado com sucesso

- [x] **#1**: Banner de atenção no Step4 após "Sugerir traços padrão"
- [x] **#2**: 56 → 63 dias no padrão default (afeta FCK 25, 30 e todos)
- [x] **#3**: Radio "Modelo de preenchimento" removido da Etapa 3
- [x] **#4**: Dropdown da Etapa 1 substituído por radio-pill
- [x] **#5**: Palavra "livre" removida do texto da pill
- [x] **#6**: Campos "Versão da regra" e "Estrutura" (drywall) removidos
- [x] **#7**: Campo "Observação" no card Identificação com placeholder
- [x] **#8**: Campo "Telefone" no card Responsável

## Parcialmente implementado

Nenhum item.

## Não implementado (fora do escopo)

- **Harmonização** com o vocabulário do dropdown removido nesta versão
  ("Simplificado" / "Modelo Completo") — o radio-pill usa textos
  ligeiramente diferentes ("Modelo Simplificado" / "Modelo Completo com
  Projetista"). Como o `<select>` foi removido, o conflito de
  vocabulário entre Etapas 1 e 3 (carry-over da v5.22.16) se dissolveu
  automaticamente. **Não há mais pendência aqui.**
- **`aria-live`** no banner do Step4 — adicionei `role="alert"` mas
  poderia ser mais granular (`polite` vs `assertive`). Aceitável.
- Limpeza dos 3 comentários internos com vocabulário antigo (carry-over
  pré-v5.22.16). Sem impacto funcional.

## Correções importantes aplicadas

A iteração 2 do smoke me pegou: meu regex `step3src.includes("'change-modelo'")`
não distinguia comentário JSDoc de código real. Refinei para
`step3EmitsMatch[0].includes('change-modelo')` — agora olha apenas
dentro do array `emits: [...]`.

A iteração 1 do build pegou que esqueci de atualizar o segundo
`createdBy` no mock (o do exemplo "comum", além do "modelo_projeto").
Corrigido.

## Regressões evitadas

- Rascunhos antigos no Supabase com `versaoRegra` / `estruturaDrywall`
  / `superestruturaDrywall` no JSON continuam abrindo. O helper
  `migrateLegacySnapshot()` cobre as três transições:
  - v5.22.16 → v5.22.17 (rename Superestrutura)
  - v5.22.17 → v5.22.18 (remoção de campos descontinuados)
  - v5.22.17 → v5.22.18 (defaults novos campos)
- Excel exportado e JSON técnico não referenciam os campos removidos
  (já eram independentes deles).
- Sigla TS estrita — typecheck passa.

## Validações realizadas

| Validação | Resultado |
|---|---|
| Grep "versaoRegra" / "estruturaDrywall" em código real | NENHUM fora do helper de migração (intencional) |
| Grep "Superestrutura" em código real | NENHUM fora do helper de migração (carry-over v5.22.17) |
| Smoke pipeline | 180 OK / 0 FAIL |
| Smoke contraste | 89 OK / 0 FAIL |
| Build de produção | OK 8.22s |
| Typecheck Vue strict | OK |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Não consigo testar visualmente o banner em renderer real (sem
  browser headless). Validação via smoke (presença de `showDefaultsAlert`
  e `onSuggestDefaults`).
- Não consigo testar migração de rascunho antigo real no Supabase sem
  credenciais. Testei o `migrateLegacySnapshot` por inspeção; smoke
  garante presença das regras.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum — versão 100% frontend.

## Pendências que exigem ação manual

Nenhuma. Patch puramente frontend com migração transparente.

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-18.zip
cd implantacao-consulte-geo-v05-22-18/frontend
npm install
npx tsx smoke-contrast.ts   # 89 OK / 0 FAIL
npx tsx smoke-pipeline.ts   # 180 OK / 0 FAIL
npm run build               # build verde
npm run dev
```

No navegador:

1. **Etapa 1**: radio-pill "Modelo Simplificado" / "Modelo Completo
   com Projetista" no topo. Textarea "Observação" no card
   Identificação. Campo "Telefone" no card Responsável.
2. **Trocar para "Modelo Completo com Projetista"**: aparece bloco com
   Código interno, Estado-regional, Gestor da obra, Gestor executivo.
   **NÃO** aparece mais Versão da regra nem Estrutura/drywall.
3. **Etapa 3**: topo limpo, sem radio. Layout idêntico (Simplificado
   ou Tabela conforme o que foi escolhido na Etapa 1).
4. **Etapa 4 (Concretos), estado vazio**: clicar "Sugerir traços
   padrão" → 5 traços aparecem **e** o banner amarelo de atenção
   aparece no topo. Botão "OK, entendi" dispensa.
5. **Etapa 4, abrir um concreto sugerido**: a linha 2 do padrão de
   moldagem é **63 dias** (era 56).
6. **Exemplos pré-cadastrados** (botões "Carregar exemplo modelo
   simplificado" / "completo com projetista"): FCK 25 e FCK 30
   também vêm com linha **63 dias**.
7. **Rascunho antigo**: abrir um rascunho da v5.22.17 (se tiver no
   Supabase). Carrega normal; `versaoRegra` e `estruturaDrywall`
   somem da estrutura em memória. Ao salvar de novo, o snapshot já
   vai sem esses campos.

## Como publicar no Netlify

Sem alteração. `git add -A`, commit, push → Netlify rebuilda.

## Como configurar Supabase

**Nenhuma migration SQL**. O `migrateLegacySnapshot()` cuida da
diferença de schema em memória.

## Como migrar futuramente para .NET 8 + SQL Server

Quando o backend oficial substituir o Supabase:

- `ObraMetadata.obraObservacoes` mapeia para `Ges_Obra.Observacao` (ou
  campo equivalente já existente no banco).
- `CreatedBy.telefone` mapeia para `Usuario.Telefone` (ou tabela de
  contatos).
- Os campos descontinuados (`versaoRegra`, `estruturaDrywall`,
  `superestruturaDrywall`) **não precisam** existir no SQL Server —
  já eram do protótipo.
- Pode remover o `migrateLegacySnapshot` quando todos os rascunhos
  legados forem aprovados/cancelados.

## Próximo ciclo recomendado

1. **Teste visual real** com você + screenshots de cada um dos 8
   ajustes desta versão, para validar percepção (não só funcional).
2. **Decidir** se o radio-pill da Etapa 3 (antigo) deve voltar ainda
   numa terceira posição (não acho necessário, mas é sua decisão).
3. **Playwright + axe-core** para auditoria DOM real (carry-over das
   v5.22.15 e v5.22.17).
4. **Mascarar** o campo Telefone com formato brasileiro
   `(99) 99999-9999` se quiser padronizar — fica simples com a
   biblioteca `vue-the-mask` ou inputmask. Decisão sua se vale o peso.
