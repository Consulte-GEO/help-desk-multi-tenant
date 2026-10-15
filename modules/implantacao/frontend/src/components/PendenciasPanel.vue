<template>
  <!--
    v5.22.20 — Painel de Pendências persistente

    Aparece nas etapas 1–6 do wizard (some na Etapa 7 porque o
    Step8Preview já tem o resumo completo de validação). Mostra
    pendências REAIS de preenchimento — bloqueantes (que impedem o
    envio) e alertas (que permitem envio mas devem ser revistos).

    Sugestões (info) e pendências internas (revisão Consulte GEO)
    ficam de fora — não são "campos que faltam" do ponto de vista
    do usuário.

    Padrão visual:
      - tem bloqueante  → .alert.danger
      - só alertas      → .alert.warning
    Reusa pares fg/bg já validados pelo smoke-contrast.ts.

    Cada item tem botão "Ir para Etapa N" quando a pendência está em
    outra etapa; quando está na etapa atual, mostra "(nesta etapa)"
    em vez do botão. O usuário recebe foco direcionado sem caçar
    a célula.
  -->
  <div
    v-if="visibleItems.length > 0"
    class="alert pendencias-panel"
    :class="severityClass"
    role="region"
    aria-label="Pendências do rascunho"
  >
    <div class="pendencias-panel__header">
      <strong>{{ headlineText }}</strong>
      <button
        type="button"
        class="btn xs nav-back pendencias-panel__toggle"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ocultar detalhes' : 'Ver detalhes' }}
      </button>
    </div>
    <ul v-if="expanded" class="pendencias-panel__list">
      <li
        v-for="(item, i) in visibleItems"
        :key="i"
        class="pendencias-panel__item"
        :class="`pendencias-panel__item--${item.severity}`"
      >
        <span
          class="pendencias-panel__badge"
          :class="`pendencias-panel__badge--${item.severity}`"
        >{{ item.severity === 'error' ? 'Bloqueia envio' : 'Atenção' }}</span>
        <span class="pendencias-panel__loc">{{ item.locDisplay }}</span>
        <span class="pendencias-panel__msg">{{ item.message }}</span>
        <button
          v-if="item.step !== currentStep"
          type="button"
          class="btn xs primary pendencias-panel__goto"
          @click="$emit('go-to', { step: item.step, fieldId: item.fieldId })"
        >Ir para Etapa {{ item.step }}</button>
        <button
          v-else-if="item.fieldId"
          type="button"
          class="btn xs nav-back pendencias-panel__goto"
          @click="$emit('go-to', { step: item.step, fieldId: item.fieldId })"
        >Focar campo</button>
        <span
          v-else
          class="pendencias-panel__here"
        >(nesta etapa)</span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ValidationIssue } from '../models/validation.models';
// v5.22.25 — pathToStep centralizado em stepMappingService. Antes vivia
// neste arquivo (duplicado com o validationService). Reuso para garantir
// que mudanças no wizard fiquem em um só lugar.
import { pathToStep } from '../services/stepMappingService';

interface DisplayItem {
  step: number;
  locDisplay: string;
  message: string;
  severity: 'error' | 'warning';
  /**
   * v5.22.21 — identificador para localizar o input correspondente no DOM,
   * no formato data-field-id="...". Null quando não há input específico
   * mapeável (ex.: pendência "cadastre pelo menos um grupo" — não é um
   * input específico, é uma lista vazia). Nesses casos o handler apenas
   * navega para a etapa, sem scroll/focus extra.
   */
  fieldId: string | null;
}

/**
 * v5.22.25 — Calcula o identificador DOM (`data-field-id`) que aponta para
 * o input correspondente à pendência. Convenção de duas vias:
 *
 *   1. Entidade conhecida (peça/grupo): `${entityTemporaryId}-${campo}`
 *      O Step5 e Step3 colocam `data-field-id` exatamente nesse formato
 *      nos inputs relevantes. Ex.: "peca_abc123-volume".
 *
 *   2. Sem entityTemporaryId (campos singleton, ex.: nome da obra):
 *      derivamos um id estável a partir do `path`:
 *        metadata.obraNome              → "meta-obraNome"
 *        metadata.createdBy.email       → "meta-createdBy-email"
 *      O Step1 marca esses inputs com `data-field-id` correspondente.
 *
 *   3. Casos onde a pendência aponta para uma LISTA (não um input):
 *      ex.: `grupos`, `grupos[*].pecas`, `usuariosObra` (lista vazia).
 *      Não há campo para focar — retorna null. Handler só navega.
 *
 * Função pura: não acessa DOM. Aceita apenas dados do issue.
 */
function computeFieldId(issue: ValidationIssue): string | null {
  // (1) entidade conhecida + campo nomeado
  if (issue.entityTemporaryId && issue.campo) {
    return `${issue.entityTemporaryId}-${issue.campo}`;
  }
  // (2) campos singleton baseados no path
  const path = issue.path;
  if (path.startsWith('metadata.')) {
    // metadata.obraNome → meta-obraNome
    // metadata.createdBy.email → meta-createdBy-email
    return 'meta-' + path.slice('metadata.'.length).replace(/\./g, '-');
  }
  // (3) listas sem entidade alvo — não há foco específico
  return null;
}

export default defineComponent({
  name: 'PendenciasPanel',
  props: {
    /**
     * Issues vindas do validationService. O componente filtra
     * internamente para mostrar só severity='error' e 'warning'
     * (info/pending ficam fora).
     */
    issues: {
      type: Array as PropType<ValidationIssue[]>,
      required: true,
    },
    /**
     * Etapa atual do wizard. Itens dessa etapa não recebem o botão
     * "Ir para Etapa N" — eles ficam marcados como "(nesta etapa)".
     */
    currentStep: { type: Number, required: true },
  },
  /**
   * v5.22.21 — payload do go-to agora carrega step + fieldId:
   * { step: number, fieldId: string | null }.
   * fieldId null = o handler só navega; fieldId presente = navega +
   * scrollIntoView + focus do elemento DOM correspondente.
   */
  emits: ['go-to'],
  data() {
    return {
      // v5.22.23 — Per-session apenas (não persiste no LS). Começa
      // RECOLHIDO por padrão (mudança da v5.22.20 que começava
      // expandido). Razão: o usuário pediu — o painel só mostra o
      // sumário ("3 pendências bloqueiam o envio") e ele decide se
      // quer abrir. Reduz ruído quando o usuário está focado num
      // campo específico.
      expanded: false,
    };
  },
  computed: {
    /**
     * Lista pré-processada: só errors + warnings, com step calculado e
     * label de localização legível. Mantém a ordem natural (errors
     * primeiro porque o validationService já os agrega assim).
     */
    visibleItems(): DisplayItem[] {
      const out: DisplayItem[] = [];
      for (const it of this.issues) {
        if (it.severity !== 'error' && it.severity !== 'warning') continue;
        const step = pathToStep(it.path);
        /*
         * v5.22.25 — `localizacao` agora vem normalizado do
         * validationService no formato "Etapa N · Título" quando é
         * genérico, ou com o nome semântico (ex.: "Bloco 1") quando há
         * contexto. O regex de workaround abaixo continua como defesa
         * em profundidade: rascunhos antigos persistidos no Supabase
         * podem carregar issues legadas com "Etapa N" desalinhado.
         */
        let locDisplay = it.localizacao || '';
        if (/^Etapa \d+$/.test(locDisplay)) {
          locDisplay = `Etapa ${step}`;
        }
        if (!locDisplay) locDisplay = `Etapa ${step}`;
        out.push({
          step,
          locDisplay,
          message: it.message,
          severity: it.severity,
          fieldId: computeFieldId(it),
        });
      }
      return out;
    },
    errorCount(): number {
      return this.visibleItems.filter((i) => i.severity === 'error').length;
    },
    warningCount(): number {
      return this.visibleItems.filter((i) => i.severity === 'warning').length;
    },
    severityClass(): string {
      return this.errorCount > 0 ? 'danger' : 'warning';
    },
    headlineText(): string {
      const e = this.errorCount;
      const w = this.warningCount;
      if (e > 0 && w > 0) {
        return `${e} ${e === 1 ? 'pendência bloqueia o envio' : 'pendências bloqueiam o envio'} + ${w} ${w === 1 ? 'alerta' : 'alertas'} para revisar`;
      }
      if (e > 0) {
        return `${e} ${e === 1 ? 'pendência bloqueia o envio' : 'pendências bloqueiam o envio'}`;
      }
      return `${w} ${w === 1 ? 'alerta para revisar antes do envio' : 'alertas para revisar antes do envio'}`;
    },
  },
});
</script>
