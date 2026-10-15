<template>
  <div>
    <div class="section-title">
      <div>
        <div class="kicker">Etapa 3 de {{ totalSteps }}</div>
        <h2>Concretos e traços previstos</h2>
        <p>
          Cadastre os concretos antes das peças — ao preencher cada peça
          você já vincula o concreto desta etapa. FCK em MPa, inteiro.
        </p>
      </div>
      <button type="button" class="btn brand" @click="$emit('add-concreto')">
        + Adicionar concreto
      </button>
    </div>

    <!-- v5.22.18: alerta sticky aparece imediatamente após o cliente
         clicar em "Sugerir traços padrão". Os 5 traços vêm como exemplo
         e devem ser revisados, editados ou removidos — usar tal qual
         na implantação pode comprometer o uso da ferramenta na obra.
         Banner dispensável (botão "OK, entendi"); reaparece se o cliente
         clicar em "Sugerir traços padrão" outra vez. -->
    <div
      v-if="showDefaultsAlert"
      class="alert warning"
      style="margin-bottom: 16px"
      role="alert"
    >
      <strong>⚠ Atenção · traços sugeridos são apenas exemplo</strong>
      <span>
        Os 5 traços carregados (Radier, Sapata, Estaca Hélice, Contenções,
        Convencional) são referência genérica. <strong>Revise FCK, brita,
        slump, padrão de moldagem e aplicação</strong> de cada um conforme
        a obra real, ou remova os que não usar. O cadastro de um traço
        errado pode comprometer o uso da ferramenta após a implantação.
      </span>
      <div class="toolbar" style="margin-top: 8px">
        <button
          type="button"
          class="btn sm"
          @click="showDefaultsAlert = false"
        >
          OK, entendi
        </button>
      </div>
    </div>

    <!-- v5.22.10: estado vazio com botão de sugestão.
         Antes deste patch a tela abria com 5 concretos pré-cadastrados.
         Agora começa em branco e o cliente pode optar por carregar os
         traços-modelo (Radier, Sapata/Blocos, Estaca Hélice, Contenções,
         Convencional) se quiser usar como base. -->
    <div v-if="!concretos.length" class="card" style="margin-bottom: 16px">
      <div class="card-body" style="text-align: center; padding: 32px 16px">
        <p style="margin: 0 0 12px"><strong>Nenhum concreto cadastrado.</strong></p>
        <p style="margin: 0 0 16px; color: var(--fg-muted)">
          Cadastre os traços que serão usados nesta obra. Você pode começar
          do zero ou usar nossa sugestão de traços comuns.
        </p>
        <div class="toolbar" style="justify-content: center; gap: 8px">
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-concreto')"
          >
            + Cadastrar primeiro concreto
          </button>
          <button
            type="button"
            class="btn"
            @click="onSuggestDefaults"
            title="Carrega 5 traços comuns (Radier, Sapata, Estaca Hélice, Contenções, Convencional). Você pode editar ou apagar depois."
          >
            Sugerir traços padrão
          </button>
        </div>
      </div>
    </div>

    <!--
      v5.22.35: navegação por teclado. tabindex=0 no grid torna a
      região focável; @keydown delega para o composable. Atalhos:
      ↑/↓ move foco entre cards, Enter/Espaço expande/minimiza,
      Esc minimiza. Só ativa quando o foco está na região (não
      sequestra teclado global).
    -->
    <p
      v-if="concretos.length > 1"
      class="kbd-hint"
      aria-hidden="true"
    >
      Dica: clique na lista e use <kbd>↑</kbd> <kbd>↓</kbd> para navegar,
      <kbd>Enter</kbd> para expandir, <kbd>Esc</kbd> para minimizar.
    </p>
    <div
      class="grid"
      tabindex="0"
      role="list"
      aria-label="Lista de concretos. Use setas para navegar, Enter para expandir."
      @keydown="onListKeydown"
    >
      <div
        v-for="(c, idx) in concretos"
        :key="c.id"
        :id="`concreto-${c.id}`"
        class="card concreto-card"
        :class="{ 'is-collapsed': !isExpanded(c.id), 'is-kbd-focused': focusedId === c.id }"
        role="listitem"
      >
        <div class="card-header">
          <div>
            <div class="kicker">Concreto {{ idx + 1 }}</div>
            <h3 class="card-title">
              <span>{{ c.descricao || 'Novo concreto' }}</span>
              <span v-if="c.fck" class="card-title-range">FCK {{ c.fck }} MPa</span>
              <span
                v-if="!isExpanded(c.id)"
                class="card-title-range"
              >· {{ c.padroesMoldagem.length }} padrão(ões)</span>
              <!--
                v5.22.32: indicador de incompletude no header (visível
                apenas quando minimizado). Tooltip explica o que falta.
              -->
              <span
                v-if="!isExpanded(c.id) && concretoIncompleto(c).incompleto"
                class="badge-incompleto"
                :title="`Falta: ${concretoIncompleto(c).motivos.join(', ')}`"
                role="status"
                :aria-label="`Concreto incompleto: falta ${concretoIncompleto(c).motivos.join(', ')}`"
              >
                ⚠ Falta info
              </span>
              <!--
                v5.22.34: indicador positivo quando completo + minimizado.
                Reforço visual de "OK" sem precisar abrir o card.
              -->
              <span
                v-if="!isExpanded(c.id) && !concretoIncompleto(c).incompleto"
                class="badge-completo"
                title="Tudo preenchido"
                role="status"
                aria-label="Concreto completo"
              >
                ✓
              </span>
            </h3>
          </div>
          <div class="toolbar">
            <button
              type="button"
              class="btn sm"
              :title="isExpanded(c.id) ? 'Minimizar' : 'Expandir (vai fechar os outros)'"
              @click="toggleExpanded(c.id)"
            >
              {{ isExpanded(c.id) ? '▾ Minimizar' : '▸ Expandir' }}
            </button>
            <button
              v-if="idx > 0 && getCopySource(idx)"
              type="button"
              class="btn sm"
              :title="`Copia o padrão de moldagem de &quot;${getCopySource(idx)?.descricao || ''}&quot; (ajustando ao FCK deste concreto)`"
              @click="onCopyPadraoAnterior(c, idx)"
            >
              Copiar padrão anterior
            </button>
            <button
              type="button"
              class="btn sm danger"
              @click="$emit('remove-concreto', c.id)"
            >
              Remover
            </button>
          </div>
        </div>
        <!--
          v5.22.34: transition para abrir/fechar suave. Usa Vue
          <transition> com hooks JS que medem scrollHeight para
          animar entre 0 e o altura natural do conteúdo. Mais
          confiável que CSS-only `max-height` que sempre tem que
          adivinhar um teto absurdo.
        -->
        <transition
          name="card-body-expand"
          @before-enter="onBeforeEnter"
          @enter="onEnter"
          @after-enter="onAfterEnter"
          @before-leave="onBeforeLeave"
          @leave="onLeave"
        >
          <div v-show="isExpanded(c.id)" class="card-body">
          <!-- Linha 1: dados básicos -->
          <div class="grid grid-2">
            <div class="field">
              <label :for="`conc_desc_${c.id}`">Descrição do traço</label>
              <input
                :id="`conc_desc_${c.id}`"
                class="input"
                :value="c.descricao"
                placeholder="Exemplo: FCK 30 | BRITA 1 | SLUMP 10±2 CM"
                @input="onUpdate(c.id, 'descricao', $event)"
              />
            </div>
            <div class="field">
              <label :for="`conc_app_${c.id}`">Aplicação</label>
              <input
                :id="`conc_app_${c.id}`"
                class="input"
                :value="c.aplicacao"
                placeholder="Exemplo: Sapata, Radier, Pavimentos"
                @input="onUpdate(c.id, 'aplicacao', $event)"
              />
            </div>
          </div>

          <div class="grid grid-2" style="margin-top: 12px">
            <div class="field">
              <label :for="`conc_fck_${c.id}`">FCK (MPa)</label>
              <input
                :id="`conc_fck_${c.id}`"
                class="input input-fck"
                type="number"
                min="10"
                max="100"
                step="1"
                :value="c.fck"
                placeholder="Exemplo: 30"
                @input="onUpdate(c.id, 'fck', $event)"
              />
              <div class="hint">
                Alterar o FCK atualiza automaticamente o "Valor Esperado"
                das linhas de Compressão (que não foram customizadas).
              </div>
            </div>
            <div class="field">
              <label :for="`conc_mold_${c.id}`">Resumo do padrão (texto livre)</label>
              <input
                :id="`conc_mold_${c.id}`"
                class="input"
                :value="c.moldagem"
                placeholder="Exemplo: 1 CP - 7 dias / 2 CPs - 28 dias / 1 CP - 63 dias"
                @input="onUpdate(c.id, 'moldagem', $event)"
              />
              <div class="hint">
                Resumo informativo. As linhas reais ficam no Padrão de
                Moldagem abaixo.
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Linha 2: padrão de moldagem (tabela + shortcuts) -->
          <details class="padrao-section" open>
            <summary>
              <strong>Padrão de Moldagem</strong>
              <span class="hint" style="margin-left: 8px">
                {{ c.padroesMoldagem.length }} linha(s)
              </span>
            </summary>
            <PadraoMoldagemEditor
              :concreto-id="c.id"
              :padroes="c.padroesMoldagem"
              @add-padrao="(p) => $emit('add-padrao', p)"
              @remove-padrao="(p) => $emit('remove-padrao', p)"
              @update-padrao="(p) => $emit('update-padrao', p)"
            />
          </details>
        </div>
        </transition>
      </div>

      <div v-if="!concretos.length" class="empty">
        <strong>Nenhum concreto cadastrado.</strong>
        <br />
        Clique em "+ Adicionar concreto" para começar. Você pode
        adicionar quantos quiser nesta etapa.
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import PadraoMoldagemEditor from './PadraoMoldagemEditor.vue';
import type { Concreto } from '../models/setup.models';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';
import { handleListKeyNav } from '../composables/useListKeyboardNav';

export default defineComponent({
  name: 'Step4Concretos',
  components: { PadraoMoldagemEditor },
  props: {
    concretos: { type: Array as PropType<Concreto[]>, required: true },
    /** v5.22.10: 8 para cliente, 10 para equipe (em /r/). */
    totalSteps: { type: Number, default: 7 },
  },
  emits: [
    'add-concreto',
    'remove-concreto',
    'update-concreto',
    'add-padrao',
    'remove-padrao',
    'update-padrao',
    'copy-padroes',
    /** v5.22.10: solicita o carregamento dos 5 traços padrão. */
    'suggest-defaults',
  ],
  data() {
    return {
      /**
       * v5.22.32: single-maximized. Apenas UM concreto fica expandido
       * por vez. Quando o usuário expande outro, este fecha
       * automaticamente. Quando adiciona um novo concreto, ele vira
       * o expandido (via watch).
       *
       * null = todos minimizados (estado raro, só logo após criação
       * vazia ou após o usuário minimizar o único expandido).
       */
      expandedId: null as string | null,
      /** v5.22.35: id do concreto com foco de teclado (navegação ↑/↓). */
      focusedId: null as string | null,
      /** v5.22.18: banner de alerta que aparece após "Sugerir traços padrão". */
      showDefaultsAlert: false,
    };
  },
  watch: {
    /**
     * v5.22.32: auto-scroll + auto-expand do recém-adicionado.
     *
     * Quando o número de concretos AUMENTA, o novo registro é o
     * último do array. Setamos expandedId pra ele e scrollamos.
     *
     * Quando DIMINUI (remoção), não fazemos nada — o expandedId
     * pode ficar apontando pra um id que não existe mais, e os
     * computeds tratam disso. Próximo render escolhe outro
     * (ou o usuário escolhe).
     */
    'concretos.length'(newLen: number, oldLen: number) {
      if (newLen > oldLen && newLen > 0) {
        const novo = this.concretos[newLen - 1];
        if (novo) {
          this.expandedId = novo.id;
          // Scroll suave até o card recém-criado.
          // O ID do DOM segue o padrão `concreto-${id}` definido
          // no template.
          scrollToNewItem(`#concreto-${novo.id}`);
        }
      }
    },
  },
  mounted() {
    // v5.22.32: ao montar, se há concretos e nenhum está expandido,
    // expande o primeiro. Garante que ao voltar para esta tela o
    // usuário sempre vê um aberto.
    if (this.concretos.length > 0 && this.expandedId === null) {
      this.expandedId = this.concretos[0].id;
    }
  },
  methods: {
    /** v5.22.32: helper de leitura usado no template */
    isExpanded(id: string): boolean {
      return this.expandedId === id;
    },
    /**
     * v5.22.32: toggle single-maximized.
     * - Se clicar no já expandido: minimiza (expandedId = null).
     * - Senão: expande esse, automaticamente "fecha" os outros
     *   (porque a comparação `expandedId === c.id` só é true para um).
     */
    toggleExpanded(id: string) {
      this.expandedId = this.expandedId === id ? null : id;
    },
    /**
     * v5.22.35: handler de navegação por teclado. Delega a lógica
     * ao composable handleListKeyNav e aplica o resultado no estado
     * local. Vide composables/useListKeyboardNav.ts.
     */
    onListKeydown(e: KeyboardEvent) {
      const result = handleListKeyNav(e, {
        itemIds: this.concretos.map((c) => c.id),
        focusedId: this.focusedId,
        expandedId: this.expandedId,
      });
      if (!result.handled) return;
      e.preventDefault();
      if (result.focusedId !== undefined) this.focusedId = result.focusedId;
      if (result.expandedId !== undefined) this.expandedId = result.expandedId;
      if (result.scrollToId) {
        scrollToNewItem(`#concreto-${result.scrollToId}`, { block: 'nearest' });
      }
    },
    /**
     * v5.22.32: validação de completude usada no badge ⚠.
     *
     * Critérios mínimos para considerar "completo":
     *  - descrição não vazia
     *  - aplicação não vazia
     *  - FCK válido (entre 10 e 100)
     *  - pelo menos 1 linha de padrão de moldagem
     *
     * Retorna objeto com bool + lista de motivos (para tooltip).
     * Por que retornar motivos em vez de só bool? O tooltip
     * precisa explicar o que falta — caso contrário o usuário
     * tem que expandir pra descobrir.
     */
    concretoIncompleto(c: Concreto): { incompleto: boolean; motivos: string[] } {
      const motivos: string[] = [];
      if (!c.descricao || !c.descricao.trim()) {
        motivos.push('descrição do traço');
      }
      if (!c.aplicacao || !c.aplicacao.trim()) {
        motivos.push('aplicação');
      }
      const fckNum = typeof c.fck === 'number' ? c.fck : parseFloat(String(c.fck || ''));
      if (!fckNum || fckNum < 10 || fckNum > 100) {
        motivos.push('FCK válido (10–100 MPa)');
      }
      if (!c.padroesMoldagem || c.padroesMoldagem.length === 0) {
        motivos.push('padrão de moldagem');
      }
      return { incompleto: motivos.length > 0, motivos };
    },
    /** v5.22.18: dispara o evento de carga dos traços-modelo E exibe o
        banner de atenção logo acima da lista. */
    onSuggestDefaults() {
      this.$emit('suggest-defaults');
      this.showDefaultsAlert = true;
    },
    /**
     * v5.22.34: hooks da <transition> para animar abertura/fechamento
     * do card-body. Não dá pra usar CSS-only com max-height (precisa
     * adivinhar um teto), então medimos scrollHeight em JS e animamos.
     *
     * Sequência ao ABRIR:
     *   1. onBeforeEnter: element entra com height=0, overflow=hidden
     *   2. onEnter: medimos scrollHeight e setamos height = scrollHeight
     *      → CSS transition .25s anima de 0 até height final
     *   3. onAfterEnter: limpamos height inline para volta ao 'auto'
     *      (importante para conteúdo que muda dinamicamente depois)
     *
     * Sequência ao FECHAR (espelhada):
     *   1. onBeforeLeave: medimos scrollHeight, setamos como height
     *      inicial (estado "atual")
     *   2. onLeave: forçamos reflow, depois setamos height=0
     *      → CSS transition anima até 0
     *   3. Vue remove o elemento automaticamente
     */
    onBeforeEnter(el: Element) {
      const e = el as HTMLElement;
      e.style.height = '0';
      e.style.overflow = 'hidden';
    },
    onEnter(el: Element, done: () => void) {
      const e = el as HTMLElement;
      // requestAnimationFrame garante que o '0' inicial foi pintado
      requestAnimationFrame(() => {
        e.style.height = `${e.scrollHeight}px`;
        // Listener nativo de transitionend faz Vue saber que terminou
        const finish = () => {
          e.removeEventListener('transitionend', finish);
          done();
        };
        e.addEventListener('transitionend', finish);
      });
    },
    onAfterEnter(el: Element) {
      const e = el as HTMLElement;
      e.style.height = '';
      e.style.overflow = '';
    },
    onBeforeLeave(el: Element) {
      const e = el as HTMLElement;
      e.style.height = `${e.scrollHeight}px`;
      e.style.overflow = 'hidden';
    },
    onLeave(el: Element, done: () => void) {
      const e = el as HTMLElement;
      // Force reflow para o height inline "pegar" antes da transição
      void e.offsetHeight;
      requestAnimationFrame(() => {
        e.style.height = '0';
        const finish = () => {
          e.removeEventListener('transitionend', finish);
          done();
        };
        e.addEventListener('transitionend', finish);
      });
    },
    onUpdate(id: string, field: keyof Concreto, event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.$emit('update-concreto', { id, field, value });
    },
    /**
     * Procura o último concreto anterior que tem ao menos uma linha de
     * padrão de moldagem — esse é o candidato para o botão "Copiar
     * padrão anterior".
     */
    getCopySource(currentIndex: number): Concreto | null {
      for (let i = currentIndex - 1; i >= 0; i--) {
        const c = this.concretos[i];
        if (c.padroesMoldagem && c.padroesMoldagem.length > 0) return c;
      }
      return null;
    },
    onCopyPadraoAnterior(concretoAtual: Concreto, idx: number) {
      const source = this.getCopySource(idx);
      if (!source) return;
      if (concretoAtual.padroesMoldagem.length > 0) {
        const ok = window.confirm(
          `Substituir as ${concretoAtual.padroesMoldagem.length} linha(s) atuais por uma cópia de "${source.descricao || 'concreto anterior'}" (${source.padroesMoldagem.length} linha(s))?`,
        );
        if (!ok) return;
      }
      this.$emit('copy-padroes', {
        fromConcretoId: source.id,
        toConcretoId: concretoAtual.id,
      });
    },
  },
});
</script>
