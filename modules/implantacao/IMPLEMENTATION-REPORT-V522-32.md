# Implementation Report · Implantação Consulte GEO v5.22.32

## Resumo executivo

3 melhorias UX pedidas pelo usuário. Foco em produtividade no wizard
de cadastro. Pipeline: **470 OK (+23) · Contraste: 89 OK · Build:
✓ 7.85s**. Zero migration, zero Edge Function, zero dependência nova.

## Solicitação original

> Na tela de concreto eu gostaria que sempre ficasse apenas um
> registro maximizado e os outros minimizados. Se por um acaso está
> faltando algum campo ou não tem padrao de moldagem no registro
> minimizado deve ter algo do lado do texto da descrição do traço
> para que o usuário identifique que falta algo.
>
> Em todas as telas ao clicar em algum botão adicionar caso a
> quantidade de registros existentes já ocupe a area da tela,
> automaticamente a tela deve rolar para o local do novo registro.

## Features entregues

### Feature 1 — Concretos: single-maximized

#### O que mudou

Apenas um concreto fica expandido por vez. Os demais ficam
minimizados (mostrando só o cabeçalho com descrição + FCK + número
de padrões). Ao clicar "Expandir" em outro, o anterior fecha
automaticamente.

#### Implementação

```ts
// ANTES
data() {
  return {
    collapsed: {} as Record<string, boolean>,  // 1 bool por id
  };
}
toggleCollapsed(id: string) {
  this.collapsed[id] = !this.collapsed[id];
}
// Template:
//   :class="{ 'is-collapsed': !!collapsed[c.id] }"
//   v-show="!collapsed[c.id]"
```

```ts
// DEPOIS
data() {
  return {
    expandedId: null as string | null,  // 1 id, apenas ESSE expandido
  };
}
toggleExpanded(id: string) {
  this.expandedId = this.expandedId === id ? null : id;
}
isExpanded(id: string): boolean {
  return this.expandedId === id;
}
// Template:
//   :class="{ 'is-collapsed': !isExpanded(c.id) }"
//   v-show="isExpanded(c.id)"
```

#### Decisões registradas

**Por que `null` em vez de "sempre um expandido"?**
- Usuário pode minimizar TODOS clicando no único aberto
- Sem `null`, o "fechar" não funciona — clique em "Minimizar" não
  faria nada
- Aceito: o estado "tudo minimizado" é raro mas válido

**Por que expandir o primeiro no `mounted()`?**
- Volta para a tela: usuário não precisa clicar pra ver o conteúdo
- Recarrega rascunho: idem
- Estado inicial mais útil que "tudo fechado"

**Por que set `expandedId = novoId` no watch de length?**
- Adicionar um concreto e ele aparecer minimizado seria UX ruim
- Único momento em que o estado vai para um id específico
  automaticamente (não por clique)

### Feature 2 — Indicador visual de incompletude

#### O que apareceu

Badge laranja-âmbar `⚠ Falta info` ao lado da descrição do traço,
**apenas quando o card está minimizado E o concreto está incompleto**.
Tooltip explica o que falta.

#### Critérios de incompletude

```ts
concretoIncompleto(c: Concreto): { incompleto: boolean; motivos: string[] } {
  const motivos: string[] = [];
  if (!c.descricao || !c.descricao.trim())  motivos.push('descrição do traço');
  if (!c.aplicacao || !c.aplicacao.trim())  motivos.push('aplicação');
  const fckNum = typeof c.fck === 'number' ? c.fck : parseFloat(String(c.fck || ''));
  if (!fckNum || fckNum < 10 || fckNum > 100)  motivos.push('FCK válido (10–100 MPa)');
  if (!c.padroesMoldagem || c.padroesMoldagem.length === 0)  motivos.push('padrão de moldagem');
  return { incompleto: motivos.length > 0, motivos };
}
```

#### Decisões registradas

**Por que cor warning, não erro?**
- Não é bloqueante para salvar rascunho
- Vermelho em lista de cards causa sobressalto visual
- Laranja-âmbar diz "atenção" sem ser alarmante

**Por que só mostrar quando minimizado?**
- Quando expandido, os campos vazios JÁ são visíveis
- Badge no expandido seria ruído

**Por que tooltip com lista de motivos em vez de só "incompleto"?**
- Usuário precisa saber O QUE falta sem expandir
- `title` atrib. HTML é nativo e acessível (screen readers leem)

**Por que NÃO incluir "Aplicação" no requisito mínimo?**
- Inclui no requisito mínimo (vide código acima)
- A imagem mostra "Estaca Hélice" preenchido — então o user pediu
  esse campo como crítico

### Feature 3 — Auto-scroll ao adicionar

#### O que aparece

Quando o usuário clica em qualquer botão `+ Adicionar` e a tela já
está rolada para baixo (registros existentes ocupando o viewport),
a tela rola suavemente até o novo registro recém-adicionado.

#### Composable novo

`frontend/src/composables/useScrollIntoNewItem.ts`:

```ts
export async function scrollToNewItem(
  selector: string,
  opts: ScrollToNewItemOptions = {},
): Promise<void> {
  await nextTick();
  await nextTick();  // 2 ticks cobrem componentes aninhados

  const el = document.querySelector(selector);
  if (!el) return;

  const margin = opts.visibleMargin ?? 80;
  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const isVisible = rect.top >= -margin && rect.bottom <= viewportH + margin;

  if (isVisible) return;

  el.scrollIntoView({
    behavior: opts.behavior ?? 'smooth',
    block: opts.block ?? 'center',
  });
}
```

#### Aplicação em cada Step

Padrão idêntico nos 6 componentes:

```ts
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';

watch: {
  'minhaLista.length'(newLen: number, oldLen: number) {
    if (newLen > oldLen && newLen > 0) {
      const novo = this.minhaLista[newLen - 1];
      if (novo) scrollToNewItem(`#meu-prefix-${novo.id}`);
    }
  },
},
```

E no template do v-for:
```html
<div v-for="x in lista" :key="x.id" :id="`meu-prefix-${x.id}`">
```

#### Decisões registradas

**Por que watch em `array.length` e não no handler do botão?**

O botão `@click="$emit('add-concreto')"` só dispara evento.
- Pai (SetupPage) recebe → muta store via Vuex
- Reatividade propaga prop atualizada de volta ao filho
- DOM só atualiza DEPOIS disso (1 ou 2 ticks)

Se eu tentasse scrollar no handler do click, o novo elemento ainda
não existe no DOM. Watch + `nextTick()` esperam o pipeline completo.

**Por que 2 `nextTick()` em vez de 1?**

Em alguns Steps há componentes aninhados (ex.: PadraoMoldagemEditor
dentro de Step4Concretos). O primeiro tick atualiza o pai, o segundo
atualiza os filhos. Custo invisível para o usuário (~16ms).

**Por que detecção de viewport com margem?**

Se elemento já está visível, scrollar gera "salto" desnecessário
que confunde o usuário. Margem de 80px aceita "quase visível como
visível" — evita scroll de 50px que ninguém pediu.

**Por que `block: 'center'` por default?**

`block: 'start'` colocaria o elemento no topo da tela, escondendo
contexto acima. `'center'` mantém contexto visível em cima e embaixo.

**Por que `block: 'nearest'` no PadraoMoldagemEditor?**

Linhas de padrão são compactas (40px de altura). `'center'` faria
scroll exagerado. `'nearest'` só scrolla o mínimo necessário.

**Por que `Step5PecasEditor` usa `totalPecasCount` computed?**

Step5 tem peças aninhadas em grupos. `grupos.pecas.length` não é
observável (cada grupo tem seu array). A solução:

```ts
computed: {
  totalPecasCount(): number {
    return this.grupos.reduce((acc, g) => acc + (g.pecas?.length || 0), 0);
  },
},
watch: {
  totalPecasCount(newCount: number, oldCount: number) {
    if (newCount > oldCount) {
      // Acha a peça mais recente em qualquer grupo
      let target: { id: string } | null = null;
      for (const g of this.grupos) {
        if (g.pecas?.length > 0) {
          target = g.pecas[g.pecas.length - 1];
        }
      }
      if (target) scrollToNewItem(`#peca-${target.id}`);
    }
  },
},
```

**Limitação aceita**: se o usuário fizer bulk-add em 2 grupos
simultaneamente (raro), só scrolla pra última.

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `frontend/src/composables/useScrollIntoNewItem.ts` | ~110 |
| `IMPLEMENTATION-REPORT-V522-32.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/Step4Concretos.vue` | single-maximized + badge incompleto + auto-scroll (~80 linhas alteradas) |
| `frontend/src/components/Step3GruposEditor.vue` | watch + id no v-for |
| `frontend/src/components/Step5PecasEditor.vue` | watch + computed totalPecasCount + id no v-for |
| `frontend/src/components/Step6UsuariosObra.vue` | watch + id no v-for |
| `frontend/src/components/Step7Fornecedores.vue` | watch + id no v-for |
| `frontend/src/components/PadraoMoldagemEditor.vue` | watch + id no v-for |
| `frontend/src/styles/design-system.css` | regra `.badge-incompleto` |
| `frontend/smoke-pipeline.ts` | +23 testes; flex check v31 |
| `frontend/package.json` | bump 5.0.22-32 |
| `README.md` | seção destacada v5.22.32 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.32 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.31 | 447 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **470 OK / 0 FAIL** (+23) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 7.85s** |
| Re-validação no /tmp limpo | (a fazer ao empacotar) |

## Bloqueios reais

### Por ambiente

- **Sandbox sem browser headless**: não testei visualmente:
  - O badge `⚠ Falta info` renderizando como esperado (cor, posição)
  - O scroll suave funcionando em viewport real
  - A transição visual ao expandir/minimizar concretos
  - Comportamento em mobile (viewport pequeno)
- **Sem Supabase real**: nenhuma feature desta versão toca banco,
  então sem impacto.

### Por dependência externa

- `scrollIntoView({ behavior: 'smooth' })` tem suporte universal em
  navegadores modernos (Chrome 61+, Firefox 36+, Safari 14+). Risco
  praticamente zero.

## Pendências manuais

### Validação em produção

Sem deploy especial necessário — push do frontend para `main` →
Netlify build automático. Sem migration, sem Edge Function nova.

### Smoke tests críticos

#### A. Single-maximized em Concretos

1. Ir até Etapa 3 (Concretos)
2. Adicionar pelo menos 3 concretos
3. Apenas o último deve estar expandido
4. Clicar em "▸ Expandir" no Concreto 1 → o 3 deve fechar
5. Clicar em "▾ Minimizar" no único aberto → todos ficam fechados
6. Adicionar novo concreto → ele aparece já expandido

#### B. Indicador `⚠ Falta info`

7. Adicionar concreto e NÃO preencher nada
8. Minimizar
9. Badge `⚠ Falta info` aparece ao lado de "Novo concreto"
10. Hover/touch no badge: tooltip "Falta: descrição do traço,
    aplicação, FCK válido (10–100 MPa), padrão de moldagem"
11. Expandir o concreto: badge SUMIU (só aparece minimizado)
12. Preencher tudo + minimizar: badge SUMIU (sem motivos)

#### C. Auto-scroll em todas as telas

13. Em Etapa 2 (Estruturas): adicionar 8+ grupos. Clicar
    "+ Adicionar grupo" → tela rola até o novo
14. Etapa 3 (Concretos): mesma coisa
15. Etapa 3 → expandir um concreto → tabela "Padrão de Moldagem"
    com 5+ linhas → clicar "+ 7 dias" → nova linha visível
16. Etapa 4 (Peças): mesma coisa
17. Etapa 5 (Usuários): mesma coisa
18. Etapa 6 (Fornecedores): mesma coisa

#### D. Não scrolla quando já visível

19. Etapa 3 com 0-2 concretos: adicionar não causa scroll
    (tudo cabe na tela)
20. Validar visualmente — não há "pulo" desnecessário

## Como migrar para .NET 8

**Nenhuma mudança na API necessária**. Toda a v5.22.32 é
puramente frontend (UX). Endpoints REST continuam idênticos.

## Próximo ciclo recomendado

Dependendo do feedback de uso:

**Refinamentos candidatos**:
- Animação de transição (height) ao expandir/minimizar (CSS)
- Atalho de teclado: setas ↑/↓ navegam entre concretos minimizados
- Indicador "completo" (✓ verde) quando o concreto está OK e
  minimizado, para reforço positivo
- Auto-scroll também ao REMOVER (foca no item acima)

**Outras prioridades pendentes**:
- Validar correção dos bugs herdados v5.22.27 (`onNext`, "Devolver")
  em produção
- Notificação inversa: cliente recebe email quando equipe comenta
- Bulk actions no painel /admin (selecionar várias linhas)
