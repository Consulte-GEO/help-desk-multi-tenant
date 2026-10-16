<template>
  <AppShell
    :current-step="step"
    :page-title="pageTitle"
    :steps="steps"
    :theme="theme"
    :save-state="saveState"
    :loading="loading"
    @navigate="goTo"
    @load-example-projetista="onLoadExampleProjetista"
    @toggle-theme="onToggleTheme"
    @reset="onReset"
    @back="onBack"
    @save="onSave"
    @next="onNext"
  >
    <!--
      v5.22.19 — Banner "Continuar onde parei". Aparece UMA VEZ por sessão
      de página quando o mounted() detecta um rascunho salvo neste
      navegador. Some assim que o usuário clica em Continuar ou Começar
      novo. Renderizado antes dos Steps para ficar visível no topo do
      conteúdo, sem competir com o título da etapa.
    -->
    <ResumeDraftBanner
      v-if="resumeBanner"
      :obra-nome="resumeBanner.obraNome"
      :updated-at="resumeBanner.updatedAt"
      :loading="loading"
      @resume="onResumeDraft"
      @dismiss="onDismissResume"
    />

    <!--
      v5.22.20 — Painel de Pendências persistente. Aparece nas Etapas
      1–6 listando bloqueantes + alertas de validação com botão "Ir
      para Etapa N". Some na Etapa 7 (Step8Preview já tem o resumo
      completo, mais detalhado).

      Resolve o problema raiz reportado pelo Thiago: "esqueci de coletar
      antes de começar". O usuário avança tranquilamente, vê em tempo
      real o que falta, e clica direto pra etapa do campo faltante —
      sem ter que caçar a célula.

      Não renderiza o componente quando não há pendências (o próprio
      componente já tem v-if interno em visibleItems.length > 0, mas
      este v-if externo evita a faixa de step 7 dispatching).
    -->
    <PendenciasPanel
      v-if="step < 7"
      :issues="validation.issues"
      :current-step="step"
      @go-to="goToWithFocus"
    />

    <!-- v5.22.36: ajuda contextual da etapa (vídeo + imagem do admin).
         Renderiza só se houver conteúdo configurado para a etapa. -->
    <StepHelpPanel :step-id="step" />

    <Step1DadosBasicos
      v-if="step === 1"
      :metadata="metadata"
      :import-state="importState"
      @update-meta="onUpdateMeta"
      @update-created-by="onUpdateCreatedBy"
      @update-modelo-projeto-field="onUpdateMPField"
      @import-planilha="onImportPlanilha"
    />

    <!-- v5.22.11: Step2TipoEstrutura removido. O switch Modelo de Preenchimento
         migrou para o topo do Step3GruposEditor (que agora é Etapa 2).
         Os componentes Step3-Step8 mantém o nome para preservar git diff
         compreensível; o que mudou foi o número da etapa que cada um ocupa. -->

    <Step3GruposEditor
      v-else-if="step === 2"
      :grupos="grupos"
      :is-modelo-projeto="isModeloProjeto"
      :modelo-preenchimento="metadata.modeloPreenchimento"
      @add-grupo="onAddGrupo"
      @remove-grupo="onRemoveGrupo"
      @duplicate-grupo="onDuplicateGrupo"
      @update-grupo="onUpdateGrupo"
      @reorder-grupos="onReorderGrupos"
    />

    <Step4Concretos
      v-else-if="step === 3"
      :concretos="concretos"
      :total-steps="7"
      @add-concreto="onAddConcreto"
      @remove-concreto="onRemoveConcreto"
      @update-concreto="onUpdateConcreto"
      @add-padrao="onAddPadrao"
      @remove-padrao="onRemovePadrao"
      @update-padrao="onUpdatePadrao"
      @copy-padroes="onCopyPadroes"
      @suggest-defaults="onSuggestConcretosDefault"
    />

    <Step5PecasEditor
      v-else-if="step === 4"
      :grupos="grupos"
      :concretos="concretos"
      :total-steps="7"
      @add-peca="onAddPeca"
      @remove-peca="onRemovePeca"
      @update-peca="onUpdatePeca"
      @reorder-pecas="onReorderPecas"
      @bulk-add="onBulkAdd"
      @copy-pecas="onCopyPecas"
    />

    <Step6UsuariosObra
      v-else-if="step === 5"
      :usuarios="usuariosObra"
      :total-steps="7"
      @add-usuario="onAddUsuario"
      @remove-usuario="onRemoveUsuario"
      @update-usuario="onUpdateUsuario"
    />

    <Step7Fornecedores
      v-else-if="step === 6"
      :fornecedores="fornecedores"
      :total-steps="7"
      @add-fornecedor="onAddFornecedor"
      @remove-fornecedor="onRemoveFornecedor"
      @update-fornecedor="onUpdateFornecedor"
      @add-fornecedor-email="onAddFornecedorEmail"
      @update-fornecedor-email="onUpdateFornecedorEmail"
      @remove-fornecedor-email="onRemoveFornecedorEmail"
    />

    <Step8Preview
      v-else-if="step === 7"
      :nodes="renderNodes"
      :v="validation"
      :client-message="clientMessage"
      :submit-loading="loading"
      :export-feedback="exportFeedback"
      :example-unchanged="isExampleUnchanged"
      :total-steps="7"
      @edit-item="onOpenDrawer"
      @update-client-message="onUpdateClientMessage"
    />

    <!-- v5.22.13: CTAs da Etapa 7 (Revisão e envio).
         Era v-if="step === 8" mas com a remoção da Etapa 2 (v5.22.11) virou Etapa 7.
         Esse condicional ficou esquecido na renumeração — bug que escondia
         o botão "Enviar para validação" no protótipo. -->
    <template #top-actions-extra>
      <!--
        v5.22.24 — Botão "Copiar link" disponível em qualquer etapa
        quando já há um draftId persistido. Cola na clipboard a URL
        completa com `?draft=:id` para o usuário compartilhar consigo
        mesmo (ex.: WhatsApp, anotação) ou com colega que vai
        continuar o cadastro em outra máquina.

        Estado visual: muda para "Link copiado!" por 2s para feedback
        imediato. Sem dependências externas — usa navigator.clipboard
        com fallback gracioso.
      -->
      <button
        v-if="draftId"
        type="button"
        class="btn sm"
        :title="linkButtonTitle"
        @click="onCopyDraftLink"
      >
        {{ linkButtonLabel }}
      </button>
      <!--
        v5.22.26 — Botão "Enviar por email". Aparece junto com o
        "Copiar link" quando há draftId persistido. Abre modal de
        compartilhamento que chama a Edge Function share-draft-link
        para enviar via Resend. Útil para formalizar a passagem da
        tarefa (estagiário → engenheiro, escritório → obra).
      -->
      <button
        v-if="draftId"
        type="button"
        class="btn sm"
        title="Enviar link deste rascunho por email"
        @click="onOpenShareModal"
      >
        Enviar por email
      </button>
      <template v-if="step === 7">
        <button
          type="button"
          class="btn sm success"
          :disabled="loading"
          @click="onExportExcel"
        >
          Exportar Excel
        </button>
        <button
          type="button"
          class="btn sm"
          :disabled="loading"
          title="Baixa o JSON no formato do GEO Controle Tecnológico (contrato criar_obra) para importar em Nova obra → Importar JSON"
          @click="onExportGeoControle"
        >
          Baixar JSON p/ GEO Controle
        </button>
        <button
          type="button"
          class="btn sm brand"
          :disabled="loading || bloqueantesCount > 0 || isExampleUnchanged"
          :title="submitButtonTitle"
          @click="onSubmitForValidation"
        >
          {{ loading ? 'Enviando...' : 'Enviar para validação' }}
        </button>
      </template>
    </template>
  </AppShell>

  <!--
    v5.22.12: Modais e drawer fora do AppShell. Cada um usa
    <Teleport to="body"> internamente, então renderizam direto no
    document.body — não dependem do slot #overlays nem da hierarquia
    do AppShell. Esta colocação aqui é só formal; o Teleport faria
    o trabalho mesmo se estivessem dentro do AppShell.
  -->
  <EditDrawer
    :open="drawerOpen"
    :peca="drawerPeca"
    :grupo-id="drawerGrupoId"
    @close="onCloseDrawer"
    @save="onSaveDrawer"
  />
  <SubmitTicketModal
    :ticket="currentTicket"
    @close="onCloseTicketModal"
  />
  <!--
    v5.22.26 — Modal de compartilhamento. Renderiza fora do AppShell
    via Teleport interno. Estado isolado: só precisa do draftId
    (vem do store) e do nome do criador (para sugerir o sender).
  -->
  <ShareDraftLinkModal
    ref="shareModal"
    :open="shareModalOpen"
    :draft-id="draftId"
    :suggested-sender-name="suggestedSenderName"
    @close="onCloseShareModal"
    @submit="onSendShareEmail"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { mapState } from 'vuex';
import AppShell from '../components/AppShell.vue';
import Step1DadosBasicos, { type ImportPlanilhaState } from '../components/Step1DadosBasicos.vue';
import Step3GruposEditor from '../components/Step3GruposEditor.vue';
import Step4Concretos from '../components/Step4Concretos.vue';
import Step5PecasEditor from '../components/Step5PecasEditor.vue';
import Step6UsuariosObra from '../components/Step6UsuariosObra.vue';
import Step7Fornecedores from '../components/Step7Fornecedores.vue';
import Step8Preview from '../components/Step8Preview.vue';
import EditDrawer from '../components/EditDrawer.vue';
import SubmitTicketModal from '../components/SubmitTicketModal.vue';
import ResumeDraftBanner from '../components/ResumeDraftBanner.vue';
import PendenciasPanel from '../components/PendenciasPanel.vue';
// v5.22.36 — painel de ajuda contextual (vídeo + imagem do admin)
import StepHelpPanel from '../components/StepHelpPanel.vue';
// v5.22.26 — modal de compartilhamento por email + service
import ShareDraftLinkModal from '../components/ShareDraftLinkModal.vue';
import { shareDraftLink } from '../services/setupShareService';
import {
  WIZARD_STEPS,
  cryptoUid,
  novoUsuarioObra,
  novoFornecedor,
  type Peca,
  type SetupSnapshot,
} from '../models/setup.models';
import type { SetupState } from '../store/modules/setup';
import type { ExportState } from '../store/modules/export';
// v5.22.47: exampleCommon não é mais importado — o botão "Carregar exemplo
// modelo simplificado" saiu junto com a opção de dois modelos. O mock
// continua exportado em mocks/ (usado pelo smoke-pipeline como fixture).
import { exampleModeloProjeto } from '../mocks/exampleSnapshots';
// v5.22.47: importação de planilha de implantação preenchida (Etapa 1)
import { importarPlanilhaImplantacao } from '../services/implantacaoImportService';
import { buildTechnicalJson } from '../services/jsonGeneratorService';
import { validateSnapshot, type ValidationBuckets } from '../services/validationService';
// v5.16: `preloadXlsx` carregado via dynamic import no watcher do step
// (linha ~254) para não puxar excelExportService no bundle eager.
// v5.18: `preloadSupabase` carregado estaticamente — o wrapper é leve,
// só dispara o dynamic import do @supabase/supabase-js quando chamado.
import { preloadSupabase } from '../services/supabaseClient';
// v5.22.19: ponteiro do "último rascunho neste navegador" — base do
// banner "Continuar onde parei".
import {
  getLastDraftPointer,
  clearLastDraftPointer,
  getDraftAccessToken,
  importDraftAccessToken,
  type LastDraftPointer,
} from '../services/setupDraftService';
import type { TechnicalJson, RenderGroupNode } from '../models/technicalMapping.models';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export default defineComponent({
  name: 'SetupPage',
  components: {
    AppShell,
    Step1DadosBasicos,
    Step3GruposEditor,
    Step4Concretos,
    Step5PecasEditor,
    Step6UsuariosObra,
    Step7Fornecedores,
    Step8Preview,
    EditDrawer,
    StepHelpPanel,
    SubmitTicketModal,
    ResumeDraftBanner,
    PendenciasPanel,
    // v5.22.26
    ShareDraftLinkModal,
  },
  data() {
    return {
      steps: WIZARD_STEPS,
      saveStateText: 'Rascunho salvo',
      /**
       * v5.22.19 — Ponteiro do "último rascunho neste navegador",
       * populado no mounted() a partir do localStorage. Quando não-null,
       * o banner ResumeDraftBanner é renderizado no topo da página.
       *
       * Vira null em 2 cenários:
       *   - Usuário clica "Continuar onde parei" → loadDraft + null
       *   - Usuário clica "Começar novo" → clearLastDraftPointer() + null
       *
       * NÃO é reativo ao localStorage por si só (não há listener de
       * storage event aqui) — só lê uma vez no mounted. Isso é
       * proposital: o banner é uma decisão "no momento da abertura", não
       * algo que muda no meio do fluxo.
       */
      resumeBanner: null as LastDraftPointer | null,
      /**
       * v5.22.19 — handler do beforeunload. Mantemos a referência para
       * conseguir removê-lo no beforeUnmount sem vazar listener.
       */
      beforeUnloadHandler: null as ((e: BeforeUnloadEvent) => void) | null,
      /**
       * v5.22.24 — estado visual do botão "Copiar link". Quando true,
       * o label muda para "Link copiado!" durante 2s para dar feedback
       * imediato. Não persistido em LS.
       */
      linkJustCopied: false,
      linkCopiedTimer: null as ReturnType<typeof setTimeout> | null,
      /**
       * v5.22.26 — controla visibilidade do ShareDraftLinkModal.
       * Aberto pelo botão "Enviar por email" da topbar. Fechado pelo
       * cancelar, pelo backdrop ou pelo auto-close de 2s após sucesso.
       */
      shareModalOpen: false,
      /**
       * v5.22.47 — estado da importação de planilha de implantação
       * (card na Etapa 1). null = nenhuma importação nesta sessão.
       */
      importState: null as ImportPlanilhaState | null,
    };
  },
  computed: {
    ...mapState({
      step: (s: any) => (s.setup as SetupState).step,
      theme: (s: any) => (s.setup as SetupState).theme,
      showJson: (s: any) => (s.setup as SetupState).showJson,
      metadata: (s: any) => (s.setup as SetupState).metadata,
      tipoEstrutura: (s: any) => (s.setup as SetupState).tipoEstrutura,
      grupos: (s: any) => (s.setup as SetupState).grupos,
      concretos: (s: any) => (s.setup as SetupState).concretos,
      comentarios: (s: any) => (s.setup as SetupState).comentarios,
      audit: (s: any) => (s.setup as SetupState).audit,
      loading: (s: any) => (s.setup as SetupState).loading,
      drawerOpen: (s: any) => (s.setup as SetupState).drawerOpen,
      drawerItemId: (s: any) => (s.setup as SetupState).drawerItemId,
      draftId: (s: any) => (s.setup as SetupState).draftId,
      submissionId: (s: any) => (s.setup as SetupState).submissionId,
      lastSavedAt: (s: any) => (s.setup as SetupState).lastSavedAt,
      lastExportFeedback: (s: any) => (s.export as ExportState).lastFeedback,
      /* v5.20 */
      clientMessage: (s: any) => (s.setup as SetupState).clientMessage,
      currentTicket: (s: any) => (s.setup as SetupState).currentTicket,
      /* v5.22.6 */
      usuariosObra: (s: any) => (s.setup as SetupState).usuariosObra,
      /* v5.22.7 */
      fornecedores: (s: any) => (s.setup as SetupState).fornecedores,
    }),
    pageTitle(): string {
      const w = WIZARD_STEPS.find((x) => x.id === (this as any).step);
      return w?.title ?? 'Cadastro simplificado';
    },
    isModeloProjeto(): boolean {
      // v5.22.47: modelo único — o wizard sempre renderiza o layout
      // completo (Tipo de Estrutura, Número da Estrutura e Projetista).
      // Snapshots antigos com 'comum' são normalizados no store; as views
      // de revisão (/r/, /s/) continuam decidindo pelo snapshot recebido
      // para preservar a renderização de submissões antigas.
      return true;
    },
    snapshot(): SetupSnapshot {
      const self = this as any;
      return {
        step: self.step,
        theme: self.theme,
        showJson: self.showJson,
        metadata: self.metadata,
        tipoEstrutura: self.tipoEstrutura,
        grupos: self.grupos,
        concretos: self.concretos,
        comentarios: self.comentarios,
        audit: self.audit,
        usuariosObra: self.usuariosObra,
        fornecedores: self.fornecedores,
      };
    },
    payload(): TechnicalJson {
      return buildTechnicalJson(this.snapshot, {
        draftId: (this as any).draftId,
        submissionId: (this as any).submissionId,
      });
    },
    validation(): ValidationBuckets {
      return validateSnapshot(this.snapshot);
    },
    /** v5.22.4: bloqueantes (erros) acumulados na validação atual. */
    bloqueantesCount(): number {
      return this.validation.bloqueantes.length;
    },
    /** v5.22.4: getter Vuex — true se exemplo carregado e nada editado. */
    isExampleUnchanged(): boolean {
      return this.$store.getters['setup/isExampleUnchanged'] === true;
    },
    /** v5.22.4: tooltip do botão Enviar — explica por que está desabilitado. */
    submitButtonTitle(): string {
      if (this.isExampleUnchanged) {
        return 'Edite ao menos um campo antes de enviar (exemplo carregado intocado)';
      }
      if (this.bloqueantesCount > 0) {
        return `Corrija ${this.bloqueantesCount} erro(s) antes de enviar`;
      }
      return 'Enviar para validação da equipe Consulte GEO';
    },
    renderNodes(): RenderGroupNode[] {
      return this.payload.renderTree.nodes;
    },
    exportFeedback(): string {
      return (this as any).lastExportFeedback || '';
    },
    saveState(): string {
      if ((this as any).loading) return 'Salvando...';
      return this.saveStateText;
    },
    drawerPeca(): Peca | null {
      const id = (this as any).drawerItemId;
      if (!id) return null;
      // resolve via renderNodes (id é unidadeTempId, label === peca.local)
      const child = this.renderNodes
        .flatMap((n) => n.children.map((c) => ({ node: n, child: c })))
        .find(({ child }) => child.id === id);
      if (!child) return null;
      // localizar peça correspondente no grupo customer-side
      for (const g of (this as any).grupos) {
        const p = g.pecas.find((p: Peca) => p.local === child.child.label);
        if (p) return p;
      }
      return null;
    },
    drawerGrupoId(): string {
      const peca = this.drawerPeca;
      if (!peca) return '';
      for (const g of (this as any).grupos) {
        if (g.pecas.find((p: Peca) => p.id === peca.id)) return g.id;
      }
      return '';
    },
    /**
     * v5.22.24 — Label do botão "Copiar link". Alterna entre o estado
     * normal e "Link copiado!" por 2s após clique. Não usa ícone para
     * ficar legível em qualquer largura sem precisar de CSS extra.
     */
    linkButtonLabel(): string {
      return this.linkJustCopied ? '✓ Link copiado!' : 'Copiar link';
    },
    /**
     * v5.22.24 — title (tooltip) com explicação completa para quem
     * passa o mouse. O label é curto para caber na topbar; o tooltip
     * conta o resto.
     */
    linkButtonTitle(): string {
      return this.linkJustCopied
        ? 'Link copiado! Cole onde quiser para retomar este rascunho.'
        : 'Copiar link para retomar este rascunho em outra máquina ou compartilhar com colega.';
    },
    /**
     * v5.22.26 — Sugestão de "Seu nome" no modal de compartilhamento.
     * Pré-preenche com o nome de quem criou a obra (createdBy.nome do
     * metadata), se houver. Senão devolve string vazia — o campo
     * continua opcional e o usuário pode preencher manualmente.
     */
    suggestedSenderName(): string {
      const meta = (this as any).metadata;
      return (meta?.createdBy?.nome || '').trim();
    },
  },
  async mounted() {
    // restaura tema preferido se já existia
    document.documentElement.dataset.theme = (this as any).theme;

    // v5.18: Warm-up oportunista do Supabase. O wrapper supabaseClient.ts
    // já está no bundle eager (importado por store/modules/setup.ts), mas
    // `preloadSupabase()` é o que dispara o download lazy do
    // `@supabase/supabase-js` (~53 KB gzip). Chamamos aqui para esconder
    // a latência do 1º autosave. Falha silenciosa.
    preloadSupabase().catch(() => undefined);

    const self = this as any;

    // V8: links compartilhados carregam id+token no fragmento
    // `#draft=<uuid>&token=<uuid>`. Fragmentos não são enviados ao servidor
    // nem no Referer. O formato antigo `?draft=<id>` continua aceito quando
    // este navegador já possui o token/cache local correspondente.
    let draftIdFromUrl: unknown = this.$route.query.draft;
    let hadSecretFragment = false;
    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const sharedId = fragment.get('draft');
      const sharedToken = fragment.get('token');
      if (sharedId && sharedToken) {
        hadSecretFragment = true;
        try {
          importDraftAccessToken(sharedId, sharedToken);
          draftIdFromUrl = sharedId;
        } catch {
          draftIdFromUrl = null;
        }
      }
    }
    if (typeof draftIdFromUrl === 'string' && draftIdFromUrl.trim()) {
      try {
        const row = await this.$store.dispatch('setup/loadDraft', draftIdFromUrl.trim());
        if (row) {
          this.$store.commit('setup/addAuditLocal', { acao: 'rascunho_carregado_via_link' });
        }
      } catch {
        // Falha de rede ou token inválido → fluxo normal continua.
      } finally {
        // Remove id/token da barra e do histórico assim que foram importados.
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } else if (hadSecretFragment && typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    // v5.22.19: detecta rascunho salvo neste navegador e oferece retomada.
    // Só mostra o banner se:
    //   - existe pointer no LS
    //   - não há draftId no state (não acabou de carregar via outro caminho)
    //   - não há exemplo carregado (exampleLoadedKey === null)
    // Se o pointer aponta para o mesmo draftId atual, não mostra (redundante).
    const pointer = getLastDraftPointer();
    if (
      pointer &&
      !self.draftId &&
      !self.$store.state.setup.exampleLoadedKey &&
      pointer.id
    ) {
      this.resumeBanner = pointer;
    }

    // v5.22.19: beforeunload — avisa o usuário se ele tentar fechar a aba
    // com edições não salvas (isDirty=true). Como o autosave roda a cada
    // 3s, na maior parte do tempo isDirty é false e o aviso não dispara.
    // Só aparece se o usuário fechar dentro da janela de debounce.
    //
    // Browsers modernos exigem e.preventDefault() + e.returnValue = ''.
    // A string customizada é ignorada (browsers mostram texto padrão por
    // segurança), mas precisamos do returnValue setado.
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (!self.$store.state.setup.isDirty) return;
      e.preventDefault();
      // legado para Chrome/Firefox antigos
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  },
  beforeUnmount() {
    // v5.22.19: remove o listener para não vazar entre navegações SPA.
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
    // v5.22.24: cancela timer pendente do feedback do botão "Copiar link".
    // Sem isto, se o usuário copia o link e navega antes dos 2s, o timer
    // dispara em componente já desmontado (erro silencioso no console).
    if (this.linkCopiedTimer) {
      clearTimeout(this.linkCopiedTimer);
      this.linkCopiedTimer = null;
    }
  },
  watch: {
    theme(t: 'light' | 'dark') {
      document.documentElement.dataset.theme = t;
    },
    step(s: number) {
      // Warm-up oportunista: começa a baixar o chunk do gravador XLSX quando o usuário
      // chega na Etapa 6 (revisão visual). Quando clicar em exportar na Etapa 7,
      // o módulo já estará em cache.
      // v5.16: dynamic import do próprio excelExportService (que internamente
      // faz dynamic import do xlsxStyleLite interno). Dispara o code-split sem
      // bloquear nem importar nada eagerly.
      if (s >= 6) {
        import('../services/excelExportService')
          .then((mod) => mod.preloadXlsx())
          .catch(() => {
            /* falha silenciosa — fallback é baixar no clique */
          });
      }
    },
  },
  methods: {
    /* navegação */
    goTo(stepId: number) {
      this.$store.commit('setup/setStep', stepId);
      this.$store.commit('setup/addAuditLocal', { acao: 'navegacao_etapa' });
    },
    /**
     * v5.22.21 → v5.22.23 — Navega até a etapa pedida E foca o input
     * correspondente via `data-field-id`. Quando `fieldId` é null
     * (pendência aponta para lista vazia ou campo singleton sem
     * data-field-id mapeado), só navega.
     *
     * v5.22.23 — Reescrito de async/await para fluxo síncrono no
     * setStep + nextTick(callback) para o foco. Motivo: usuário
     * reportou "tela em branco" ao clicar "Ir para Etapa N" na
     * v5.22.22. Hipótese mais provável: o async/await + RAF anterior
     * podia propagar uma Promise rejeitada (ex.: scrollIntoView com
     * options em browser antigo) e o Vue 3 transforma isso em erro
     * de render. Agora:
     *
     *   1. Navegação é SÍNCRONA — setStep, ponto. Se algo der errado
     *      depois, pelo menos o usuário chegou na etapa certa.
     *   2. Foco é agendado via `this.$nextTick(callback)` em vez de
     *      `await this.$nextTick()`. Callback isolado em try/catch
     *      jamais propaga erro para o caller.
     *   3. Removido o requestAnimationFrame extra — desnecessário em
     *      99% dos casos e fonte potencial de race.
     *
     * O caminho do foco continua: querySelector pelo data-field-id +
     * scrollIntoView + focus. Falha silenciosa em qualquer ponto.
     */
    goToWithFocus(payload: { step: number; fieldId: string | null }) {
      // 1) Navegação síncrona — isolada de qualquer DOM.
      const current = (this as any).step;
      if (current !== payload.step) {
        this.$store.commit('setup/setStep', payload.step);
        this.$store.commit('setup/addAuditLocal', { acao: 'navegacao_etapa' });
      }
      if (!payload.fieldId) return;

      // 2) Foco após re-render. nextTick(callback) é "fire-and-forget":
      // se algo dentro do callback lançar, fica isolado no microtask
      // do Vue e não volta como Promise rejeitada para o emit.
      const fieldId = payload.fieldId;
      this.$nextTick(() => {
        try {
          if (typeof document === 'undefined') return;
          const escaped = fieldId.replace(/"/g, '\\"');
          const el = document.querySelector<HTMLElement>(
            `[data-field-id="${escaped}"]`,
          );
          if (!el) return; // campo não mapeado — só navega
          // scrollIntoView com options pode falhar em browsers
          // antigos; o try-interno cai pra forma sem options.
          try {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } catch {
            el.scrollIntoView();
          }
          try {
            el.focus({ preventScroll: true });
          } catch {
            el.focus();
          }
          this.$store.commit('setup/addAuditLocal', { acao: 'focar_campo' });
        } catch {
          // Não propaga. Se o foco falhar, ao menos a navegação
          // (síncrona acima) já aconteceu.
        }
      });
    },
    onBack() {
      const s = (this as any).step;
      if (s > 1) {
        this.$store.commit('setup/setStep', s - 1);
        this.$store.commit('setup/addAuditLocal', { acao: 'voltar' });
      }
    },
    async onNext() {
      const s = (this as any).step;
      /*
       * v5.22.27 — Correção de renumeração obsoleta. A v5.22.11
       * reduziu o wizard de 8 para 7 etapas, mas este handler ficou
       * com os limites antigos (`s === 8` / `s < 8`), o que permitia
       * `setStep(8)` quando o usuário avançava da Etapa 7. Nenhum
       * `v-else-if="step === N"` cobre N=8 → tela branca. Provável
       * causa raiz do bug "tela branca" herdado da v5.22.23.
       *
       * Agora:
       *   - Etapa 7 (Revisão e envio) → submit
       *   - Etapas 1-6 → avança +1
       *   - Step >= 7 + !submit → no-op (defesa)
       */
      if (s === 7) {
        await this.onSubmitForValidation();
        return;
      }
      if (s >= 1 && s < 7) {
        this.$store.commit('setup/setStep', s + 1);
        this.$store.commit('setup/addAuditLocal', { acao: 'avancar' });
      }
    },
    async onSave() {
      try {
        await this.$store.dispatch('setup/saveDraft');
        this.saveStateText = 'Rascunho salvo';
      } catch (err) {
        this.saveStateText = 'Erro ao salvar';
      }
    },

    /* v5.22.19: handlers do ResumeDraftBanner */

    /**
     * Carrega o rascunho apontado pelo pointer e esconde o banner.
     * Se o rascunho sumiu (Supabase retornou null, ex.: usuário em
     * outro dispositivo, ou rascunho cancelado), limpa o pointer
     * silencioso e informa via saveStateText.
     */
    async onResumeDraft() {
      const pointer = this.resumeBanner;
      if (!pointer) return;
      try {
        this.saveStateText = 'Carregando rascunho...';
        const row = await this.$store.dispatch('setup/loadDraft', pointer.id);
        if (!row) {
          // rascunho não existe mais — limpa pointer e some
          clearLastDraftPointer();
          this.resumeBanner = null;
          this.saveStateText = 'Rascunho anterior não encontrado';
          return;
        }
        this.resumeBanner = null;
        this.saveStateText = 'Rascunho carregado';
      } catch (err) {
        this.saveStateText = 'Erro ao carregar rascunho';
      }
    },

    /**
     * Usuário escolheu começar do zero. Limpa o pointer (senão o banner
     * voltaria na próxima abertura) e some o banner. NÃO mexe no state —
     * o usuário pode continuar editando o que já tinha em tela (ou
     * carregar exemplo, ou começar puro).
     */
    onDismissResume() {
      clearLastDraftPointer();
      this.resumeBanner = null;
    },

    /**
     * v5.22.45 — Copia a URL da página atual com `draftId + token` no
     * fragmento. Fluxo:
     *   1. garante que o rascunho possui identidade remota V8;
     *   2. monta `#draft=<uuid>&token=<uuid>` (não enviado no request/Referer);
     *   3. tenta navigator.clipboard.writeText (API moderna)
     *   4. fallback: cria textarea oculto + execCommand('copy') (browsers
     *      antigos / contexto não seguro como http://localhost)
     *   5. feedback visual de 2s no botão
     *
     * Não há toast/snackbar — o botão MUDA o label para "Link copiado!"
     * (mais imediato que toast e não bloqueia interação).
     */
    async onCopyDraftLink() {
      let id = (this as any).draftId as string | null;
      if (!id || typeof window === 'undefined') return;

      let token = getDraftAccessToken(id);
      if (!token) {
        // Rascunho legado/local: salva para migrar para a identidade V8.
        try {
          const row = await this.$store.dispatch('setup/saveDraft');
          id = row?.id ?? id;
          token = getDraftAccessToken(id);
        } catch {
          token = null;
        }
      }
      if (!id || !token) {
        window.prompt(
          'Não foi possível criar um link compartilhável. Salve o rascunho com conexão e tente novamente.',
          '',
        );
        return;
      }

      const base = window.location.origin + window.location.pathname;
      const fragment = new URLSearchParams({ draft: id, token });
      const url = `${base}#${fragment.toString()}`;

      let success = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(url);
          success = true;
        }
      } catch {
        // ignore — cai no fallback
      }
      if (!success) {
        try {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          ta.style.pointerEvents = 'none';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          success = true;
        } catch {
          if (typeof window.prompt === 'function') {
            window.prompt('Copie o link manualmente:', url);
            success = true;
          }
        }
      }

      if (success) {
        this.$store.commit('setup/addAuditLocal', { acao: 'link_copiado' });
        this.linkJustCopied = true;
        if (this.linkCopiedTimer) clearTimeout(this.linkCopiedTimer);
        this.linkCopiedTimer = setTimeout(() => {
          this.linkJustCopied = false;
          this.linkCopiedTimer = null;
        }, 2000);
      }
    },

    /* v5.22.26 — Compartilhamento por email --------------------------- */
    onOpenShareModal() {
      if (!(this as any).draftId) return;
      this.shareModalOpen = true;
      this.$store.commit('setup/addAuditLocal', {
        acao: 'share_modal_aberto',
      });
    },
    onCloseShareModal() {
      this.shareModalOpen = false;
    },
    /**
     * Recebe o submit do ShareDraftLinkModal e chama o setupShareService.
     * O modal entrega o resultado de volta via refs ($refs.shareModal):
     *  - resolveSend(...) em caso de sucesso (modal mostra ✓ e auto-fecha em 2s)
     *  - failSend(...)    em caso de erro (modal mostra alert.danger)
     *
     * Auditoria local registra os 2 desfechos com `acao` distinta.
     */
    async onSendShareEmail(payload: {
      recipientEmail: string;
      recipientName?: string;
      senderName?: string;
      message?: string;
    }) {
      let id = (this as any).draftId as string | null;
      const modal = this.$refs.shareModal as
        | { resolveSend: (p: { sentTo: string; status?: string }) => void;
            failSend: (msg: string) => void }
        | undefined;
      if (!id) {
        modal?.failSend('Rascunho ainda não foi salvo. Aguarde alguns segundos e tente de novo.');
        return;
      }
      try {
        if (!getDraftAccessToken(id)) {
          const row = await this.$store.dispatch('setup/saveDraft');
          id = row?.id ?? id;
        }
        if (!id || !getDraftAccessToken(id)) {
          throw new Error('draft_token_missing');
        }
        const res = await shareDraftLink({
          draftId: id,
          recipientEmail: payload.recipientEmail,
          recipientName: payload.recipientName,
          senderName: payload.senderName,
          message: payload.message,
        });
        if (res.ok) {
          this.$store.commit('setup/addAuditLocal', {
            acao: 'email_solicitado',
            detalhe: payload.recipientEmail,
          });
          modal?.resolveSend({
            sentTo: res.sent_to || payload.recipientEmail, status: res.email_status,
          });
        } else {
          this.$store.commit('setup/addAuditLocal', {
            acao: 'share_email_falhou',
            detalhe: res.error || 'erro_desconhecido',
          });
          modal?.failSend(`Não foi possível enviar o email: ${res.error || 'erro desconhecido'}`);
        }
      } catch (err) {
        this.$store.commit('setup/addAuditLocal', {
          acao: 'share_email_falhou',
          detalhe: String(err).slice(0, 200),
        });
        modal?.failSend(`Falha de rede ao enviar email: ${String(err).slice(0, 200)}`);
      }
    },

    /* topbar */
    onToggleTheme() {
      const next = (this as any).theme === 'light' ? 'dark' : 'light';
      this.$store.commit('setup/setTheme', next);
      this.$store.commit('setup/addAuditLocal', { acao: 'tema' });
    },
    onReset() {
      if (typeof window !== 'undefined' && !window.confirm('Limpar todo o rascunho local?')) return;
      this.$store.commit('setup/reset');
      this.$store.commit('setup/addAuditLocal', { acao: 'rascunho_limpo' });
    },
    onLoadExampleProjetista() {
      const snap = exampleModeloProjeto();
      this.$store.commit('setup/loadExampleSnapshot', { snapshot: snap, key: 'projetista' });
      this.$store.commit('setup/addAuditLocal', { acao: 'exemplo_modelo_projeto' });
    },

    /* step 1 */
    onUpdateMeta(p: { field: string; value: unknown }) {
      this.$store.commit('setup/updateMetadataField', p);
      this.debouncedAudit(`campo_${p.field}`);
    },
    onUpdateCreatedBy(p: { field: string; value: string }) {
      this.$store.commit('setup/updateCreatedByField', p);
      this.debouncedAudit(`responsavel_${p.field}`);
    },
    onUpdateMPField(p: { field: string; value: string }) {
      this.$store.commit('setup/updateModeloProjetoField', p);
      this.debouncedAudit(`modelo_projeto_${p.field}`);
    },

    /**
     * v5.22.47: importa uma planilha de implantação preenchida (modelo
     * novo R02 ou modelo antigo R00/R01) e hidrata o wizard inteiro.
     * O parse roda em implantacaoImportService (XLSX + core UMD lazy).
     * Coleções vêm prontas no shape do wizard; a substituição acontece
     * na mutation setup/applyImportedData (com confirmação prévia se já
     * houver conteúdo digitado).
     */
    async onImportPlanilha(file: File) {
      const jaTemConteudo =
        (this as any).grupos.some(
          (g: any) => g.pecas.length || (g.nome || '').trim() || (g.edificacoesInput || '-') !== '-',
        ) || (this as any).usuariosObra.some((u: any) => (u.nome || '').trim());
      if (
        jaTemConteudo &&
        typeof window !== 'undefined' &&
        !window.confirm(
          'Importar a planilha substitui as estruturas, peças, concretos, usuários e fornecedores já preenchidos. Continuar?',
        )
      ) {
        return;
      }
      this.importState = { status: 'importing', arquivo: file.name };
      try {
        const resultado = await importarPlanilhaImplantacao(file);
        this.$store.commit('setup/applyImportedData', resultado);
        this.$store.commit('setup/addAuditLocal', {
          acao: 'planilha_importada',
          detalhe: `${file.name} · formato ${resultado.formato} · ${resultado.resumo.estruturas} estrutura(s), ${resultado.resumo.pecas} peça(s)`,
        });
        this.importState = {
          status: 'done',
          arquivo: file.name,
          resumo: resultado.resumo,
          avisos: resultado.avisos,
        };
      } catch (err) {
        this.importState = {
          status: 'error',
          arquivo: file.name,
          erro: err instanceof Error ? err.message : String(err),
        };
        this.$store.commit('setup/addAuditLocal', {
          acao: 'planilha_importacao_falhou',
          detalhe: String(err).slice(0, 200),
        });
      }
    },

    /* step 3 */
    onAddGrupo() {
      const seed = this.isModeloProjeto ? { tipoEdificacao: 'Bloco' } : {};
      this.$store.commit('setup/addGrupo', seed);
      this.$store.commit('setup/addAuditLocal', { acao: 'grupo_adicionado' });
    },
    onRemoveGrupo(id: string) {
      this.$store.commit('setup/removeGrupo', id);
      this.$store.commit('setup/addAuditLocal', { acao: 'grupo_removido' });
    },
    onDuplicateGrupo(id: string) {
      this.$store.commit('setup/duplicateGrupo', id);
      this.$store.commit('setup/addAuditLocal', { acao: 'grupo_duplicado' });
    },
    onUpdateGrupo(p: { id: string; field: string; value: unknown }) {
      this.$store.commit('setup/updateGrupoField', p);
      this.debouncedAudit(`grupo_${p.field}`);
    },
    /** v5.22.38: reordenação de grupos via drag-and-drop. */
    onReorderGrupos(p: { from: number; to: number }) {
      this.$store.commit('setup/reorderGrupos', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'grupo_reordenado' });
    },

    /* step 4 — concretos */
    onAddConcreto() {
      this.$store.commit('setup/addConcreto');
      this.$store.commit('setup/addAuditLocal', { acao: 'concreto_adicionado' });
    },
    /**
     * v5.22.10: cliente clicou "Sugerir traços padrão" no estado vazio
     * da Etapa 4. Popula a lista com os 5 traços comuns.
     */
    onSuggestConcretosDefault() {
      this.$store.commit('setup/suggestConcretosDefault');
      this.$store.commit('setup/addAuditLocal', { acao: 'concretos_padrao_sugeridos' });
    },
    onRemoveConcreto(id: string) {
      this.$store.commit('setup/removeConcreto', id);
      this.$store.commit('setup/addAuditLocal', { acao: 'concreto_removido' });
    },
    onUpdateConcreto(p: { id: string; field: string; value: unknown }) {
      this.$store.commit('setup/updateConcretoField', p);
      this.debouncedAudit(`concreto_${p.field}`);
    },
    onAddPadrao(p: { concretoId: string; seed?: unknown }) {
      this.$store.commit('setup/addPadraoMoldagem', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'padrao_moldagem_adicionado' });
    },
    onRemovePadrao(p: { concretoId: string; padraoId: string }) {
      this.$store.commit('setup/removePadraoMoldagem', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'padrao_moldagem_removido' });
    },
    onUpdatePadrao(p: { concretoId: string; padraoId: string; field: string; value: unknown }) {
      this.$store.commit('setup/updatePadraoMoldagemField', p);
      this.debouncedAudit(`padrao_${p.field}`);
    },
    onCopyPadroes(p: { fromConcretoId: string; toConcretoId: string }) {
      this.$store.commit('setup/copyPadroesEntreConcretos', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'padrao_moldagem_copiado' });
    },

    /* step 5 — peças */
    onAddPeca(p: { grupoId: string }) {
      this.$store.commit('setup/addPeca', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'peca_adicionada' });
    },
    onRemovePeca(p: { grupoId: string; pecaId: string }) {
      this.$store.commit('setup/removePeca', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'peca_removida' });
    },
    onUpdatePeca(p: { grupoId: string; pecaId: string; field: string; value: unknown }) {
      this.$store.commit('setup/updatePecaField', p);
      this.debouncedAudit(`peca_${p.field}`);
    },
    /** v5.22.38: reordenação de peças dentro de um grupo via drag-and-drop. */
    onReorderPecas(p: { grupoId: string; from: number; to: number }) {
      this.$store.commit('setup/reorderPecas', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'peca_reordenada' });
    },
    onBulkAdd(p: { grupoId: string; start: number; end: number; fck: string; volume: string }) {
      this.$store.commit('setup/bulkAddPavimentos', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'pavimentos_em_massa' });
    },
    onCopyPecas(p: { fromGrupoId: string; toGrupoId: string }) {
      this.$store.commit('setup/copyPecasEntreGrupos', p);
      this.$store.commit('setup/addAuditLocal', { acao: 'estrutura_copiada' });
    },

    /* step 6 — drawer */
    onOpenDrawer(itemId: string) {
      this.$store.commit('setup/setDrawer', { open: true, itemId });
    },
    onCloseDrawer() {
      this.$store.commit('setup/setDrawer', { open: false, itemId: null });
    },
    onSaveDrawer(p: { grupoId: string; pecaId: string; patch: any }) {
      Object.entries(p.patch).forEach(([field, value]) => {
        this.$store.commit('setup/updatePecaField', {
          grupoId: p.grupoId,
          pecaId: p.pecaId,
          field,
          value,
        });
      });
      this.$store.commit('setup/addAuditLocal', { acao: 'edicao_inline_previa' });
      this.onCloseDrawer();
    },

    /* step 7 */
    onToggleJson() {
      this.$store.commit('setup/toggleJson');
      this.$store.commit('setup/addAuditLocal', { acao: 'toggle_json' });
    },
    async onExportJson() {
      await this.$store.dispatch('export/exportJson', {
        json: this.payload,
        draftId: (this as any).draftId,
        submissionId: (this as any).submissionId,
      });
    },
    async onExportExcel() {
      await this.$store.dispatch('export/exportExcel', {
        json: this.payload,
        draftId: (this as any).draftId,
        submissionId: (this as any).submissionId,
      });
    },
    async onCopyJson() {
      await this.$store.dispatch('export/copyJson', {
        json: this.payload,
        draftId: (this as any).draftId,
        submissionId: (this as any).submissionId,
      });
    },
    async onExportGeoControle() {
      await this.$store.dispatch('export/exportGeoControle', {
        snapshot: this.snapshot,
        draftId: (this as any).draftId,
        submissionId: (this as any).submissionId,
      });
    },

    /* v5.22.6 — Etapa 6 (Usuários da obra) */
    onAddUsuario() {
      this.$store.commit('setup/addUsuarioObra', novoUsuarioObra());
      this.$store.commit('setup/addAuditLocal', { acao: 'usuario_add' });
      this.$store.dispatch('setup/persistDebounced');
    },
    onRemoveUsuario(id: string) {
      this.$store.commit('setup/removeUsuarioObra', id);
      this.$store.commit('setup/addAuditLocal', { acao: 'usuario_remove' });
      this.$store.dispatch('setup/persistDebounced');
    },
    onUpdateUsuario(payload: { id: string; field: string; value: string }) {
      this.$store.commit('setup/updateUsuarioObra', payload);
      this.$store.dispatch('setup/persistDebounced');
    },

    /* v5.22.7 — Etapa 7 (Fornecedores) */
    /**
     * v5.22.22: aceita tipo ('usina' | 'laboratorio') do botão clicado.
     * Default 'usina' preserva chamada antiga (compat retroativa caso
     * exista código fora do Step7 chamando sem args — sidebar, etc).
     */
    onAddFornecedor(tipo: 'usina' | 'laboratorio' = 'usina') {
      this.$store.commit('setup/addFornecedor', novoFornecedor(tipo));
      this.$store.commit('setup/addAuditLocal', {
        acao: `fornecedor_add_${tipo}`,
      });
      this.$store.dispatch('setup/persistDebounced');
    },
    onRemoveFornecedor(id: string) {
      this.$store.commit('setup/removeFornecedor', id);
      this.$store.commit('setup/addAuditLocal', { acao: 'fornecedor_remove' });
      this.$store.dispatch('setup/persistDebounced');
    },
    onUpdateFornecedor(payload: { id: string; field: string; value: unknown }) {
      this.$store.commit('setup/updateFornecedor', payload);
      this.$store.dispatch('setup/persistDebounced');
    },
    onAddFornecedorEmail(id: string) {
      this.$store.commit('setup/addFornecedorEmail', id);
      this.$store.dispatch('setup/persistDebounced');
    },
    onUpdateFornecedorEmail(payload: { id: string; index: number; value: string }) {
      this.$store.commit('setup/updateFornecedorEmail', payload);
      this.$store.dispatch('setup/persistDebounced');
    },
    onRemoveFornecedorEmail(payload: { id: string; index: number }) {
      this.$store.commit('setup/removeFornecedorEmail', payload);
      this.$store.dispatch('setup/persistDebounced');
    },

    /* v5.20 — Etapa 8 (submit) */
    onUpdateClientMessage(msg: string) {
      this.$store.commit('setup/setClientMessage', msg);
    },
    async onSubmitForValidation() {
      // Guard de double-click além do já no Vuex.
      if ((this as any).loading) return;
      // Bloqueantes? Step6 já desabilita o botão, mas reforço aqui.
      if ((this as any).validation.bloqueantes.length) {
        this.saveStateText = `Corrija ${
          (this as any).validation.bloqueantes.length
        } erro(s) antes de enviar.`;
        return;
      }
      try {
        await this.$store.dispatch('setup/submit');
        // O modal abre automaticamente porque currentTicket virou truthy.
        this.saveStateText = 'Proposta enviada.';
      } catch (err) {
        this.saveStateText = err instanceof Error ? err.message : 'Erro ao enviar.';
      }
    },
    onCloseTicketModal() {
      // Limpa o ticket do state. O cliente continua na Etapa 6 (read-only
      // visualmente — o submit refaria uma submissão duplicada, mas a
      // Edge Function rate-limita por draftId em 60s e o backend lock
      // do draft impede reuso para um novo submit em produção).
      this.$store.commit('setup/clearTicket');
    },

    /* step 8 */
    onSetStatus(status: string) {
      this.$store.commit('setup/setStatus', status);
      this.$store.commit('setup/addAuditLocal', {
        actor: 'Equipe Consulte GEO',
        acao: `status_${status}`,
      });
    },
    onAddComment() {
      const mensagem = typeof window !== 'undefined'
        ? window.prompt('Comentário da equipe Consulte GEO:')
        : '';
      if (!mensagem) return;
      this.$store.commit('setup/addComentario', {
        id: cryptoUid('com'),
        autor: 'Equipe Consulte GEO',
        mensagem,
        timestamp: new Date().toISOString(),
        itemReferenciado: '',
      });
      this.$store.commit('setup/addAuditLocal', { acao: 'comentario_adicionado' });
    },

    /* utilitário interno: debounce de auditoria para edições por digitação */
    debouncedAudit(acao: string) {
      this.saveStateText = 'Salvando...';
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.$store.commit('setup/addAuditLocal', { acao });
        this.saveStateText = 'Rascunho salvo';
      }, 500);
    },
  },
});
</script>
