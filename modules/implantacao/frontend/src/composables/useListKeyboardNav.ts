// =====================================================================
// composables/useListKeyboardNav.ts · v5.22.35
//
// Helper de navegação por teclado em listas de cards expansíveis
// (concretos, e potencialmente outras telas). Centraliza a lógica de:
//   - ↑ / ↓: mover foco entre cards
//   - Enter / Espaço: expandir/minimizar o card focado
//   - Esc: minimizar o card atualmente expandido
//
// NÃO captura teclas globalmente — o componente que usa deve
// registrar o handler no container da lista (via @keydown) para
// que os atalhos só funcionem quando o foco está na região da lista.
// Isso evita conflito com inputs de texto, outros componentes, etc.
//
// Uso típico no componente:
//
//   import { handleListKeyNav } from '../composables/useListKeyboardNav';
//
//   onListKeydown(e: KeyboardEvent) {
//     const result = handleListKeyNav(e, {
//       itemIds: this.concretos.map(c => c.id),
//       focusedId: this.focusedId,
//       expandedId: this.expandedId,
//     });
//     if (result.handled) {
//       e.preventDefault();
//       if (result.focusedId !== undefined) this.focusedId = result.focusedId;
//       if (result.expandedId !== undefined) this.expandedId = result.expandedId;
//       if (result.scrollToId) scrollToNewItem(`#concreto-${result.scrollToId}`);
//     }
//   }
//
// Por que retornar um objeto em vez de mutar direto?
//   O composable não sabe os nomes das propriedades do componente.
//   Retornar a intenção (novo focusedId/expandedId) deixa o
//   componente aplicar no seu próprio estado. Testável isoladamente.
// =====================================================================

export interface ListKeyNavState {
  /** IDs dos itens na ordem visual. */
  itemIds: string[];
  /** ID do item atualmente com foco de teclado (null = nenhum). */
  focusedId: string | null;
  /** ID do item atualmente expandido (null = nenhum). */
  expandedId: string | null;
}

export interface ListKeyNavResult {
  /** True se a tecla foi tratada (componente deve preventDefault). */
  handled: boolean;
  /** Novo focusedId, se mudou. undefined = sem mudança. */
  focusedId?: string | null;
  /** Novo expandedId, se mudou. undefined = sem mudança. */
  expandedId?: string | null;
  /** ID para o qual scrollar (após mudança de foco). */
  scrollToId?: string;
}

/**
 * Processa um evento de teclado de navegação de lista.
 *
 * Regras:
 *  - Se o target do evento for um input/textarea/select, NÃO
 *    intercepta (deixa o usuário digitar normalmente).
 *  - ↑ / ↓: move foco. Se nada focado, ↓ foca o primeiro, ↑ o último.
 *    Não faz wrap-around (parar no topo/fundo é menos confuso).
 *  - Enter / Espaço: alterna expansão do focado. Se nada focado, no-op.
 *  - Esc: minimiza o expandido (expandedId = null). Não muda foco.
 */
export function handleListKeyNav(
  e: KeyboardEvent,
  state: ListKeyNavState,
): ListKeyNavResult {
  // Não intercepta quando o usuário está digitando num campo
  const target = e.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
        target.isContentEditable) {
      return { handled: false };
    }
  }

  const { itemIds, focusedId, expandedId } = state;
  if (itemIds.length === 0) return { handled: false };

  const currentIndex = focusedId ? itemIds.indexOf(focusedId) : -1;

  switch (e.key) {
    case 'ArrowDown': {
      let nextIndex: number;
      if (currentIndex < 0) nextIndex = 0;
      else nextIndex = Math.min(currentIndex + 1, itemIds.length - 1);
      const nextId = itemIds[nextIndex];
      return { handled: true, focusedId: nextId, scrollToId: nextId };
    }
    case 'ArrowUp': {
      let prevIndex: number;
      if (currentIndex < 0) prevIndex = itemIds.length - 1;
      else prevIndex = Math.max(currentIndex - 1, 0);
      const prevId = itemIds[prevIndex];
      return { handled: true, focusedId: prevId, scrollToId: prevId };
    }
    case 'Enter':
    case ' ': {
      if (!focusedId) return { handled: false };
      // Alterna: se já expandido, minimiza; senão expande o focado
      const newExpanded = expandedId === focusedId ? null : focusedId;
      return {
        handled: true,
        expandedId: newExpanded,
        scrollToId: newExpanded ?? undefined,
      };
    }
    case 'Escape': {
      if (expandedId === null) return { handled: false };
      return { handled: true, expandedId: null };
    }
    default:
      return { handled: false };
  }
}
