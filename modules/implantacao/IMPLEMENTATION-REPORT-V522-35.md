# Implementation Report · Implantação Consulte GEO v5.22.35

## Resumo executivo

2 features de produtividade: ações em lote no painel `/admin` +
navegação por teclado nos Concretos. Pipeline: **514 OK (+20) ·
Contraste: 89 OK · Build: ✓ 8.14s**. Puramente frontend — sem
migration, sem Edge Function, sem dependência nova.

## Features entregues

### Feature 1 — Ações em lote no painel `/admin`

#### O que apareceu

- Coluna de checkbox à esquerda de cada linha
- Checkbox "selecionar todos" no header (com indeterminate)
- Barra de ações em lote (aparece só com seleção ativa):
  contagem + dropdown de prioridade + botão Aplicar + Limpar seleção

#### Decisões registradas

**Por que `Set<string>` recriado a cada toggle?**

Vue 3 Options API não rastreia mutações in-place de `Set` quando
acessado via `this`. `this.selectedIds.add(x)` não dispara
recomputação de `allVisibleSelected`. Solução:

```ts
onToggleRow(it) {
  const next = new Set(this.selectedIds);
  next.has(key) ? next.delete(key) : next.add(key);
  this.selectedIds = next;  // reassignment dispara reatividade
}
```

Custo: criar um Set novo a cada clique. Para listas < 1000 itens
(caso real), imperceptível.

**Por que aplicação sequencial em vez de `Promise.all`?**

```ts
for (const key of this.selectedIds) {
  const result = await setPriority(target, priority);
  // ...
}
```

- Supabase tem rate limit por conexão. 50 chamadas paralelas
  podem disparar 429.
- Sequencial permite reportar progresso e acumular erros sem
  abortar o lote inteiro.
- Trade-off: mais lento (50 itens = ~50 round-trips). Aceito —
  bulk de prioridade não é operação de alta frequência.

**Por que desmarcar "todos" só afeta visíveis?**

```ts
onToggleSelectAll() {
  if (this.allVisibleSelected) {
    for (const it of this.filteredItems) next.delete(this.rowKey(it));
  } else {
    for (const it of this.filteredItems) next.add(this.rowKey(it));
  }
}
```

Se o usuário selecionou 10 itens, depois aplicou um filtro que
mostra só 3, "desmarcar todos" deve afetar só os 3 visíveis —
não apagar os 7 fora de vista. Comportamento padrão de planilhas
e clients de email.

**Por que `@click.stop` no checkbox?**

A linha inteira tem `@click="onSelect(it)"` (abre drill-down).
Sem `@click.stop` no `<td>` do checkbox, marcar abriria o painel
lateral por acidente. Mesma técnica do quick-priority (v5.22.30).

**Por que reportar erros parciais em vez de tudo-ou-nada?**

```ts
if (errors.length > 0) {
  alert(`${applied} aplicado(s). ${errors.length} falharam:\n...`);
}
```

Se 48 de 50 funcionarem e 2 falharem (ex.: item deletado
concorrentemente), abortar tudo seria pior. O usuário vê o que
funcionou e o que não.

#### Limitações aceitas

- **Só prioridade em lote**: não implementei "marcar como visto"
  ou "mudar status" em lote ainda. Prioridade é a ação mais
  frequente de triagem. Outras podem vir depois.
- **Sem undo**: aplicou, aplicou. O audit registra cada mudança,
  então é rastreável, mas não há botão "desfazer lote".
- **Sem "remover prioridade" em lote**: o dropdown não tem opção
  vazia (mesma limitação do quick-priority individual).

### Feature 2 — Navegação por teclado nos Concretos

#### O que apareceu

- Lista de concretos (Etapa 3) é focável (clicar nela)
- ↑/↓ navega entre cards; card ativo ganha outline brand
- Enter/Espaço expande/minimiza o card focado
- Esc minimiza o expandido
- Dica visual com `<kbd>` acima da lista (2+ concretos)

#### Arquitetura

Composable `useListKeyboardNav.ts` puro (sem dependência de Vue):

```ts
export function handleListKeyNav(
  e: KeyboardEvent,
  state: { itemIds, focusedId, expandedId },
): { handled, focusedId?, expandedId?, scrollToId? }
```

Recebe o evento + estado atual, retorna **a intenção** de mudança.
O componente aplica no seu próprio estado:

```ts
onListKeydown(e) {
  const result = handleListKeyNav(e, {...});
  if (!result.handled) return;
  e.preventDefault();
  if (result.focusedId !== undefined) this.focusedId = result.focusedId;
  if (result.expandedId !== undefined) this.expandedId = result.expandedId;
  if (result.scrollToId) scrollToNewItem(`#concreto-${result.scrollToId}`);
}
```

#### Decisões registradas

**Por que retornar intenção em vez de mutar?**

O composable não conhece os nomes das propriedades do componente
(`expandedId`, `focusedId` são convenções do Step4Concretos).
Retornar `{ focusedId?, expandedId? }` deixa o componente aplicar
no seu estado. Bônus: a função pura é testável isoladamente sem
montar o componente.

**Por que `tabindex=0` no grid e não em cada card?**

Alternativa: cada card com `tabindex=0`, navegação via Tab nativo.
Rejeitado:
- Tab nativo entre 10 cards + os inputs internos vira um inferno
  de tabbing
- Queremos ↑/↓ (não Tab) para navegar cards, Tab para campos

Com `tabindex=0` só no grid: uma região focável, navegação interna
controlada por estado (`focusedId`), Tab continua funcionando
normalmente dentro dos campos.

**Por que NÃO interceptar inputs?**

```ts
if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
    target.isContentEditable) {
  return { handled: false };
}
```

Se o usuário está digitando a descrição do traço e aperta ↑, ele
quer mover o cursor no texto — não navegar entre cards. Crítico
para não quebrar a digitação.

**Por que sem wrap-around?**

↓ no último card não volta pro primeiro. Parar no fim é menos
desorientador — o usuário sabe que chegou ao fim da lista. Padrão
de muitos list-navigation (VSCode, Gmail).

**Por que Espaço além de Enter?**

Convenção de acessibilidade: Espaço ativa botões/toggles, Enter
ativa links/submit. Cards expansíveis funcionam como toggles, então
ambos fazem sentido. `preventDefault` impede o Espaço de rolar a
página.

#### Limitações aceitas

- **Só em Concretos**: outras telas do wizard (Estruturas, Peças,
  etc.) não têm navegação por teclado ainda. Concretos é a tela
  mais densa (10+ cards), então é onde mais ajuda.
- **Foco não persiste ao trocar de etapa**: voltar para Concretos
  zera o `focusedId`. Aceito — comportamento previsível.

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `frontend/src/composables/useListKeyboardNav.ts` | ~130 |
| `IMPLEMENTATION-REPORT-V522-35.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/views/AdminDashboardView.vue` | bulk selection: estado, computeds, métodos, template, CSS (~150 linhas) |
| `frontend/src/components/Step4Concretos.vue` | navegação por teclado: import, focusedId, onListKeydown, grid focável, dica kbd |
| `frontend/src/styles/design-system.css` | `.is-kbd-focused` + `.kbd-hint` + `<kbd>` |
| `frontend/smoke-pipeline.ts` | +20 testes; flex check v34 |
| `frontend/package.json` | bump 5.0.22-35 |
| `README.md` | seção destacada v5.22.35 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.35 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.34 | 494 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **514 OK / 0 FAIL** (+20) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 8.14s** |

## Bloqueios

### Por ambiente

- **Sem browser headless**: não testei visualmente:
  - Checkbox indeterminate renderizando corretamente
  - Bulk bar aparecendo/sumindo com animação
  - Navegação ↑/↓ movendo o foco visualmente
  - Outline do card focado
  - Dica `<kbd>` renderizando
- **Sem Supabase real**: não testei `onBulkApplyPriority`
  chamando setPriority de verdade em vários itens

## Pendências manuais

### Deploy

Puramente frontend — push para `main` → Netlify automático.
Sem migration, sem Edge Function nova.

### Smoke tests

#### A. Bulk actions

1. `/admin` com 3+ chamados
2. Marcar checkbox de 2 linhas → bulk bar aparece ("2 selecionado(s)")
3. Marcar não deve abrir o drill-down
4. Checkbox header → marca todos os visíveis
5. Estado indeterminate (traço) quando seleção parcial
6. Escolher prioridade no dropdown da bulk bar + Aplicar
7. As linhas selecionadas ganham a prioridade + highlight visual
8. Seleção limpa após sucesso
9. Aplicar filtro → desmarcar "todos" só afeta visíveis

#### B. Atalhos de teclado nos Concretos

10. Etapa 3 com 2+ concretos → dica `<kbd>` aparece
11. Clicar na lista (não num input) → grid ganha foco
12. ↓ → primeiro card ganha outline brand
13. ↓ várias vezes → foco desce; para no último (sem wrap)
14. ↑ → sobe; para no primeiro
15. Enter no card focado → expande
16. Enter de novo → minimiza
17. Esc → minimiza o expandido
18. Clicar num input de um card + ↑ → move cursor no texto (NÃO
    navega cards)

#### C. A11y

19. Leitor de tela anuncia "Lista de concretos. Use setas..."
20. Checkbox header tem aria-label

## Como migrar para .NET 8

**Nenhuma mudança na API necessária**. v5.22.35 é puramente UX
frontend. Endpoints REST idênticos.

A ação em lote no backend .NET poderia ganhar um endpoint dedicado
`PATCH /api/implantacao-estrutura/submissions/bulk-priority` que
recebe array de IDs + prioridade, em vez de N chamadas individuais.
Otimização futura, não bloqueia migração.

## Próximo ciclo recomendado

Pendências e ideias:

**Bulk actions — expansão**:
- "Marcar como visto" em lote
- Mudar status em lote (com confirmação)
- Endpoint .NET dedicado para bulk (1 request em vez de N)

**Teclado — expansão**:
- Navegação por teclado em outras telas do wizard (Peças, Estruturas)
- Atalho global "/" para focar a busca no `/admin`
- `j`/`k` (estilo vim) como alternativa a ↑/↓

**Outras**:
- Auto-refresh do listing `/admin` (toggle)
- Preferências de notificação por usuário (opt-out fino)
- Drag-to-reorder de concretos
- Animação CSS em outras telas do wizard

**Pendência antiga**: bugs herdados v5.22.27 seguem sem repro.
