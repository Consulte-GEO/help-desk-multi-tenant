<template>
  <!-- =================================================================
       MODO 1: read-only (status != devolvido) — preserva UX da v5.22
       MODO 2: editável (status == devolvido) — abre wizard 1-7 com
               dados pré-carregados; cliente edita e clica "Reenviar"
       ================================================================= -->

  <!-- ===== MODO 1: read-only ===== -->
  <div v-if="!editable" class="app-shell" :data-theme="theme">
    <main class="main">
      <header class="topbar">
        <div>
          <div class="kicker">Status do chamado</div>
          <h1 style="margin: 4px 0 0">{{ heading }}</h1>
        </div>
        <div class="top-actions">
          <button type="button" class="btn sm" @click="toggleTheme">
            {{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}
          </button>
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
              Se o link foi encaminhado de um e-mail antigo, talvez ele
              tenha expirado. Verifique o e-mail original ou contate
              a equipe Consulte GEO.
            </p>
          </div>
        </div>

        <template v-else-if="payload">
          <!-- Cabeçalho -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="kicker">Chamado</div>
                <h2 class="card-title" style="font-family: var(--font-mono); letter-spacing: .04em">
                  {{ payload.ticket.ticket_number }}
                </h2>
                <p class="card-description">
                  Status atual:
                  <span class="badge" :class="statusBadgeClass(payload.submission.status)">
                    {{ statusLabel(payload.submission.status) }}
                  </span>
                </p>
              </div>
            </div>
            <div class="card-body grid grid-2">
              <div>
                <div class="kicker">Obra</div>
                <p><strong>{{ payload.submission.obra_nome || '(sem nome)' }}</strong></p>
                <div v-if="payload.submission.obra_codigo" class="kicker" style="margin-top: 8px">Código</div>
                <p v-if="payload.submission.obra_codigo">{{ payload.submission.obra_codigo }}</p>
                <div v-if="payload.submission.obra_endereco" class="kicker" style="margin-top: 8px">Endereço</div>
                <p v-if="payload.submission.obra_endereco">{{ payload.submission.obra_endereco }}</p>
              </div>
              <div>
                <div class="kicker">Resumo técnico</div>
                <ul style="margin: 4px 0 0; padding-left: 20px">
                  <li>{{ payload.submission.count_estruturas }} estrutura(s)</li>
                  <li>{{ payload.submission.count_pecas }} peças/pavimentos</li>
                  <li>{{ payload.submission.count_concretos }} concreto(s)</li>
                </ul>
                <div class="kicker" style="margin-top: 12px">Recebido em</div>
                <p>{{ submittedAtBR }}</p>
                <template v-if="payload.submission.reviewed_at">
                  <div class="kicker" style="margin-top: 8px">Última revisão</div>
                  <p>{{ reviewedAtBR }}</p>
                </template>
              </div>
            </div>
          </div>

          <!-- Mensagens -->
          <div class="card" style="margin-top: 16px">
            <div class="card-header">
              <div>
                <h3 class="card-title">Mensagens com a equipe</h3>
                <p class="card-description">
                  {{ payload.comments.length }} mensagem(ns). Apenas mensagens públicas aparecem aqui.
                </p>
              </div>
            </div>
            <div class="card-body grid">
              <div v-if="payload.comments.length === 0" class="empty" style="padding: 16px">
                Nenhuma mensagem trocada ainda.
              </div>

              <div
                v-for="c in payload.comments"
                :key="c.id"
                class="comment"
              >
                <div class="comment-meta">
                  <strong>{{ c.author || '(sem nome)' }}</strong>
                  <span
                    v-if="c.author_role === 'cliente'"
                    class="badge info"
                    style="margin-left: 8px; font-size: 10px"
                  >Você</span>
                  <span
                    v-else
                    class="badge" :class="statusBadgeClass('em_validacao')"
                    style="margin-left: 8px; font-size: 10px"
                  >Equipe</span>
                  · {{ formatDateBR(c.created_at) }}
                </div>
                <div class="comment-body">{{ c.body }}</div>
              </div>

              <div class="divider"></div>

              <div class="field">
                <label for="newClientComment">Nova mensagem</label>
                <textarea
                  id="newClientComment"
                  class="textarea"
                  rows="3"
                  maxlength="2000"
                  v-model="newCommentBody"
                  placeholder="Escreva uma dúvida ou observação para a equipe Consulte GEO."
                  :disabled="commentLoading"
                ></textarea>
                <div class="hint">{{ newCommentBody.length }}/2000 caracteres</div>
              </div>
              <div v-if="commentFeedback" class="alert" :class="commentFeedbackClass">
                <span>{{ commentFeedback }}</span>
              </div>
              <div class="toolbar">
                <button
                  type="button"
                  class="btn brand"
                  :disabled="commentLoading || !newCommentBody.trim()"
                  @click="onAddClientComment"
                >
                  {{ commentLoading ? 'Enviando...' : 'Enviar mensagem' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </section>
    </main>
  </div>

  <!-- ===== MODO 2: editável (status == devolvido) ===== -->
  <AppShell
    v-else
    :current-step="currentEditStep"
    :steps="editSteps"
    :page-title="editPageTitle"
    :save-state="editSaveState"
    :theme="theme"
    :loading="resubmitLoading"
    @navigate="onEditNavigate"
    @load-example-projetista="noop"
    @toggle-theme="toggleTheme"
    @reset="noop"
    @back="onEditBack"
    @save="noop"
    @next="onEditNext"
  >
    <!-- Banner explicativo no topo de TODAS as etapas editáveis -->
    <div class="alert warning" style="margin-bottom: 16px">
      <strong>Chamado {{ payload?.ticket.ticket_number }} foi devolvido pela equipe Consulte GEO.</strong>
      <span>
        Edite os campos conforme o comentário da equipe e clique em
        "Reenviar para validação" na última etapa.
      </span>
    </div>

    <!-- Comentário da equipe destacado -->
    <div v-if="lastTeamComment" class="card" style="margin-bottom: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Comentário da equipe</h3>
        </div>
      </div>
      <div class="card-body">
        <div class="kicker">{{ lastTeamComment.author }} · {{ formatDateBR(lastTeamComment.created_at) }}</div>
        <blockquote class="client-msg">{{ lastTeamComment.body }}</blockquote>
      </div>
    </div>

    <!-- v5.22.11: Wizard editável (1-7) — Etapa 2 (Tipo de estrutura) removida.
         Modelo de Preenchimento agora vem mergeado no topo do Step3GruposEditor
         (que é Etapa 2 na nova numeração). -->
    <Step1DadosBasicos
      v-if="currentEditStep === 1"
      :metadata="editSnap.metadata"
      :total-steps="7"
      @update-field="onSnapField"
    />
    <Step3GruposEditor
      v-else-if="currentEditStep === 2"
      :grupos="editSnap.grupos"
      :modelo-preenchimento="editSnap.metadata.modeloPreenchimento"
      :is-modelo-projeto="editSnap.metadata.modeloPreenchimento === 'modelo_projeto'"
      :total-steps="7"
      @add-grupo="onAddGrupo"
      @remove-grupo="onRemoveGrupo"
      @update-grupo="onUpdateGrupo"
    />
    <Step4Concretos
      v-else-if="currentEditStep === 3"
      :concretos="editSnap.concretos"
      :total-steps="7"
      @add-concreto="onAddConcreto"
      @remove-concreto="onRemoveConcreto"
      @update-concreto="onUpdateConcreto"
      @suggest-defaults="onSuggestConcretosDefault"
    />
    <Step5PecasEditor
      v-else-if="currentEditStep === 4"
      :grupos="editSnap.grupos"
      :concretos="editSnap.concretos"
      :total-steps="7"
      @add-peca="onAddPeca"
      @remove-peca="onRemovePeca"
      @update-peca="onUpdatePeca"
      @bulk-add="onBulkAdd"
      @copy-pecas="onCopyPecas"
    />
    <Step6UsuariosObra
      v-else-if="currentEditStep === 5"
      :usuarios="editSnap.usuariosObra"
      :total-steps="7"
      @add-usuario="onAddUsuario"
      @remove-usuario="onRemoveUsuario"
      @update-usuario="onUpdateUsuario"
    />
    <Step7Fornecedores
      v-else-if="currentEditStep === 6"
      :fornecedores="editSnap.fornecedores"
      :total-steps="7"
      @add-fornecedor="onAddFornecedor"
      @remove-fornecedor="onRemoveFornecedor"
      @update-fornecedor="onUpdateFornecedor"
      @add-fornecedor-email="onAddFornecedorEmail"
      @update-fornecedor-email="onUpdateFornecedorEmail"
      @remove-fornecedor-email="onRemoveFornecedorEmail"
    />
    <div v-else-if="currentEditStep === 7">
      <div class="kicker">Etapa 7 de 7</div>
      <h2 style="margin: 4px 0 4px">Revisão e reenvio</h2>
      <p class="card-description">
        Confira os ajustes e clique no botão abaixo para reenviar o chamado
        para a equipe Consulte GEO.
      </p>

      <div class="card" style="margin-top: 16px">
        <div class="card-header">
          <div><h3 class="card-title">Resumo</h3></div>
        </div>
        <div class="card-body grid grid-3">
          <div class="alert info">
            <strong>{{ editSnap.grupos.length }}</strong>
            <span>grupos/estruturas</span>
          </div>
          <div class="alert info">
            <strong>{{ pecaCount }}</strong>
            <span>peças/pavimentos</span>
          </div>
          <div class="alert info">
            <strong>{{ editSnap.usuariosObra.length }}</strong>
            <span>usuários da obra</span>
          </div>
          <div class="alert info">
            <strong>{{ editSnap.fornecedores.length }}</strong>
            <span>fornecedores</span>
          </div>
        </div>
      </div>

      <div v-if="resubmitFeedback" class="alert" :class="resubmitFeedbackClass" style="margin-top: 16px">
        <span>{{ resubmitFeedback }}</span>
      </div>

      <div class="toolbar" style="margin-top: 16px; justify-content: flex-end">
        <button
          type="button"
          class="btn brand"
          :disabled="resubmitLoading"
          @click="onResubmit"
        >
          {{ resubmitLoading ? 'Reenviando...' : 'Reenviar para validação' }}
        </button>
      </div>
    </div>

    <template #top-actions-extra>
      <template v-if="currentEditStep === 7">
        <button
          type="button"
          class="btn sm brand"
          :disabled="resubmitLoading"
          @click="onResubmit"
        >
          {{ resubmitLoading ? 'Reenviando...' : 'Reenviar para validação' }}
        </button>
      </template>
    </template>
  </AppShell>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import {
  loadClientStatus,
  addClientComment,
  updateTechnicalJsonByClientToken,
  resubmitByClientToken,
} from '../services/ticketService';
import type {
  ClientStatusPayload,
  ReviewComment,
  SetupSnapshot,
  TechnicalJsonForResubmit,
  UsuarioObra,
  Fornecedor,
} from '../models/setup.models';
import {
  WIZARD_STEPS,
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

export default defineComponent({
  name: 'ClientStatusView',
  components: {
    AppShell,
    Step1DadosBasicos,
    Step3GruposEditor,
    Step4Concretos,
    Step5PecasEditor,
    Step6UsuariosObra,
    Step7Fornecedores,
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
      payload: null as ClientStatusPayload | null,
      // Modo read-only: novo comment
      newCommentBody: '',
      commentLoading: false,
      commentFeedback: '',
      commentFeedbackClass: 'info' as string,
      // Modo editável: snapshot reconstruído + wizard interno
      editSnap: defaultSnapshot() as SetupSnapshot,
      currentEditStep: 1 as number,
      editSaveState: 'Edição local — não enviada ainda',
      editSteps: WIZARD_STEPS,
      resubmitLoading: false,
      resubmitFeedback: '',
      resubmitFeedbackClass: 'info' as string,
    };
  },
  computed: {
    editable(): boolean {
      return this.payload?.submission?.editable === true;
    },
    heading(): string {
      if (this.loading) return 'Carregando...';
      if (this.error) return 'Link inválido';
      return this.payload?.submission?.obra_nome || 'Chamado';
    },
    editPageTitle(): string {
      const w = WIZARD_STEPS.find((s) => s.id === this.currentEditStep);
      return w?.title ?? 'Editar chamado devolvido';
    },
    submittedAtBR(): string {
      return this.formatDateBR(this.payload?.submission?.submitted_at ?? '');
    },
    reviewedAtBR(): string {
      return this.formatDateBR(this.payload?.submission?.reviewed_at ?? '');
    },
    lastTeamComment(): ReviewComment | null {
      const list = this.payload?.comments ?? [];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].author_role !== 'cliente') return list[i];
      }
      return null;
    },
    pecaCount(): number {
      return this.editSnap.grupos.reduce((sum, g) => sum + g.pecas.length, 0);
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    noop() { /* placeholder pra eventos do AppShell que não usamos no modo edit */ },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
    },
    formatDateBR(iso: string): string {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      } catch { return iso; }
    },
    statusBadgeClass(s: string): string {
      if (['aprovado', 'implantado'].includes(s)) return 'success';
      if (s === 'devolvido') return 'warning';
      if (s === 'cancelado') return 'danger';
      return 'info';
    },
    statusLabel(s: string): string {
      const m: Record<string, string> = {
        enviado: 'Recebido',
        em_validacao: 'Em validação',
        devolvido: 'Aguardando seu ajuste',
        aprovado: 'Aprovado',
        implantado: 'Implantado',
        cancelado: 'Cancelado',
      };
      return m[s] ?? s;
    },
    async load() {
      this.loading = true;
      this.error = false;
      try {
        this.payload = await loadClientStatus(this.token);
        if (this.editable && this.payload.submission.technical_json) {
          this.hydrateEditSnap(this.payload.submission.technical_json);
        }
      } catch (err) {
        this.error = true;
        this.errorMessage = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
    /**
     * v5.22.6: reconstrói o snapshot editável a partir do technical_json
     * que vem da RPC. Tentamos preservar customerInput, mas se o JSON
     * estiver em formato técnico (technicalMapping), reconstruímos só
     * o que conseguimos — campos faltantes ficam com defaults.
     */
    hydrateEditSnap(tj: TechnicalJsonForResubmit) {
      const snap = defaultSnapshot();
      // 1. customerInput é a forma "raw" do snapshot (preferida)
      const ci = tj.customerInput as Record<string, unknown> | undefined;
      if (ci) {
        if (ci.dadosBasicos) {
          snap.metadata = { ...snap.metadata, ...(ci.dadosBasicos as Record<string, unknown>) };
        }
        if (Array.isArray(ci.usuariosObra)) {
          snap.usuariosObra = ci.usuariosObra as UsuarioObra[];
        }
        // v5.22.7: fornecedores também
        if (Array.isArray(ci.fornecedores)) {
          snap.fornecedores = ci.fornecedores as Fornecedor[];
        }
        if (Array.isArray(ci.grupos)) {
          // mantém estrutura nativa
          snap.grupos = ci.grupos as SetupSnapshot['grupos'];
        }
        if (Array.isArray(ci.concretos)) {
          snap.concretos = ci.concretos as SetupSnapshot['concretos'];
        }
        if (typeof ci.tipoEstrutura === 'string') {
          snap.tipoEstrutura = ci.tipoEstrutura as SetupSnapshot['tipoEstrutura'];
        }
      }
      this.editSnap = snap;
    },
    // ===== Modo read-only =====
    async onAddClientComment() {
      const body = this.newCommentBody.trim();
      if (!body) return;
      this.commentLoading = true;
      this.commentFeedback = '';
      try {
        const inserted = await addClientComment({
          token: this.token,
          author: this.payload?.submission?.responsavel_nome || '',
          body,
        });
        this.payload?.comments.push(inserted);
        this.newCommentBody = '';
        this.commentFeedback = 'Mensagem enviada à equipe.';
        this.commentFeedbackClass = 'success';
      } catch (err) {
        this.commentFeedback = err instanceof Error ? err.message : String(err);
        this.commentFeedbackClass = 'danger';
      } finally {
        this.commentLoading = false;
      }
    },
    // ===== Modo editável: navegação =====
    onEditNavigate(s: number) {
      this.currentEditStep = Math.max(1, Math.min(7, s));
    },
    onEditBack() {
      if (this.currentEditStep > 1) this.currentEditStep--;
    },
    onEditNext() {
      if (this.currentEditStep < 7) this.currentEditStep++;
      else this.onResubmit();
    },
    // ===== Modo editável: mutações simples no editSnap =====
    onSnapField(p: { field: string; value: unknown }) {
      (this.editSnap.metadata as unknown as Record<string, unknown>)[p.field] = p.value;
    },
    onUpdateTipo(t: SetupSnapshot['tipoEstrutura']) {
      this.editSnap.tipoEstrutura = t;
    },
    // v5.22.47: onUpdateModelo removido — listener morto desde a
    // v5.22.18 (Step3 não emite mais 'change-modelo').
    onAddGrupo() {
      this.editSnap.grupos.push(novoGrupo());
    },
    onRemoveGrupo(id: string) {
      const i = this.editSnap.grupos.findIndex((g) => g.id === id);
      if (i >= 0) this.editSnap.grupos.splice(i, 1);
    },
    onUpdateGrupo(p: { id: string; field: string; value: unknown }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.id);
      if (!g) return;
      (g as unknown as Record<string, unknown>)[p.field] = p.value;
    },
    onAddConcreto() {
      this.editSnap.concretos.push(novoConcreto());
    },
    onRemoveConcreto(id: string) {
      const i = this.editSnap.concretos.findIndex((c) => c.id === id);
      if (i >= 0) this.editSnap.concretos.splice(i, 1);
    },
    onUpdateConcreto(p: { id: string; field: string; value: unknown }) {
      const c = this.editSnap.concretos.find((x) => x.id === p.id);
      if (!c) return;
      (c as unknown as Record<string, unknown>)[p.field] = p.value;
    },
    /** v5.22.10: cliente em modo edit pode sugerir traços padrão. */
    onSuggestConcretosDefault() {
      if (this.editSnap.concretos.length > 0) return;
      this.editSnap.concretos = concretosPadrao();
    },
    onAddPeca(p: { grupoId: string }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      g.pecas.push(novaPeca());
    },
    onRemovePeca(p: { grupoId: string; pecaId: string }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      const i = g.pecas.findIndex((pe) => pe.id === p.pecaId);
      if (i >= 0) g.pecas.splice(i, 1);
    },
    onUpdatePeca(p: { grupoId: string; pecaId: string; field: string; value: unknown }) {
      const g = this.editSnap.grupos.find((x) => x.id === p.grupoId);
      if (!g) return;
      const pe = g.pecas.find((x) => x.id === p.pecaId);
      if (!pe) return;
      (pe as unknown as Record<string, unknown>)[p.field] = p.value;
    },
    onBulkAdd() { /* simplificado no modo edit: usuário usa Add peça individual */ },
    onCopyPecas() { /* idem */ },
    onAddUsuario() {
      this.editSnap.usuariosObra.push(novoUsuarioObra());
    },
    onRemoveUsuario(id: string) {
      const i = this.editSnap.usuariosObra.findIndex((u) => u.id === id);
      if (i >= 0) this.editSnap.usuariosObra.splice(i, 1);
    },
    onUpdateUsuario(p: { id: string; field: keyof UsuarioObra; value: string }) {
      const u = this.editSnap.usuariosObra.find((x) => x.id === p.id);
      if (!u) return;
      (u as unknown as Record<string, string>)[p.field] = p.value;
    },
    // ===== v5.22.7: handlers de Fornecedor (modo editável) =====
    // v5.22.22: aceita tipo do botão clicado (usina/laboratorio).
    onAddFornecedor(tipo: 'usina' | 'laboratorio' = 'usina') {
      this.editSnap.fornecedores.push(novoFornecedor(tipo));
    },
    onRemoveFornecedor(id: string) {
      const i = this.editSnap.fornecedores.findIndex((f) => f.id === id);
      if (i >= 0) this.editSnap.fornecedores.splice(i, 1);
    },
    onUpdateFornecedor(p: { id: string; field: keyof Fornecedor; value: unknown }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      (f as unknown as Record<string, unknown>)[p.field] = p.value;
    },
    onAddFornecedorEmail(id: string) {
      const f = this.editSnap.fornecedores.find((x) => x.id === id);
      if (!f) return;
      if (f.emailsProgramacao.length >= 3) return;
      f.emailsProgramacao.push('');
    },
    onUpdateFornecedorEmail(p: { id: string; index: number; value: string }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      if (p.index < 0 || p.index >= f.emailsProgramacao.length) return;
      f.emailsProgramacao[p.index] = p.value;
    },
    onRemoveFornecedorEmail(p: { id: string; index: number }) {
      const f = this.editSnap.fornecedores.find((x) => x.id === p.id);
      if (!f) return;
      if (f.emailsProgramacao.length <= 1) {
        f.emailsProgramacao[0] = '';
      } else {
        f.emailsProgramacao.splice(p.index, 1);
      }
    },
    // ===== Reenvio =====
    async onResubmit() {
      if (this.resubmitLoading) return;
      this.resubmitLoading = true;
      this.resubmitFeedback = '';
      try {
        // 1. Atualiza technical_json com o estado editado
        const tj = this.buildTechnicalJsonFromEditSnap();
        await updateTechnicalJsonByClientToken(this.token, tj);
        // 2. Muda status para em_validacao
        const r = await resubmitByClientToken(this.token);
        this.resubmitFeedback = `Reenviado com sucesso · ${r.ticket_number}`;
        this.resubmitFeedbackClass = 'success';
        // 3. Recarrega payload (sai do modo editable)
        await this.load();
      } catch (err) {
        this.resubmitFeedback = err instanceof Error ? err.message : String(err);
        this.resubmitFeedbackClass = 'danger';
      } finally {
        this.resubmitLoading = false;
      }
    },
    /**
     * Reconstrói o technical_json preservando o original e sobrescrevendo
     * só os campos que o cliente editou. Não roda o validador completo
     * aqui — a equipe Consulte GEO valida na próxima revisão.
     */
    buildTechnicalJsonFromEditSnap(): TechnicalJsonForResubmit {
      const original = this.payload?.submission?.technical_json ?? {};
      return {
        ...original,
        customerInput: {
          ...(original.customerInput ?? {}),
          dadosBasicos: { ...this.editSnap.metadata },
          tipoEstrutura: this.editSnap.tipoEstrutura,
          grupos: this.editSnap.grupos,
          concretos: this.editSnap.concretos,
          usuariosObra: this.editSnap.usuariosObra,
          // v5.22.7: fornecedores
          fornecedores: this.editSnap.fornecedores,
        },
        metadata: {
          ...(original.metadata ?? {}),
          resubmittedAt: new Date().toISOString(),
        },
      };
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
.toolbar { display: flex; gap: 8px; }
</style>
