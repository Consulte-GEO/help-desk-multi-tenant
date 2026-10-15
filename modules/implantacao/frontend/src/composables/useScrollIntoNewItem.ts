// =====================================================================
// composables/useScrollIntoNewItem.ts · v5.22.32
//
// Helper para scroll suave até um elemento recém-adicionado a uma
// lista. Usado em todos os Steps que têm botão "+ Adicionar".
//
// Por que existe:
//   Quando o usuário clica "Adicionar concreto" / "Adicionar peça" /
//   "Adicionar usuário" etc. e já há registros suficientes para
//   ocupar a área visível, o novo registro entra fora do viewport e
//   o usuário não percebe que foi adicionado. Esse composable
//   resolve scrollando suavemente até ele.
//
// Como usar (padrão recomendado: watch em array.length):
//
//   import { scrollToNewItem } from '../composables/useScrollIntoNewItem';
//
//   watch: {
//     'minhaLista.length'(newLen, oldLen) {
//       if (newLen > oldLen) {
//         const novo = this.minhaLista[newLen - 1];
//         scrollToNewItem(`#item-${novo.id}`);
//       }
//     },
//   }
//
// Por que NÃO no botão diretamente?
//   O botão emite evento → pai atualiza store → reatividade propaga
//   de volta. O timing exato do DOM update vem da reatividade, não
//   do clique. Watch + nextTick respeitam esse pipeline.
//
// Por que NÃO sempre scrollar?
//   Se o elemento já está visível (caso comum quando há pouca
//   coisa na tela), scrollar deixa o usuário tonto. O helper só
//   scrolla se o elemento estiver fora do viewport visível.
// =====================================================================

import { nextTick } from 'vue';

export interface ScrollToNewItemOptions {
  /** Comportamento do scroll. Default: 'smooth'. */
  behavior?: ScrollBehavior;
  /** Posição vertical alvo. Default: 'center' (mais natural que 'start'). */
  block?: ScrollLogicalPosition;
  /**
   * Margem em pixels acima/abaixo do viewport considerada "visível".
   * Default: 80px. Permite tratar elementos quase-visíveis como
   * já-visíveis, evitando scroll desnecessário.
   */
  visibleMargin?: number;
}

/**
 * Scrolla suavemente até o elemento, se ele estiver fora do
 * viewport. Aguarda nextTick para garantir que o DOM já foi
 * atualizado pela reatividade.
 *
 * @returns Promise que resolve quando o scroll começa (não aguarda
 *          a animação terminar — `behavior:'smooth'` é fire-and-forget).
 */
export async function scrollToNewItem(
  selector: string,
  opts: ScrollToNewItemOptions = {},
): Promise<void> {
  // 1 nextTick não é suficiente em alguns casos (componentes
  // aninhados que renderizam em cascata). 2 ticks cobre a grande
  // maioria das situações sem custo perceptível ao usuário.
  await nextTick();
  await nextTick();

  const el = document.querySelector(selector);
  if (!el) return;

  const margin = opts.visibleMargin ?? 80;
  const rect = el.getBoundingClientRect();
  const viewportH =
    window.innerHeight || document.documentElement.clientHeight;

  // Visível = topo já passou (com margem) E fundo ainda não saiu (com margem)
  const isVisible =
    rect.top >= -margin && rect.bottom <= viewportH + margin;

  if (isVisible) return;

  el.scrollIntoView({
    behavior: opts.behavior ?? 'smooth',
    block: opts.block ?? 'center',
  });
}

/**
 * Variante para focar o input principal de um item recém-criado,
 * após o scroll. Útil para acelerar o preenchimento — o cursor já
 * fica no campo certo.
 *
 * Se o seletor de input não for encontrado, faz só o scroll.
 */
export async function scrollAndFocusNewItem(
  containerSelector: string,
  inputSelector: string,
  opts: ScrollToNewItemOptions = {},
): Promise<void> {
  await scrollToNewItem(containerSelector, opts);
  const input = document.querySelector(inputSelector);
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.focus();
    // select() faz o usuário enxergar o placeholder existente e
    // sobrescrever digitando — UX comum em wizards de cadastro
    if (input.value === '' || input.value === input.defaultValue) {
      // só seleciona se vazio; senão pode atrapalhar
    }
  }
}
