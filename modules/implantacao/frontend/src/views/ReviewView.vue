<template>
  <div>
  <AppShell
    v-if="payload"
    :current-step="currentStep"
    :steps="steps"
    :page-title="pageTitle"
    :save-state="saveStateText"
    :theme="theme"
    :loading="false"
    @navigate="onNavigate"
    @load-example-projetista="noop"
    @toggle-theme="toggleTheme"
    @reset="noop"
    @back="onBack"
    @save="noop"
    @next="onAdvance"
  >
    <!-- Banner topo: indica que é tela da equipe + chamado + status -->
    <div class="alert" :class="status === 'devolvido' ? 'warning' : 'info'" style="margin-bottom: 16px">
      <strong>Chamado {{ ticketNumber }}</strong>
      <span>
        · Status: {{ statusLabel }}
        · Recebido em {{ submittedAtBR }}
        <span v-if="teamEditsCount > 0">
          · {{ teamEditsCount }} edição(ões) da equipe
        </span>
      </span>
    </div>

    <!-- v5.22.11: Banner de feedback de ações (Aprovar/Devolver) com auto-dismiss.
         Sucesso desaparece em 12s; erro só sai ao clicar X. Antes (v5.22.9)
         a ação era totalmente silenciosa — usuário não tinha confirmação. -->
    <div
      v-if="actionFeedback"
      class="alert action-feedback"
      :class="actionFeedbackClass"
      style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px"
      role="status"
      aria-live="polite"
    >
      <span><strong>{{ actionFeedback }}</strong></span>
      <button
        type="button"
        class="btn sm"
        @click="dismissFeedback"
        title="Fechar"
      >
        ×
      </button>
    </div>

    <!-- Mensagem original do cliente — sempre visível no topo -->
    <div v-if="clientMessage" class="card" style="margin-bottom: 16px">
      <div class="card-body">
        <div class="kicker">Observação enviada pelo cliente</div>
        <blockquote class="client-msg">{{ clientMessage }}</blockquote>
      </div>
    </div>

    <!-- v5.22.11: Etapas 1-6 editáveis pela equipe (mesmos componentes do
         SetupPage). Numeração: 1=DadosBasicos, 2=Blocos e torres (Step3),
         3=Concretos (Step4), 4=Pavimentos e peças (Step5), 5=Usuários (Step6),
         6=Fornecedores (Step7). 7=Revisão visual com cards clicáveis,
         8=Validação para Implantação, 9=Acompanhamento. -->
    <Step1DadosBasicos
      v-if="currentStep === 1"
      :metadata="editSnap.metadata"
      :total-steps="9"
      @update-field="onSnapField"
    />
    <Step3GruposEditor
      v-else-if="currentStep === 2"
      :grupos="editSnap.grupos"
      :modelo-preenchimento="editSnap.metadata.modeloPreenchimento"
      :is-modelo-projeto="editSnap.metadata.modeloPreenchimento === 'modelo_projeto'"
      :total-steps="9"
      @add-grupo="onAddGrupo"
      @remove-grupo="onRemoveGrupo"
      @update-grupo="onUpdateGrupo"
    />
    <Step4Concretos
      v-else-if="currentStep === 3"
      :concretos="editSnap.concretos"
      :total-steps="9"
      @add-concreto="onAddConcreto"
      @remove-concreto="onRemoveConcreto"
      @update-concreto="onUpdateConcreto"
      @suggest-defaults="onSuggestConcretosDefault"
    />
    <Step5PecasEditor
      v-else-if="currentStep === 4"
      :grupos="editSnap.grupos"
      :concretos="editSnap.concretos"
      :total-steps="9"
      @add-peca="onAddPeca"
      @remove-peca="onRemovePeca"
      @update-peca="onUpdatePeca"
      @bulk-add="onBulkAdd"
      @copy-pecas="onCopyPecas"
    />
    <Step6UsuariosObra
      v-else-if="currentStep === 5"
      :usuarios="editSnap.usuariosObra"
      :total-steps="9"
      @add-usuario="onAddUsuario"
      @remove-usuario="onRemoveUsuario"
      @update-usuario="onUpdateUsuario"
    />
    <Step7Fornecedores
      v-else-if="currentStep === 6"
      :fornecedores="editSnap.fornecedores"
      :total-steps="9"
      @add-fornecedor="onAddFornecedor"
      @remove-fornecedor="onRemoveFornecedor"
      @update-fornecedor="onUpdateFornecedor"
      @add-fornecedor-email="onAddFornecedorEmail"
      @update-fornecedor-email="onUpdateFornecedorEmail"
      @remove-fornecedor-email="onRemoveFornecedorEmail"
    />

    <!-- Etapa 7: Revisão visual com cards CLICÁVEIS -->
    <div v-else-if="currentStep === 7">
      <div class="kicker">Etapa 7 de 9 · Revisão visual</div>
      <h2 style="margin: 4px 0 4px">Revisão visual da estrutura</h2>
      <p class="card-description">
        Visão consolidada do que foi cadastrado. Clique em um card para navegar
        direto à etapa correspondente.
      </p>

      <div class="card" style="margin-top: 16px">
        <div class="card-body grid grid-3">
          <button
            type="button"
            class="nav-card-button"
            @click="onNavigate(2)"
            :title="`Ver Etapa 2 — ${countEstruturas} estruturas`"
          >
            <strong>{{ countEstruturas }}</strong>
            <span>estruturas (blocos/torres)</span>
            <small>Editar na Etapa 2 →</small>
          </button>
          <button
            type="button"
            class="nav-card-button"
            @click="onNavigate(4)"
            :title="`Ver Etapa 4 — ${countPecas} peças`"
          >
            <strong>{{ countPecas }}</strong>
            <span>peças/pavimentos</span>
            <small>Editar na Etapa 4 →</small>
          </button>
          <button
            type="button"
            class="nav-card-button"
            @click="onNavigate(3)"
            :title="`Ver Etapa 3 — ${countConcretos} concretos`"
          >
            <strong>{{ countConcretos }}</strong>
            <span>concretos cadastrados</span>
            <small>Editar na Etapa 3 →</small>
          </button>
          <button
            type="button"
            class="nav-card-button"
            @click="onNavigate(5)"
            :title="`Ver Etapa 5 — ${editSnap.usuariosObra.length} usuários`"
          >
            <strong>{{ editSnap.usuariosObra.length }}</strong>
            <span>usuários da obra</span>
            <small>Editar na Etapa 5 →</small>
          </button>
          <button
            type="button"
            class="nav-card-button"
            @click="onNavigate(6)"
            :title="`Ver Etapa 6 — ${editSnap.fornecedores.length} fornecedores`"
          >
            <strong>{{ editSnap.fornecedores.length }}</strong>
            <span>fornecedores</span>
            <small>Editar na Etapa 6 →</small>
          </button>
        </div>
      </div>
    </div>

    <!-- Etapa 8: Validação para Implantação (decisão) -->
    <Step9ValidacaoImplantacao
      v-else-if="currentStep === 8"
      :ticket-number="ticketNumber"
      :obra-nome="obraNome"
      :obra-codigo="obraCodigo"
      :submitted-at="submittedAtBR"
      :status="status"
      :loading="actionLoading"
      :technical-json="(buildTechnicalJsonFromEditSnap() as object) || null"
      @open-return-modal="onOpenReturnModal"
      @approve="onApprove"
    />

    <!-- Etapa 9: Acompanhamento -->
    <Step10Acompanhamento
      v-else-if="currentStep === 9"
      :comments="comments"
      :reviewer="reviewer"
      :audit-events="auditEvents"
      :loading="commentLoading"
      :feedback="commentFeedback"
      :feedback-class="commentFeedbackClass"
      @update-reviewer="reviewer = $event"
      @add-comment="onAddComment"
    />

    <!-- v5.22.9: top-actions-extra — botão Aprovar para implantação no topo,
         visível em todas as etapas para a equipe -->
    <template #top-actions-extra>
      <button
        v-if="canApprove"
        type="button"
        class="btn sm success"
        :disabled="actionLoading"
        @click="onApprove"
        :title="`Aprovar implantação do chamado ${ticketNumber}`"
      >
        {{ actionLoading ? 'Aprovando...' : 'Aprovar para implantação' }}
      </button>
      <button
        v-if="canReturn"
        type="button"
        class="btn sm"
        :disabled="actionLoading"
        @click="onOpenReturnModal"
        :title="`Devolver ${ticketNumber} ao responsável`"
      >
        Devolver
      </button>
    </template>

    <!-- v5.22.11: O slot #overlays do AppShell foi removido como local
         do modal. Em v5.22.9 eu havia colocado o ReturnSubmissionModal
         dentro de `<template #overlays>`, mas isso causava o modal a
         não abrir em algumas situações. Agora fica fora do AppShell,
         direto no root da view — igual era em v5.22.8 (que funcionava). -->
  </AppShell>

  <!-- Loading / erro inicial — antes de o payload chegar -->
  <div v-else class="app-shell" :data-theme="theme">
    <main class="main">
      <header class="topbar">
        <div>
          <div class="kicker">Validação · Equipe Consulte GEO</div>
          <h1 style="margin: 4px 0 0">{{ loading ? 'Carregando...' : 'Link inválido' }}</h1>
        </div>
      </header>
      <section class="content">
        <div v-if="loading" class="empty"><p>Carregando chamado...</p></div>
        <div v-else-if="error" class="card">
          <div class="card-body">
            <div class="alert danger">
              <strong>Não foi possível abrir este link.</strong>
              <span>{{ errorMessage }}</span>
            </div>
            <p style="margin-top: 12px">
              O link pode ter expirado. Confira o e-mail original ou contate
              alguém da equipe.
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!--
    v5.22.12: O componente em si pode ficar em qualquer lugar do template —
    ReturnSubmissionModal usa <Teleport to="body"> internamente, então
    renderiza como filho direto do document.body. Esta colocação aqui
    fora do AppShell + dentro do <div> raiz é só formal.
  -->
  <ReturnSubmissionModal
    :open="returnModalOpen"
    :reviewer="reviewer"
    :loading="returnLoading"
    :error="returnError"
    @cancel="onCancelReturnModal"
    @confirm="onConfirmReturn"
    @update-reviewer="reviewer = $event"
  />
  </div>
</template>

<script lang="ts">
import {emailStatusLabel} from '../support/email-status';
import { defineComponent } from 'vue';
import {
  loadByToken,
  updateStatusByToken,
  addReviewComment,
  returnSubmissionWithComment,
  updateTechnicalJsonByReviewToken,
} from '../services/ticketService';
import type {
  TicketReviewPayload,
  ReviewComment,
  SetupSnapshot,
  UsuarioObra,
  Fornecedor,
  Grupo,
  Concreto,
  Peca,
} from '../models/setup.models';
import {
  WIZARD_STEPS_FULL,
  defaultSnapshot,
  novoUsuarioObra,
  novoFornecedor,
  novoGrupo,
  novoConcreto,
  novaPeca,
  concretosPadrao,
} from '../models/setup.models';
import AppShell from '../components/AppShell.vue';
import Step1DadosBasicos from '../components/Step1DadosBasicos.vue';
import Step3GruposEditor from '../components/Step3GruposEditor.vue';
import Step4Concretos from '../components/Step4Concretos.vue';
import Step5PecasEditor from '../components/Step5PecasEditor.vue';
import Step6UsuariosObra from '../components/Step6UsuariosObra.vue';
import Step7Fornecedores from '../components/Step7Fornecedores.vue';
import Step9ValidacaoImplantacao from '../components/Step9ValidacaoImplantacao.vue';
import Step10Acompanhamento from '../components/Step10Acompanhamento.vue';
import ReturnSubmissionModal from '../components/ReturnSubmissionModal.vue';

interface AuditRow {
  id: string;
  created_at: string;
  actor: string;
  action: string;
}

interface TechnicalJsonShape {
  metadata?: Record<string, unknown>;
  customerInput?: {
    dadosBasicos?: Record<string, unknown>;
    tipoEstrutura?: string;
    grupos?: Grupo[];
    concretos?: Concreto[];
    usuariosObra?: UsuarioObra[];
    fornecedores?: Fornecedor[];
    [k: string]: unknown;
  };
  technicalMapping?: {
    unidadeGrupos?: unknown[];
    unidades?: unknown[];
    concretos?: unknown[];
  };
  [k: string]: unknown;
}

export default defineComponent({
  name: 'ReviewView',
  components: {
    AppShell,
    Step1DadosBasicos,
    Step3GruposEditor,
    Step4Concretos,
    Step5PecasEditor,
    Step6UsuariosObra,
    Step7Fornecedores,
    Step9ValidacaoImplantacao,
    Step10Acompanhamento,
    ReturnSubmissionModal,
  },
  props: {
    token: { type: String, required: true },
  },
  data() {
    return {
      theme: 'light' as 'light' | 'dark',
      loading: true,
      error: false,
      errorMessage: '',
      payload: null as TicketReviewPayload | null,
      // Estado editável (espelha SetupPage)
      editSnap: defaultSnapshot() as SetupSnapshot,
      // Wizard navigation
      currentStep: 8 as number, // v5.22.11: abre direto na 8 (validação) — equipe pode navegar para qualquer etapa
      steps: WIZARD_STEPS_FULL,
      // Save state debounce
      saveStateText: '' as string,
      saveTimer: null as ReturnType<typeof setTimeout> | null,
      saveInFlight: false,
      // Aux
      reviewer: '',
      actionLoading: false,
      returnModalOpen: false,
      returnLoading: false,
      returnError: '',
      // v5.22.11: feedback global de ações (aprovar/devolver)
      actionFeedback: '' as string,
      actionFeedbackClass: 'info' as 'success' | 'danger' | 'info',
      feedbackTimer: null as ReturnType<typeof setTimeout> | null,
      comments: [] as ReviewComment[],
      auditEvents: [] as AuditRow[],
      commentLoading: false,
      commentFeedback: '',
      commentFeedbackClass: 'info' as string,
      teamEditsCount: 0,
    };
  },
  computed: {
    pageTitle(): string {
      const w = WIZARD_STEPS_FULL.find((s) => s.id === this.currentStep);
      return w?.title ?? 'Validação';
    },
    ticketNumber(): string {
      return this.payload?.ticket?.ticket_number ?? '';
    },
    status(): string {
      return this.payload?.submission?.status ?? 'enviado';
    },
    statusLabel(): string {
      const m: Record<string, string> = {
        enviado: 'Recebido',
        em_validacao: 'Em validação',
        devolvido: 'Devolvido',
        aprovado: 'Aprovado',
        implantado: 'Implantado',
        cancelado: 'Cancelado',
      };
      return m[this.status] ?? this.status;
    },
    obraNome(): string {
      return this.editSnap.metadata.obraNome
        || this.payload?.submission?.obra_nome
        || '';
    },
    obraCodigo(): string {
      return this.editSnap.metadata.obraId
        || this.payload?.submission?.obra_codigo
        || '';
    },
    submittedAtBR(): string {
      return this.formatDateBR(this.payload?.submission?.submitted_at ?? '');
    },
    clientMessage(): string {
      return this.payload?.ticket?.client_message ?? '';
    },
    // Contagens (alimentadas pelo editSnap — refletem edições da equipe ao vivo)
    countEstruturas(): number {
      return this.editSnap.grupos.length;
    },
    countPecas(): number {
      return this.editSnap.grupos.reduce((sum, g) => sum + g.pecas.length, 0);
    },
    countConcretos(): number {
      return this.editSnap.concretos.length;
    },
    canApprove(): boolean {
      return ['enviado', 'em_validacao'].includes(this.status);
    },
    canReturn(): boolean {
      return ['enviado', 'em_validacao'].includes(this.status);
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    noop() { /* handlers AppShell não usados aqui */ },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
    },
    formatDateBR(iso: string): string {
      if (!iso) return '';
      try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
      catch { return iso; }
    },
    async load() {
      this.loading = true;
      this.error = false;
      try {
        const payload = await loadByToken(this.token);
        this.payload = payload;
        this.comments = payload.comments ?? [];
        const auditRaw = (payload as unknown as { audit?: unknown[] }).audit;
        this.auditEvents = Array.isArray(auditRaw) ? auditRaw as AuditRow[] : [];
        this.teamEditsCount = (payload.submission as unknown as { team_edits_count?: number })
          ?.team_edits_count ?? 0;
        // Hidrata o editSnap com o technical_json
        const tj = (payload.submission as unknown as { technical_json?: TechnicalJsonShape }).technical_json;
        if (tj) this.hydrateEditSnap(tj);
      } catch (err) {
        this.error = true;
        this.errorMessage = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
    /**
     * v5.22.9: reconstrói o editSnap a partir do technical_json para que
     * a equipe possa editar nas mesmas telas que o cliente vê.
     */
    hydrateEditSnap(tj: TechnicalJsonShape) {
      const snap = defaultSnapshot();
      const ci = tj.customerInput;
      if (ci) {
        if (ci.dadosBasicos) {
          snap.metadata = { ...snap.metadata, ...(ci.dadosBasicos as Record<string, unknown>) };
        }
        if (typeof ci.tipoEstrutura === 'string') {
          snap.tipoEstrutura = ci.tipoEstrutura as SetupSnapshot['tipoEstrutura'];
        }
        if (Array.isArray(ci.grupos)) snap.grupos = ci.grupos;
        if (Array.isArray(ci.concretos)) snap.concretos = ci.concretos;
        if (Array.isArray(ci.usuariosObra)) snap.usuariosObra = ci.usuariosObra;
        if (Array.isArray(ci.fornecedores)) snap.fornecedores = ci.fornecedores;
      }
      this.editSnap = snap;
    },
    /**
     * Reconstrói o technical_json a partir do estado editado.
     * Preserva campos não tocados (metadata, validation, audit, etc).
     */
    buildTechnicalJsonFromEditSnap(): TechnicalJsonShape {
      const original = (this.payload?.submission as unknown as { technical_json?: TechnicalJsonShape })
        ?.technical_json ?? {};
      return {
        ...original,
        customerInput: {
          ...(original.customerInput ?? {}),
          dadosBasicos: { ...this.editSnap.metadata },
          tipoEstrutura: this.editSnap.tipoEstrutura,
          grupos: this.editSnap.grupos,
          concretos: this.editSnap.concretos,
          usuariosObra: this.editSnap.usuariosObra,
          fornecedores: this.editSnap.fornecedores,
        },
        metadata: {
          ...(original.metadata ?? {}),
          lastTeamEditAt: new Date().toISOString(),
        },
      };
    },
    /**
     * v5.22.9: dispatch debounced de save. Cada mutação no editSnap
     * chama isto; consolidamos saves após 800ms de quietude.
     */
    scheduleSave() {
      this.saveStateText = 'Editando...';
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.flushSave(), 800);
    },
    async flushSave() {
      if (this.saveInFlight) return;
      // Não salvar enquanto está em status final (aprovado/implantado/cancelado)
      if (!['enviado', 'em_validacao', 'devolvido'].includes(this.status)) {
        this.saveStateText = 'Status final — não salvo';
        return;
      }
      this.saveInFlight = true;
      this.saveStateText = 'Salvando...';
      try {
        const tj = this.buildTechnicalJsonFromEditSnap();
        const r = await updateTechnicalJsonByReviewToken(this.token, tj, this.reviewer || 'team_review');
        this.teamEditsCount = r.team_edits_count;
        this.saveStateText = `Salvo · ${r.team_edits_count} edição(ões)`;
      } catch (err) {
        this.saveStateText = err instanceof Error ? `Erro: ${err.message}` : 'Erro ao salvar';
      } finally {
        this.saveInFlight = false;
      }
    },
    // ===== Navegação =====
    onNavigate(s: number) {
      this.currentStep = Math.max(1, Math.min(9, s));
    },
    onBack() {
      if (this.currentStep > 1) this.currentStep--;
    },
    onAdvance() {
      if (this.currentStep < 9) this.currentStep++;
    },
    // ===== Mutações no editSnap =====
    onSnapField(p: { field: string; value: unknown }) {
      (this.editSnap.metadata as unknown as Record<string, unknown>)[p.field] = p.value;
      this.scheduleSave();
    },
    onUpdateTipo(t: SetupSnapshot['tipoEstrutura']) {
      this.editSnap.tipoEstrutura = t;
      this.scheduleSave();
    },
    // v5.22.47: onUpdateModelo removido — era listener morto: o Step3
    // deixou de emitir 'change-modelo' na v5.22.18, e agora o modelo de
    // preenchimento é único (sempre completo).
    // Grupos
    onAddGrupo() {
      this.editSnap.grupos.push(novoGrupo());
      this.scheduleSave();
    },
    onRemoveGrupo(id: string) {
      const i = this.editSnap.grupos.findIndex((g) => g.id === id);
      if (i >= 0) this.editSnap.grupos.splice(i, 1);
      this.scheduleSave();
    },
    onUpdateGrupo(p: { id: string; field: string; value: unknown }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.id);
      if (!g) return;
      (g as unknown as Record<string, unknown>)[p.field] = p.value;
      this.scheduleSave();
    },
    // Concretos
    onAddConcreto() {
      this.editSnap.concretos.push(novoConcreto());
      this.scheduleSave();
    },
    onRemoveConcreto(id: string) {
      const i = this.editSnap.concretos.findIndex((c) => c.id === id);
      if (i >= 0) this.editSnap.concretos.splice(i, 1);
      this.scheduleSave();
    },
    onUpdateConcreto(p: { id: string; field: string; value: unknown }) {
      const c = this.editSnap.concretos.find((x) => x.id === p.id);
      if (!c) return;
      (c as unknown as Record<string, unknown>)[p.field] = p.value;
      this.scheduleSave();
    },
    /**
     * v5.22.10: equipe pode sugerir traços padrão se cliente deixou
     * a lista vazia. Idempotente: só popula se concretos estiver vazio.
     */
    onSuggestConcretosDefault() {
      if (this.editSnap.concretos.length > 0) return;
      this.editSnap.concretos = concretosPadrao();
      this.scheduleSave();
    },
    // Peças
    onAddPeca(p: { grupoId: string }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      g.pecas.push(novaPeca());
      this.scheduleSave();
    },
    onRemovePeca(p: { grupoId: string; pecaId: string }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      const i = g.pecas.findIndex((pe) => pe.id === p.pecaId);
      if (i >= 0) g.pecas.splice(i, 1);
      this.scheduleSave();
    },
    onUpdatePeca(p: { grupoId: string; pecaId: string; field: keyof Peca; value: unknown }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      const pe = g.pecas.find((x) => x.id === p.pecaId);
      if (!pe) return;
      (pe as unknown as Record<string, unknown>)[p.field] = p.value;
      this.scheduleSave();
    },
    onBulkAdd() { /* equipe pode editar peça por peça; bulk não suportado aqui ainda */ },
    onCopyPecas() { /* idem */ },
    // Usuários
    onAddUsuario() {
      this.editSnap.usuariosObra.push(novoUsuarioObra());
      this.scheduleSave();
    },
    onRemoveUsuario(id: string) {
      const i = this.editSnap.usuariosObra.findIndex((u) => u.id === id);
      if (i >= 0) this.editSnap.usuariosObra.splice(i, 1);
      this.scheduleSave();
    },
    onUpdateUsuario(p: { id: string; field: keyof UsuarioObra; value: string }) {
      const u = this.editSnap.usuariosObra.find((x) => x.id === p.id);
      if (!u) return;
      (u as unknown as Record<string, string>)[p.field] = p.value;
      this.scheduleSave();
    },
    // Fornecedores
    // v5.22.22: aceita tipo do botão clicado (usina/laboratorio).
    onAddFornecedor(tipo: 'usina' | 'laboratorio' = 'usina') {
      this.editSnap.fornecedores.push(novoFornecedor(tipo));
      this.scheduleSave();
    },
    onRemoveFornecedor(id: string) {
      const i = this.editSnap.fornecedores.findIndex((f) => f.id === id);
      if (i >= 0) this.editSnap.fornecedores.splice(i, 1);
      this.scheduleSave();
    },
    onUpdateFornecedor(p: { id: string; field: keyof Fornecedor; value: unknown }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      (f as unknown as Record<string, unknown>)[p.field] = p.value;
      this.scheduleSave();
    },
    onAddFornecedorEmail(id: string) {
      const f = this.editSnap.fornecedores.find((x) => x.id === id);
      if (!f) return;
      if (f.emailsProgramacao.length >= 3) return;
      f.emailsProgramacao.push('');
      this.scheduleSave();
    },
    onUpdateFornecedorEmail(p: { id: string; index: number; value: string }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      if (p.index < 0 || p.index >= f.emailsProgramacao.length) return;
      f.emailsProgramacao[p.index] = p.value;
      this.scheduleSave();
    },
    onRemoveFornecedorEmail(p: { id: string; index: number }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      if (f.emailsProgramacao.length <= 1) f.emailsProgramacao[0] = '';
      else f.emailsProgramacao.splice(p.index, 1);
      this.scheduleSave();
    },
    // ===== Aprovação / Devolução =====
    async onApprove() {
      if (this.actionLoading) return;
      if (!confirm(`Aprovar implantação do chamado ${this.ticketNumber}? Esta ação não pode ser revertida.`)) return;
      this.actionLoading = true;
      try {
        // Antes de aprovar, garante que último save foi persistido
        if (this.saveTimer) {
          clearTimeout(this.saveTimer);
          await this.flushSave();
        }
        const r = await updateStatusByToken({
          token: this.token,
          status: 'aprovado',
          reviewer: this.reviewer,
        });
        await this.load();
        // v5.22.11: feedback explícito após aprovar.
        // NOTA: hoje NÃO existe Edge Function de notify-approve. O update
        // só marca o status no banco. Cliente não é notificado por email
        // automaticamente nesta versão. Texto reflete isso honestamente.
        this.showFeedback(
          `Chamado ${this.ticketNumber} aprovado para implantação. Status atualizado em ${this.formatDateBR(r.updated_at)}.`,
          'success',
        );
      } catch (err) {
        this.showFeedback(
          err instanceof Error ? `Erro ao aprovar: ${err.message}` : `Erro ao aprovar: ${String(err)}`,
          'danger',
        );
      } finally {
        this.actionLoading = false;
      }
    },
    onOpenReturnModal() {
      // v5.22.23: log visível em produção (sem eslint-disable) para
      // facilitar diagnóstico do usuário caso o modal não apareça.
      // Se este log NÃO aparece no console ao clicar Devolver, o
      // problema é no botão/listener. Se aparece mas modal não
      // surge, o problema é CSS/Teleport.
      console.info(
        '[ReviewView] Abrindo modal de devolução. returnModalOpen antes:',
        this.returnModalOpen,
      );
      this.returnModalOpen = true;
      this.returnError = '';
    },
    onCancelReturnModal() {
      this.returnModalOpen = false;
    },
    /**
     * v5.22.11: confirm vem do ReturnSubmissionModal que emite
     * `{ body: string }`. O `reviewer` é sincronizado via `:reviewer`
     * prop + `@update-reviewer` evento, então usamos `this.reviewer`
     * direto. Antes (v5.22.9) eu tinha escrito errado esperando
     * `{ reviewer, comment }`, causando submit silencioso com `undefined`.
     */
    async onConfirmReturn(payload: { body: string }) {
      if (this.returnLoading) return;
      // Frontend já valida ≥20 chars; defesa em profundidade
      if (!payload.body || payload.body.trim().length < 20) {
        this.returnError = 'Comentário precisa ter pelo menos 20 caracteres.';
        return;
      }
      if (!this.reviewer || !this.reviewer.trim()) {
        this.returnError = 'Informe seu nome como revisor antes de devolver.';
        return;
      }
      this.returnLoading = true;
      this.returnError = '';
      try {
        if (this.saveTimer) {
          clearTimeout(this.saveTimer);
          await this.flushSave();
        }
        const r = await returnSubmissionWithComment({
          token: this.token,
          reviewer: this.reviewer,
          body: payload.body,
        });
        this.returnModalOpen = false;
        await this.load();
        // v5.22.11: feedback explícito com info de email
        const recipients = (r.email_sent_to || []).filter(Boolean);
        const emailNote = r.email_status ? 'E-mail: '+emailStatusLabel(r.email_status)+'. Acompanhe na aba E-mails.' : recipients.length > 0
          ? `Email enviado para: ${recipients.join(', ')}.`
          : r.email_error
            ? `Email não foi enviado (${r.email_error}). Avise o responsável manualmente.`
            : 'Email não foi enviado (destinatário não cadastrado).';
        this.showFeedback(
          `Chamado ${r.ticket_number} devolvido para o responsável. ${emailNote}`,
          'success',
        );
      } catch (err) {
        this.returnError = err instanceof Error ? err.message : String(err);
      } finally {
        this.returnLoading = false;
      }
    },
    /**
     * v5.22.11: registra mensagem de feedback persistente no topo
     * da página. Auto-dismiss em 12s para success; permanente para danger.
     */
    showFeedback(message: string, type: 'success' | 'danger' | 'info' = 'info') {
      this.actionFeedback = message;
      this.actionFeedbackClass = type;
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
      if (type === 'success') {
        this.feedbackTimer = setTimeout(() => {
          this.actionFeedback = '';
        }, 12000);
      }
    },
    dismissFeedback() {
      this.actionFeedback = '';
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    },
    // ===== Comments (Etapa 10) =====
    async onAddComment(payload: { author: string; body: string; internal_only: boolean }) {
      if (this.commentLoading) return;
      this.commentLoading = true;
      this.commentFeedback = '';
      try {
        const inserted = await addReviewComment({
          token: this.token,
          author: payload.author,
          body: payload.body,
          internalOnly: payload.internal_only,
        });
        this.comments.push(inserted);
        this.commentFeedback = 'Mensagem registrada.';
        this.commentFeedbackClass = 'success';
      } catch (err) {
        this.commentFeedback = err instanceof Error ? err.message : String(err);
        this.commentFeedbackClass = 'danger';
      } finally {
        this.commentLoading = false;
      }
    },
  },
});
</script>

<style scoped>
.client-msg {
  border-left: 4px solid var(--brand-magenta);
  padding: 8px 12px;
  margin: 8px 0;
  background: var(--surface-raised);
  border-radius: 4px;
  font-style: italic;
}
/* v5.22.9: cards de contagem na Etapa 8 viram botões clicáveis para navegar */
.nav-card-button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  text-align: left;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-left: 4px solid var(--brand-magenta);
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.nav-card-button strong {
  font-size: 28px;
  line-height: 1;
  font-family: var(--font-mono);
  color: var(--brand-magenta);
}
.nav-card-button small {
  font-size: 11px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: .08em;
  margin-top: 2px;
}
.nav-card-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(197, 17, 126, 0.15);
  border-left-color: var(--brand-navy);
}
.nav-card-button:focus-visible {
  outline: 2px solid var(--brand-magenta);
  outline-offset: 2px;
}
</style>
