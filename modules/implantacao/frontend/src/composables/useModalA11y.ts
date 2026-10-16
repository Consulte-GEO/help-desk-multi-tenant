/**
 * useModalA11y · v5.22.27
 *
 * Padroniza acessibilidade dos modais do app:
 *
 *  1. **Focus trap** — Tab/Shift+Tab circula entre elementos focáveis
 *     dentro do modal. Sem isso, o foco escapa para a página
 *     atrás (lista de obras, sidebar) — usuário de teclado perde
 *     contexto.
 *
 *  2. **Focus inicial** — ao abrir, foca o primeiro elemento focável
 *     (geralmente o primeiro input). Usuário de teclado pode começar
 *     a digitar imediatamente; leitor de tela anuncia o campo.
 *
 *  3. **ESC fecha** — atalho universal. Não usar `tabindex="-1"` no
 *     modal para isso funcionar (precisa receber o keydown event).
 *
 *  4. **Restaurar foco anterior** — ao fechar, devolve o foco para
 *     o elemento que abriu o modal (ex.: botão "Enviar por email"
 *     na topbar). Sem isso, foco vai para `body` e usuário "perde"
 *     o lugar onde estava.
 *
 * Uso típico (no parent Vue):
 *
 *   import { setupModalA11y } from '../composables/useModalA11y';
 *
 *   mounted() {
 *     this.a11y = setupModalA11y({
 *       containerSelector: '[data-testid="share-draft-modal"]',
 *       onEscape: () => this.$emit('close'),
 *     });
 *   }
 *   watch: {
 *     open(v) {
 *       if (v) this.a11y.activate();
 *       else   this.a11y.deactivate();
 *     }
 *   },
 *   beforeUnmount() {
 *     this.a11y.deactivate();
 *   }
 *
 * Por que API imperativa em vez de Composition API com onMounted?
 * Os modais existentes (Share, SubmitTicket, ReturnSubmission) estão
 * em Options API com defineComponent. Mantém consistência com o
 * resto do código sem forçar refatoração desses 3 componentes.
 *
 * Por que NÃO uma diretiva v-focus-trap?
 * Diretivas Vue rodam no ciclo de mount/unmount do elemento, mas
 * os modais usam v-if="open" — ao reabrir, perdemos referência
 * antiga. Imperativo simples com activate/deactivate é mais
 * previsível.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface ModalA11yOptions {
  /**
   * Selector CSS do container do modal (geralmente o
   * `[data-testid="..."]` do Teleport). Procurado em
   * `document.querySelector` quando `activate()` é chamado.
   */
  containerSelector: string;
  /**
   * Handler para ESC. Tipicamente emite `close` para o parent.
   * Pode ser omitido se o modal não deve fechar com ESC (raro).
   */
  onEscape?: () => void;
  /**
   * Atrasar o foco inicial em milissegundos. Útil quando o modal
   * tem animação de entrada — foca depois que termina.
   * Default: 0 (próximo tick).
   */
  initialFocusDelay?: number;
}

export interface ModalA11yController {
  /** Ativa o trap. Procura o container, foca o primeiro elemento. */
  activate(): void;
  /** Desativa, devolve o foco para o elemento de origem. */
  deactivate(): void;
}

/**
 * @returns Controller com `activate` / `deactivate`.
 */
export function setupModalA11y(options: ModalA11yOptions): ModalA11yController {
  let active = false;
  let activation = 0;
  let container: HTMLElement | null = null;
  let previouslyFocused: HTMLElement | null = null;

  function focusableElements(): HTMLElement[] {
    if (!container) return [];
    const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    // Filtra elementos invisíveis (display:none, visibility:hidden)
    return list.filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (!active || !container) return;

    if (e.key === 'Escape') {
      e.stopPropagation();
      options.onEscape?.();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = focusableElements();
    if (focusables.length === 0) {
      // Modal sem nada focável — previne escape para a página
      e.preventDefault();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const activeEl = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      // Shift+Tab: se está no primeiro, vai para o último
      if (activeEl === first || !container.contains(activeEl)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: se está no último, volta para o primeiro
      if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function activate() {
    if (active) return;
    active = true;
    const currentActivation = ++activation;
    previouslyFocused = (document.activeElement as HTMLElement) || null;

    // Aguarda o Vue renderizar o modal antes de procurar o container
    setTimeout(() => {
      if (!active || currentActivation !== activation) return;
      container = document.querySelector<HTMLElement>(options.containerSelector);
      if (!container) {
        // Pode acontecer em testes ou se containerSelector estiver errado.
        // Não joga erro — degrada graciosamente sem trap.
        return;
      }
      // Foco inicial
      setTimeout(() => {
        if (!active || !container || currentActivation !== activation) return;
        // Preserve a field already chosen by pointer, keyboard or assistive
        // technology while the deferred initial-focus callbacks were pending.
        if (container.contains(document.activeElement)) return;
        const focusables = focusableElements();
        if (focusables.length > 0) {
          focusables[0]!.focus();
        }
      }, options.initialFocusDelay ?? 0);
    }, 0);

    document.addEventListener('keydown', onKeydown, true);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    activation++;
    document.removeEventListener('keydown', onKeydown, true);
    container = null;

    // Devolve o foco — mas só se o elemento ainda existe e não foi
    // removido do DOM. Em SPAs com router reset, previouslyFocused
    // pode ter sumido.
    if (previouslyFocused && document.contains(previouslyFocused)) {
      try {
        previouslyFocused.focus();
      } catch {
        // Algumas engines reclamam de focus() em elementos sem
        // tabindex — ignora silenciosamente.
      }
    }
    previouslyFocused = null;
  }

  return { activate, deactivate };
}
