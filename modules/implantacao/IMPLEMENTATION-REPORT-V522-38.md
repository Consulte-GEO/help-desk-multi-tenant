# Implementation Report · Implantação Consulte GEO v5.22.38

## Resumo executivo

Drag-and-drop para reordenar registros em **Blocos e torres** (Etapa 2)
e **Pavimentos e peças** (Etapa 4). O usuário pressiona um handle,
segura e arrasta a linha toda para a posição desejada. Pipeline:
**571 OK (+20) · Contraste: 89 OK · Build: ✓ 7.45s**. HTML5 DnD nativo,
sem dependência externa. Sem migration, sem Edge Function.

## Demanda

> "Tanto em Blocos e torres quanto em Pavimentos e peças, reordenar os
> registros com drag and drop: clicar no mouse, segurar e arrastar a
> linha toda para a posição desejada."

## Arquitetura

```
[handle ⠿ : mousedown → dnd.arm(index)]
       │ (linha vira draggable só agora)
       ▼
[dragstart → dnd.onDragStart] → linha fica semi-transparente
       │
       ▼ (arrasta sobre outras linhas)
[dragover → dnd.onDragOver] → linha-alvo recebe barra brand (dnd-over)
       │
       ▼ (solta)
[drop → onDrop* → dnd.resolveDrop → { from, to }]
       │
       ▼ $emit('reorder-grupos'|'reorder-pecas')
[SetupPage handler → store commit]
       │
       ▼ mutation reorderGrupos / reorderPecas (splice + insert)
[array reordenado + isDirty + audit]
```

## Mudanças

### Composable useDragReorder.ts (novo)

`createDragReorder()` retorna estado reativo:
- `armed` — índice da linha "armada" pelo handle
- `draggingIndex` — linha sendo arrastada
- `overIndex` — linha sob o cursor
- métodos: `arm`, `onDragStart`, `onDragOver`, `onDragEnd`, `resolveDrop`

`resolveDrop(dropIndex)` retorna `{ from, to }` ou `null`.

### Store (setup.ts)

```ts
reorderGrupos(state, { from, to }) {
  // clamp from/to em [0, len-1]; splice(from,1) + splice(to,0,moved)
}
reorderPecas(state, { grupoId, from, to }) {
  // idem, mas dentro de g.pecas do grupo
}
```

### Step3GruposEditor (Blocos e torres)

- Drag nos DOIS modos: tabela (modelo projeto) e cards (modelo comum)
- Coluna `.col-drag` com handle ⠿ na tabela; handle no kicker dos cards
- `:draggable="dnd.armed === gi"` — só arrasta pelo handle
- Emite `reorder-grupos`

### Step5PecasEditor (Pavimentos e peças)

- Drag nas peças de cada grupo (tabela por grupo)
- `dragGrupoId` rastreia de qual grupo a peça saiu
- `onDropPeca` só reordena se o drop for no MESMO grupo
- Emite `reorder-pecas` com `{ grupoId, from, to }`

### SetupPage

- `onReorderGrupos` / `onReorderPecas` → commit + audit local
- Wiring `@reorder-grupos` / `@reorder-pecas`

### CSS (design-system.css)

- `.drag-handle` (grab/grabbing), `.col-drag`
- `.dnd-row`, `.dnd-dragging` (opacity 0.45), `.dnd-over` (barra brand)
- `prefers-reduced-motion`: sem transição

## Decisões registradas

**Por que HTML5 DnD nativo e não SortableJS/vuedraggable?**

Stack fechada. Reordenação de lista vertical simples não justifica
~30KB de dependência. A HTML5 Drag and Drop API cobre exatamente o
caso "clica, segura, arrasta a linha toda".

**Por que "armar pelo handle" em vez de draggable sempre ligado?**

Se a linha/card inteiro tem `draggable="true"`, o navegador captura
o mousedown — e o usuário não consegue clicar/selecionar texto nos
inputs dentro da linha (vira drag em vez de edição). Solução: a linha
só fica `draggable` quando o usuário pressiona o handle ⠿
(`@mousedown="dnd.arm(index)"`). Fora do handle, os inputs funcionam
normalmente.

**Por que peças não migram entre grupos?**

O modelo de dados tem `grupo.pecas` (peças pertencem a um grupo).
Arrastar uma peça do grupo A para o grupo B não faz sentido no
domínio (a peça mudaria de estrutura). O guard `dragGrupoId !==
grupoId` no drop cancela o movimento se o destino for outro grupo.
Reordenação é estritamente intra-grupo.

**Por que clamp + splice no store?**

Defesa: índices fora de faixa (corrida com remoção concorrente, bug
de UI) não devem quebrar. `Math.max(0, Math.min(idx, len-1))` garante
índice válido; `from === to` é no-op.

## Limitações aceitas

- **Sem reordenar peças entre grupos** (por design, ver acima)
- **Sem teclado** para reordenar (drag só com mouse/touch). Os
  atalhos de teclado da v35 são para concretos, não para reordenação.
- **Touch**: `@touchstart` arma o handle, mas o DnD nativo em touch
  varia por navegador mobile. Funciona em desktop garantido; mobile
  é best-effort (não testável no sandbox).

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `frontend/src/composables/useDragReorder.ts` | ~92 |
| `IMPLEMENTATION-REPORT-V522-38.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/store/modules/setup.ts` | mutations reorderGrupos + reorderPecas |
| `frontend/src/views/SetupPage.vue` | handlers + wiring dos 2 eventos |
| `frontend/src/components/Step3GruposEditor.vue` | drag nos 2 modos + handle |
| `frontend/src/components/Step5PecasEditor.vue` | drag de peças por grupo + guard |
| `frontend/src/styles/design-system.css` | classes de drag-and-drop |
| `frontend/smoke-pipeline.ts` | +20 testes; flex v37 |
| `frontend/package.json` | bump 5.0.22-38 |
| `README.md`, `docs/CHANGELOG_SOLICITACOES.md` | atualizados |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.37 | 551 OK |
| `vue-tsc --noEmit` | limpo |
| Pipeline | **571 OK / 0 FAIL** (+20) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **OK 7.45s** |

## Nota sobre o ambiente de build

Persiste o comportamento das v36/v37: arquivos criados na sessão
(aqui, `useDragReorder.ts`) somem durante `vite build`. Mitigação:
copiar de `/tmp` e rodar o build no mesmo comando encadeado. Em
produção (Netlify, checkout git) é irrelevante. A re-validação do
zip foi feita assim.

## Pendências manuais (deploy)

### Deploy

**Puramente frontend**. Push para `main` → Netlify. Sem migration,
sem Edge Function, sem variável nova.

### Smoke tests

#### A. Blocos e torres — modo tabela (modelo projeto)
1. Etapa 2 com 3+ grupos (modelo projeto/completo)
2. Pressionar o handle ⠿ da 3ª linha, segurar e arrastar para o topo
3. Barra brand aparece na linha-alvo durante o arraste
4. Soltar → 3ª linha vira 1ª; ordem persiste ao navegar etapas

#### B. Blocos e torres — modo cards (modelo comum)
5. Etapa 2 modelo comum, 2+ grupos
6. Arrastar pelo handle no topo do card → reordena

#### C. Pavimentos e peças
7. Etapa 4, um grupo com 3+ peças
8. Arrastar peça pelo handle → reordena dentro do grupo
9. Tentar soltar peça em OUTRO grupo → movimento cancelado (não migra)

#### D. Edição preservada
10. Clicar num input de uma linha (fora do handle) → edita normal,
    NÃO inicia drag

#### E. Persistência
11. Reordenar → salvar rascunho → recarregar → ordem mantida
12. Reordenar reflete no JSON técnico e no Excel (ordem dos arrays)

## Como migrar para .NET 8

Reordenação é estado do cliente persistido como ordem do array no
JSON técnico. No backend:
- A ordem dos itens nos arrays (`grupos`, `pecas`) já carrega a
  posição; basta preservar a ordem ao serializar/desserializar
- Se o SQL Server normalizar em tabelas, adicionar coluna `Ordem int`
  e ordenar por ela no SELECT
- Endpoint opcional `PATCH .../reorder` recebendo a nova ordem de IDs

## Próximo ciclo recomendado

- Reordenar peças entre grupos (se o domínio passar a permitir)
- Reordenação por teclado (acessibilidade — mover com Alt+↑/↓)
- Drag-and-drop também em Concretos (Etapa 3) e Usuários/Fornecedores
- **Deploy consolidado v32–v38** (segue pendente: migrations 011–015,
  Edge Functions notify-client-comment + notify-team-comment)
