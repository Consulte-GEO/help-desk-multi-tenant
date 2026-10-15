<template>
  <!--
    v5.22.28 — Dashboard do painel de gestão.

    Estrutura:
      - Header com nome do admin + logout
      - 4 cards de stats no topo (total / semana / por status / locked)
      - Filtros: search, kind, status, priority, período
      - Tabela com listing ordenado por updated_at desc
      - Drill-down do item selecionado (notas, prioridade, lock)

    Acessibilidade: tabela com <th scope=col>, aria-live no contador
    de resultados, focus visível em todos os interativos.
  -->
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-brand">
        <strong>Implantação Consulte GEO</strong>
        <span class="muted">· Painel de gestão</span>
      </div>
      <div class="admin-user">
        <router-link to="/admin/processos" class="btn sm">Processos de importação</router-link>
        <!-- v5.22.36 — link para configurar ajuda das etapas -->
        <router-link to="/admin/ajuda" class="btn sm" title="Configurar vídeos e imagens de ajuda por etapa">
          Ajuda das etapas
        </router-link>
        <!-- v5.22.29 — botão de export para Excel -->
        <button
          class="btn sm"
          :disabled="exporting || items.length === 0"
          :title="items.length === 0 ? 'Sem itens para exportar' : 'Exportar listing atual + notas + histórico'"
          @click="onExportExcel"
        >
          {{ exporting ? 'Exportando...' : '⬇ Excel' }}
        </button>
        <span class="muted">{{ currentUserName }}</span>
        <button class="btn sm" @click="onLogout">Sair</button>
      </div>
    </header>

    <main class="admin-main">
      <!-- ============================= Stats -->
      <section class="admin-stats" aria-label="Estatísticas">
        <div class="stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Esta semana</div>
          <div class="stat-value">{{ stats.thisWeek }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Em análise</div>
          <div class="stat-value">{{ stats.locked }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Urgente + Alta</div>
          <div class="stat-value">
            {{ (stats.byPriority.urgente || 0) + (stats.byPriority.alta || 0) }}
          </div>
        </div>
      </section>

      <!-- ============================= Filtros -->
      <section class="admin-filters" aria-label="Filtros">
        <input
          class="input"
          type="search"
          v-model="searchTerm"
          placeholder="Buscar por protocolo, obra ou cliente..."
          @input="onFilterChange"
        />
        <select class="input" v-model="filterKind" @change="onFilterChange">
          <option value="">Todos os tipos</option>
          <option value="submission">Submissões</option>
          <option value="ticket">Chamados</option>
        </select>
        <select class="input" v-model="filterStatus" @change="onFilterChange">
          <option value="">Todos status</option>
          <option value="enviado">Enviado</option>
          <option value="em_validacao">Em validação</option>
          <option value="devolvido">Devolvido</option>
          <option value="implantado">Implantado</option>
        </select>
        <select class="input" v-model="filterPriority" @change="onFilterChange">
          <option value="">Toda prioridade</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>

        <!-- v5.22.30 — Filtros novos: período e "meus em análise" -->
        <input
          class="input filter-date"
          type="date"
          v-model="filterFromDate"
          @change="onFilterChange"
          title="Data inicial (atualizado desde)"
          :max="filterToDate || todayIso"
        />
        <input
          class="input filter-date"
          type="date"
          v-model="filterToDate"
          @change="onFilterChange"
          title="Data final (atualizado até)"
          :min="filterFromDate"
          :max="todayIso"
        />

        <label class="filter-toggle" :title="currentUserEmail">
          <input
            type="checkbox"
            v-model="filterMineOnly"
            @change="onFilterChange"
          />
          Meus em análise
        </label>

        <button class="btn sm" @click="onReload" :disabled="loading">
          {{ loading ? 'Carregando...' : 'Atualizar' }}
        </button>
        <button
          class="btn sm"
          @click="onClearFilters"
          :disabled="loading || !hasActiveFilters"
          title="Limpar todos os filtros"
        >
          Limpar
        </button>
      </section>

      <!-- ============================= Listing -->
      <section class="admin-listing" aria-label="Chamados">
        <div class="listing-topbar">
          <p class="muted" role="status" aria-live="polite">
            {{ filteredItems.length }} resultado(s)
          </p>
          <!--
            v5.22.35: barra de ações em lote. Aparece só quando há
            itens selecionados. Permite setar prioridade ou limpar
            seleção de vários itens de uma vez.
          -->
          <div v-if="selectedIds.size > 0" class="bulk-bar" role="region" aria-label="Ações em lote">
            <span class="bulk-count">{{ selectedIds.size }} selecionado(s)</span>
            <select
              class="input bulk-priority"
              v-model="bulkPriority"
              :disabled="bulkBusy"
              aria-label="Prioridade para aplicar em lote"
            >
              <option value="">Definir prioridade…</option>
              <option value="baixa">baixa</option>
              <option value="media">média</option>
              <option value="alta">alta</option>
              <option value="urgente">urgente</option>
            </select>
            <button
              class="btn sm brand"
              :disabled="bulkBusy || !bulkPriority"
              @click="onBulkApplyPriority"
            >
              {{ bulkBusy ? 'Aplicando…' : 'Aplicar' }}
            </button>
            <button class="btn sm" :disabled="bulkBusy" @click="clearSelection">
              Limpar seleção
            </button>
          </div>
        </div>
        <div v-if="loading && items.length === 0" class="empty">
          Carregando...
        </div>
        <div v-else-if="filteredItems.length === 0" class="empty">
          Nenhum item encontrado com os filtros atuais.
        </div>
        <table v-else class="admin-table">
          <thead>
            <tr>
              <th scope="col" class="col-check">
                <input
                  type="checkbox"
                  :checked="allVisibleSelected"
                  :indeterminate.prop="someVisibleSelected"
                  @change="onToggleSelectAll"
                  title="Selecionar todos os visíveis"
                  aria-label="Selecionar todos os visíveis"
                />
              </th>
              <th scope="col">Tipo</th>
              <th scope="col">Identificador</th>
              <th scope="col">Obra</th>
              <th scope="col">Cliente</th>
              <th scope="col">Status</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Em análise</th>
              <th scope="col">Atualizado</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="it in filteredItems"
              :key="it.kind + ':' + it.id"
              :class="rowClasses(it)"
              @click="onSelect(it)"
            >
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedIds.has(rowKey(it))"
                  @change="onToggleRow(it)"
                  :aria-label="`Selecionar ${it.identifier}`"
                />
              </td>
              <td>
                <span class="badge" :class="'badge-' + it.kind">
                  {{ it.kind === 'submission' ? 'Submissão' : 'Chamado' }}
                </span>
              </td>
              <td><code>{{ it.identifier }}</code></td>
              <td>
                <strong>{{ it.title || '(sem nome)' }}</strong>
                <div class="muted small">{{ it.subtitle }}</div>
              </td>
              <td>{{ it.cliente }}</td>
              <td>
                <span class="badge" :class="'badge-status-' + it.status">
                  {{ it.status }}
                </span>
              </td>
              <td>
                <!--
                  v5.22.30 — Quick prioridade direto na linha.
                  Stop propagation no click+change pra não abrir o drill-down
                  por acidente. Default value vem do próprio item.
                -->
                <select
                  class="quick-priority"
                  :value="it.priority || ''"
                  @click.stop
                  @change.stop="onQuickPriorityChange(it, $event)"
                  :title="it.priority ? `Prioridade: ${it.priority}` : 'Definir prioridade'"
                >
                  <option value="">—</option>
                  <option value="baixa">baixa</option>
                  <option value="media">média</option>
                  <option value="alta">alta</option>
                  <option value="urgente">urgente</option>
                </select>
              </td>
              <td>
                <span v-if="it.locked_by" :title="'Lock expira em ' + formatDate(it.lock_expires_at)">
                  🔒 {{ it.locked_by.split('@')[0] }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ formatDate(it.updated_at) }}</td>
              <td>
                <button class="btn sm" @click.stop="onSelect(it)">
                  Ver detalhes
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ============================= Drill-down -->
      <section v-if="selectedItem" class="admin-drilldown" aria-label="Detalhes do item">
        <header class="drilldown-header">
          <h2>
            {{ selectedItem.identifier }} · {{ selectedItem.title }}
          </h2>
          <button class="btn sm" @click="onCloseDetail">Fechar</button>
        </header>

        <div class="drilldown-actions">
          <div class="action-group">
            <label class="action-label">Prioridade:</label>
            <select
              class="input sm"
              :value="selectedItem.priority || ''"
              @change="onPriorityChange($event)"
            >
              <option value="">— sem —</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div v-if="selectedItem.kind === 'submission'" class="action-group">
            <label class="action-label">Análise:</label>
            <button
              v-if="!selectedItem.locked_by"
              class="btn sm"
              @click="onTakeLock"
            >
              🔒 Marcar "em análise por mim"
            </button>
            <button
              v-else-if="selectedItem.locked_by === currentUserEmail"
              class="btn sm"
              @click="onReleaseLock"
            >
              Liberar análise
            </button>
            <span v-else class="muted">
              Em análise por {{ selectedItem.locked_by }}
            </span>
          </div>
        </div>

        <!-- v5.22.29 — Tabs com 3 conteúdos -->
        <div class="drilldown-tabs" role="tablist" aria-label="Detalhes">
          <button
            role="tab"
            :aria-selected="activeTab === 'notes'"
            :class="{ active: activeTab === 'notes' }"
            class="tab-btn"
            @click="activeTab = 'notes'"
          >
            🔒 Notas internas ({{ notes.length }})
          </button>
          <button
            role="tab"
            :aria-selected="activeTab === 'comments'"
            :class="{ active: activeTab === 'comments' }"
            class="tab-btn"
            @click="activeTab = 'comments'"
          >
            💬 Comentários ao cliente ({{ publicComments.length }})
          </button>
          <button
            role="tab"
            :aria-selected="activeTab === 'history'"
            :class="{ active: activeTab === 'history' }"
            class="tab-btn"
            @click="activeTab = 'history'"
          >
            🕓 Histórico ({{ auditEvents.length }})
          </button>
        </div>

        <!-- TAB: Notas internas -->
        <div v-show="activeTab === 'notes'" class="drilldown-tab-content">
          <p class="muted small">
            Visível apenas para a equipe Consulte GEO. Não vai para o cliente.
          </p>
          <form @submit.prevent="onAddNote" class="note-form">
            <textarea
              class="textarea"
              rows="3"
              v-model="newNoteBody"
              placeholder="Anotação interna..."
              maxlength="5000"
              :disabled="savingNote"
            ></textarea>
            <button
              type="submit"
              class="btn sm brand"
              :disabled="!newNoteBody.trim() || savingNote"
            >
              {{ savingNote ? 'Salvando...' : 'Adicionar nota' }}
            </button>
          </form>
          <ul class="note-list">
            <li v-for="n in notes" :key="n.id">
              <div class="note-meta">
                <strong>{{ n.created_by_email.split('@')[0] }}</strong>
                <span class="muted small">{{ formatDate(n.created_at) }}</span>
                <button
                  v-if="n.created_by_email === currentUserEmail"
                  class="btn-link"
                  @click="onDeleteNote(n.id)"
                  title="Apagar nota"
                >
                  apagar
                </button>
              </div>
              <div class="note-body">{{ n.body }}</div>
            </li>
            <li v-if="notes.length === 0" class="muted">
              Nenhuma nota ainda.
            </li>
          </ul>
        </div>

        <!-- TAB: Comentários visíveis ao cliente -->
        <div v-show="activeTab === 'comments'" class="drilldown-tab-content">
          <p class="muted small">
            <strong>Atenção:</strong> esses comentários aparecem para o
            cliente no link de acompanhamento. Use linguagem clara e
            profissional.
          </p>
          <form @submit.prevent="onAddPublicComment" class="note-form">
            <textarea
              class="textarea"
              rows="3"
              v-model="newCommentBody"
              placeholder="Mensagem para o cliente..."
              maxlength="5000"
              :disabled="savingComment || !selectedSubmissionId"
            ></textarea>
            <button
              type="submit"
              class="btn sm warning"
              :disabled="!newCommentBody.trim() || savingComment || !selectedSubmissionId"
            >
              {{ savingComment ? 'Enviando...' : 'Enviar para o cliente' }}
            </button>
          </form>
          <p v-if="!selectedSubmissionId" class="alert info">
            Carregando dados do chamado...
          </p>
          <ul class="note-list">
            <li v-for="c in publicComments" :key="c.id" class="public-comment">
              <div class="note-meta">
                <strong>{{ c.author || 'Equipe Consulte GEO' }}</strong>
                <span class="muted small">{{ formatDate(c.created_at) }}</span>
                <span
                  v-if="isAdminAuthor(c.author)"
                  class="badge badge-admin-author"
                  title="Comentário do painel admin"
                >via painel</span>
              </div>
              <div class="note-body">{{ c.body }}</div>
            </li>
            <li v-if="publicComments.length === 0" class="muted">
              Nenhum comentário ainda.
            </li>
          </ul>
        </div>

        <!-- TAB: Histórico -->
        <div v-show="activeTab === 'history'" class="drilldown-tab-content">
          <p class="muted small">
            Eventos de auditoria registrados pelo sistema e pelo painel
            admin. Mais recentes primeiro.
          </p>
          <ul v-if="auditEvents.length > 0" class="audit-timeline">
            <li v-for="e in auditEvents" :key="e.id" class="audit-event">
              <div class="audit-event-meta">
                <span class="audit-time">{{ formatDate(e.timestamp) }}</span>
                <span class="audit-actor">{{ e.actor || 'sistema' }}</span>
                <span class="badge badge-source" :class="'badge-source-' + e.source">
                  {{ e.source }}
                </span>
              </div>
              <div class="audit-event-action">
                <strong>{{ e.action }}</strong>
                <span class="muted small">em {{ e.entity }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="muted">Sem histórico registrado.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import {
  listDashboardItems,
  computeStats,
  listNotes,
  addNote,
  softDeleteNote,
  takeLock,
  releaseLock,
  setPriority,
  clearPriority,
  // v5.22.29
  listAuditEventsBySubmission,
  listAuditEventsByTicket,
  listReviewCommentsBySubmission,
  addReviewCommentAsAdmin,
  type DashboardItem,
  type DashboardFilters,
  type DashboardStats,
  type AdminNote,
  type AuditEvent,
  type ReviewComment,
} from '../services/adminQueriesService';
import { getCurrentUser, signOut } from '../services/authService';
// v5.22.29 — export Excel
import { exportDashboardToExcel } from '../services/adminExportService';
import { getSupabaseAsync } from '../services/supabaseClient';

type AdminTab = 'notes' | 'comments' | 'history';

export default defineComponent({
  name: 'AdminDashboardView',
  data() {
    return {
      items: [] as DashboardItem[],
      stats: {
        total: 0,
        byStatus: {} as Record<string, number>,
        byKind: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        thisWeek: 0,
        locked: 0,
      } as DashboardStats,
      loading: false,
      searchTerm: '',
      filterKind: '',
      filterStatus: '',
      filterPriority: '',
      // v5.22.30 — filtros novos
      filterFromDate: '',
      filterToDate: '',
      filterMineOnly: false,
      selectedItem: null as DashboardItem | null,
      notes: [] as AdminNote[],
      newNoteBody: '',
      savingNote: false,
      reloadTimer: null as ReturnType<typeof setTimeout> | null,
      // v5.22.35 — seleção em lote
      selectedIds: new Set<string>(),
      bulkPriority: '' as '' | 'baixa' | 'media' | 'alta' | 'urgente',
      bulkBusy: false,
      // v5.22.29 — novos estados
      activeTab: 'notes' as AdminTab,
      auditEvents: [] as AuditEvent[],
      publicComments: [] as ReviewComment[],
      newCommentBody: '',
      savingComment: false,
      exporting: false,
      /**
       * Para tickets, o submission_id é resolvido async (ticket.submission_id
       * vem de outra tabela). Mantemos em cache local até trocar de item.
       * Para submissions, é o próprio item.id.
       */
      selectedSubmissionId: '' as string,
    };
  },
  computed: {
    currentUserName(): string {
      return getCurrentUser()?.displayName || '';
    },
    currentUserEmail(): string {
      return getCurrentUser()?.email || '';
    },
    selectedItemKey(): string {
      return this.selectedItem
        ? `${this.selectedItem.kind}:${this.selectedItem.id}`
        : '';
    },
    /**
     * Filtragem client-side por search (a query SQL já cobre as
     * outras dimensões). Mantém em sync com `filteredItems` para o
     * v-for da tabela.
     *
     * v5.22.30 — filtro "meus em análise" é client-side: o lock é
     * uma faceta independente da query principal.
     */
    filteredItems(): DashboardItem[] {
      let result = [...this.items];

      if (this.filterMineOnly) {
        const email = this.currentUserEmail.toLowerCase();
        result = result.filter(
          (it) => (it.locked_by || '').toLowerCase() === email,
        );
      }

      return result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    /**
     * v5.22.30 — ISO da data de hoje no formato YYYY-MM-DD para
     * input[type=date].max. Evita escolher datas futuras (sem sentido
     * para "atualizado até").
     */
    todayIso(): string {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },
    hasActiveFilters(): boolean {
      return !!(
        this.searchTerm.trim() ||
        this.filterKind ||
        this.filterStatus ||
        this.filterPriority ||
        this.filterFromDate ||
        this.filterToDate ||
        this.filterMineOnly
      );
    },
    /**
     * v5.22.35: true quando TODOS os itens visíveis estão selecionados.
     * Controla o checkbox "select all" do header.
     */
    allVisibleSelected(): boolean {
      const visible = this.filteredItems;
      if (visible.length === 0) return false;
      return visible.every((it) => this.selectedIds.has(this.rowKey(it)));
    },
    /**
     * v5.22.35: true quando ALGUNS (mas não todos) visíveis estão
     * selecionados. Controla o estado "indeterminate" do checkbox
     * select-all (traço em vez de check).
     */
    someVisibleSelected(): boolean {
      const visible = this.filteredItems;
      const selectedCount = visible.filter((it) =>
        this.selectedIds.has(this.rowKey(it)),
      ).length;
      return selectedCount > 0 && selectedCount < visible.length;
    },
  },
  async mounted() {
    await this.reload();
  },
  beforeUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  },
  methods: {
    async reload() {
      this.loading = true;
      try {
        const filters: DashboardFilters = {};
        if (this.filterKind) filters.kind = this.filterKind as 'submission' | 'ticket';
        if (this.filterStatus) filters.status = [this.filterStatus];
        if (this.filterPriority) filters.priority = [this.filterPriority];
        if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();
        // v5.22.30 — período no SQL (gte/lte updated_at)
        if (this.filterFromDate) {
          // YYYY-MM-DD → midnight local time, ISO completo
          filters.fromDate = `${this.filterFromDate}T00:00:00`;
        }
        if (this.filterToDate) {
          // YYYY-MM-DD → fim do dia (23:59:59 inclusivo)
          filters.toDate = `${this.filterToDate}T23:59:59`;
        }

        this.items = await listDashboardItems(filters);
        this.stats = computeStats(this.items);
      } finally {
        this.loading = false;
      }
    },
    /**
     * v5.22.30 — classes dinâmicas de row baseadas em prioridade
     * e seleção. Highlight visual destaca urgentes/altas sem
     * ofuscar a tabela.
     */
    rowClasses(it: DashboardItem): Record<string, boolean> {
      const key = `${it.kind}:${it.id}`;
      return {
        'row-selected': this.selectedItemKey === key,
        'row-urgent': it.priority === 'urgente',
        'row-high':   it.priority === 'alta',
        'row-done':   it.status === 'implantado',
      };
    },
    onFilterChange() {
      // Debounce para search (digitar não causa requisição por tecla)
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => {
        this.reload();
      }, 300);
    },
    onClearFilters() {
      this.searchTerm = '';
      this.filterKind = '';
      this.filterStatus = '';
      this.filterPriority = '';
      this.filterFromDate = '';
      this.filterToDate = '';
      this.filterMineOnly = false;
      this.reload();
    },
    /**
     * v5.22.30 — quick action de prioridade direto na linha. Evita
     * obrigar o usuário a abrir o drill-down para uma das ações mais
     * frequentes (triagem de chegada).
     */
    async onQuickPriorityChange(item: DashboardItem, event: Event) {
      const value = (event.target as HTMLSelectElement).value as
        | '' | 'baixa' | 'media' | 'alta' | 'urgente';
      const target = item.kind === 'submission'
        ? { submissionId: item.id }
        : { ticketId: item.id };
      const result = value
        ? await setPriority(target, value)
        : await clearPriority(target);
      if (result.ok) {
        // Atualiza o item localmente sem precisar reload completo
        item.priority = value || null;
        // Re-computa stats (priority distribution mudou)
        this.stats = computeStats(this.items);
      } else {
        alert(`Erro ao mudar prioridade: ${result.error}`);
        // Rollback visual
        (event.target as HTMLSelectElement).value = item.priority || '';
      }
    },
    onReload() {
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reload();
    },
    /* ============================= v5.22.35 — Bulk selection */
    /**
     * Chave única de um item para o Set de seleção. Mesmo formato
     * do :key do v-for (kind:id) — garante unicidade entre
     * submissions e tickets que possam compartilhar UUID.
     */
    rowKey(it: DashboardItem): string {
      return `${it.kind}:${it.id}`;
    },
    onToggleRow(it: DashboardItem) {
      const key = this.rowKey(it);
      // Set não é reativo por mutação direta no Vue 3 com Options API
      // via this; recriamos para forçar reatividade dos computeds.
      const next = new Set(this.selectedIds);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      this.selectedIds = next;
    },
    onToggleSelectAll() {
      const next = new Set(this.selectedIds);
      if (this.allVisibleSelected) {
        // Desmarca só os visíveis (preserva seleção de itens filtrados)
        for (const it of this.filteredItems) next.delete(this.rowKey(it));
      } else {
        // Marca todos os visíveis
        for (const it of this.filteredItems) next.add(this.rowKey(it));
      }
      this.selectedIds = next;
    },
    clearSelection() {
      this.selectedIds = new Set();
      this.bulkPriority = '';
    },
    /**
     * Aplica a prioridade escolhida a TODOS os itens selecionados.
     * Sequencial (não Promise.all) para não estourar rate limit do
     * Supabase e para conseguir reportar progresso de forma simples.
     *
     * Atualização otimista local após cada sucesso. Em caso de erro,
     * acumula e reporta no final — não interrompe o lote inteiro por
     * uma falha pontual.
     */
    async onBulkApplyPriority() {
      if (!this.bulkPriority || this.selectedIds.size === 0) return;
      this.bulkBusy = true;
      const priority = this.bulkPriority;
      const errors: string[] = [];
      let applied = 0;

      try {
        for (const key of this.selectedIds) {
          const [kind, ...idParts] = key.split(':');
          const id = idParts.join(':');
          const item = this.items.find(
            (it) => it.kind === kind && it.id === id,
          );
          if (!item) continue;

          const target = item.kind === 'submission'
            ? { submissionId: item.id }
            : { ticketId: item.id };
          const result = await setPriority(target, priority);
          if (result.ok) {
            item.priority = priority;
            applied++;
          } else {
            errors.push(`${item.identifier}: ${result.error}`);
          }
        }

        // Re-computa stats (distribuição de prioridade mudou)
        this.stats = computeStats(this.items);

        if (errors.length > 0) {
          alert(
            `${applied} aplicado(s). ${errors.length} falharam:\n` +
            errors.slice(0, 5).join('\n') +
            (errors.length > 5 ? `\n…e mais ${errors.length - 5}` : ''),
          );
        }
        // Limpa seleção após sucesso total
        if (errors.length === 0) this.clearSelection();
      } finally {
        this.bulkBusy = false;
      }
    },
    async onSelect(item: DashboardItem) {
      this.selectedItem = item;
      this.notes = [];
      this.auditEvents = [];
      this.publicComments = [];
      this.activeTab = 'notes';
      this.selectedSubmissionId = '';
      this.newCommentBody = '';

      const target = item.kind === 'submission'
        ? { submissionId: item.id }
        : { ticketId: item.id };

      // 1) Notas (sempre, é a aba default)
      this.notes = await listNotes(target);

      // 2) Resolve submission_id para tickets (audit + comments precisam)
      if (item.kind === 'submission') {
        this.selectedSubmissionId = item.id;
      } else {
        try {
          const sb = await getSupabaseAsync();
          if (sb) {
            const { data } = await sb
              .from('setup_tickets')
              .select('submission_id')
              .eq('id', item.id)
              .single();
            this.selectedSubmissionId =
              (data as { submission_id: string } | null)?.submission_id || '';
          }
        } catch {
          // Sem submission_id, abas histórico/comentários ficam vazias —
          // sinalizado no template via guard `!selectedSubmissionId`.
        }
      }

      // 3) Histórico e comentários em paralelo
      if (this.selectedSubmissionId) {
        const [audit, comments] = await Promise.all([
          item.kind === 'submission'
            ? listAuditEventsBySubmission(item.id)
            : listAuditEventsByTicket(item.id),
          listReviewCommentsBySubmission(this.selectedSubmissionId),
        ]);
        this.auditEvents = audit;
        this.publicComments = comments;
      }
    },
    onCloseDetail() {
      this.selectedItem = null;
      this.notes = [];
      this.auditEvents = [];
      this.publicComments = [];
      this.activeTab = 'notes';
      this.selectedSubmissionId = '';
      this.newCommentBody = '';
    },
    isAdminAuthor(author: string): boolean {
      // Heurística: comentário do painel admin tem o email do admin
      // (com @) como author. Da equipe via /r/:token é texto livre
      // ("Equipe Consulte GEO", "Engenheiro João", etc.)
      return !!author && author.includes('@');
    },
    async onAddPublicComment() {
      if (!this.selectedSubmissionId || !this.newCommentBody.trim()) return;
      // Avisa o usuário: comentário público é irreversível
      if (!confirm(
        'Esse comentário ficará visível para o cliente. Confirmar envio?',
      )) return;

      this.savingComment = true;
      try {
        const result = await addReviewCommentAsAdmin(
          this.selectedSubmissionId,
          this.newCommentBody,
        );
        if (result.ok) {
          this.newCommentBody = '';
          this.publicComments = await listReviewCommentsBySubmission(
            this.selectedSubmissionId,
          );
          // Atualiza public_comment_count no listing
          await this.reload();
        } else {
          alert(`Erro ao enviar comentário: ${result.error}`);
        }
      } finally {
        this.savingComment = false;
      }
    },
    async onExportExcel() {
      if (this.items.length === 0 || this.exporting) return;
      this.exporting = true;
      try {
        const result = await exportDashboardToExcel(this.items, this.stats);
        if (!result.ok) {
          alert(`Falha ao gerar Excel: ${result.error || 'desconhecido'}`);
        }
        // Sucesso: o XLSX.writeFile já dispara o download via <a>
        // implícito. Sem feedback adicional necessário.
      } finally {
        this.exporting = false;
      }
    },
    async onAddNote() {
      if (!this.selectedItem || !this.newNoteBody.trim()) return;
      this.savingNote = true;
      try {
        const target = this.selectedItem.kind === 'submission'
          ? { submissionId: this.selectedItem.id }
          : { ticketId: this.selectedItem.id };
        const result = await addNote(target, this.newNoteBody);
        if (result.ok) {
          this.newNoteBody = '';
          this.notes = await listNotes(target);
          // Atualiza note_count no listing
          await this.reload();
        } else {
          alert(`Erro ao salvar nota: ${result.error}`);
        }
      } finally {
        this.savingNote = false;
      }
    },
    async onDeleteNote(noteId: string) {
      if (!confirm('Apagar esta nota? Não pode ser desfeito.')) return;
      const ok = await softDeleteNote(noteId);
      if (ok && this.selectedItem) {
        const target = this.selectedItem.kind === 'submission'
          ? { submissionId: this.selectedItem.id }
          : { ticketId: this.selectedItem.id };
        this.notes = await listNotes(target);
        await this.reload();
      }
    },
    async onTakeLock() {
      if (!this.selectedItem || this.selectedItem.kind !== 'submission') return;
      const result = await takeLock(this.selectedItem.id);
      if (result.ok) {
        await this.reload();
        // Atualiza selectedItem
        const updated = this.items.find(
          (i) => i.id === this.selectedItem!.id && i.kind === 'submission',
        );
        if (updated) this.selectedItem = updated;
      } else {
        alert(`Erro: ${result.error}`);
      }
    },
    async onReleaseLock() {
      if (!this.selectedItem) return;
      const ok = await releaseLock(this.selectedItem.id);
      if (ok) {
        await this.reload();
        const updated = this.items.find(
          (i) => i.id === this.selectedItem!.id && i.kind === 'submission',
        );
        if (updated) this.selectedItem = updated;
      }
    },
    async onPriorityChange(event: Event) {
      if (!this.selectedItem) return;
      const value = (event.target as HTMLSelectElement).value as
        | '' | 'baixa' | 'media' | 'alta' | 'urgente';
      const target = this.selectedItem.kind === 'submission'
        ? { submissionId: this.selectedItem.id }
        : { ticketId: this.selectedItem.id };
      const result = value
        ? await setPriority(target, value)
        : await clearPriority(target);
      if (result.ok) {
        await this.reload();
        const updated = this.items.find(
          (i) => i.id === this.selectedItem!.id && i.kind === this.selectedItem!.kind,
        );
        if (updated) this.selectedItem = updated;
      } else {
        alert(`Erro: ${result.error}`);
      }
    },
    async onLogout() {
      await signOut();
      this.$router.replace('/admin/login');
    },
    formatDate(iso: string | null): string {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return iso;
      }
    },
  },
});
</script>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--page-bg);
  color: var(--fg);
}
.admin-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.admin-brand strong { color: var(--brand-fg); }
.muted { color: var(--muted-fg); }
.small { font-size: 12px; }
.admin-user {
  display: flex;
  align-items: center;
  gap: 12px;
}
.admin-main {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.stat-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border);
}
.stat-label { color: var(--muted-fg); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
.admin-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: var(--surface);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.admin-filters .input { flex: 1; min-width: 160px; }
.admin-listing {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  overflow-x: auto;
}

/* v5.22.35 — topbar do listing com contagem + bulk bar */
.listing-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 34px;
}
.bulk-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(197, 17, 126, 0.06);
  border: 1px solid rgba(197, 17, 126, 0.25);
  border-radius: 8px;
  animation: bulk-bar-in 0.15s ease;
}
@keyframes bulk-bar-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.bulk-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-fg);
  white-space: nowrap;
}
.bulk-priority {
  width: auto !important;
  min-width: 150px !important;
  font-size: 13px;
}
.col-check {
  width: 36px;
  text-align: center;
  padding-right: 0 !important;
}
.col-check input[type="checkbox"] {
  cursor: pointer;
  margin: 0;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
}
.admin-table th, .admin-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.admin-table tbody tr { cursor: pointer; }
.admin-table tbody tr:hover { background: rgba(127, 127, 127, 0.06); }
.row-selected { background: rgba(197, 17, 126, 0.08) !important; }

/* v5.22.30 — Highlight visual de prioridade na linha */
.row-urgent {
  background: rgba(220, 0, 0, 0.04);
  border-left: 3px solid #dc0000;
}
.row-urgent:hover { background: rgba(220, 0, 0, 0.08) !important; }
.row-high {
  background: rgba(220, 100, 0, 0.03);
  border-left: 3px solid #dc6400;
}
.row-high:hover { background: rgba(220, 100, 0, 0.06) !important; }
.row-done td {
  color: var(--muted-fg);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.row-done .badge-status-implantado {
  text-decoration: none;
  opacity: 0.7;
}

/* v5.22.30 — Quick priority select na linha */
.quick-priority {
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  width: 90px;
}
.quick-priority:hover { border-color: var(--brand-fg); }
.quick-priority:focus {
  outline: 2px solid var(--brand-fg);
  outline-offset: 1px;
}

/* v5.22.30 — Filtros novos: date pickers + toggle */
.filter-date {
  flex: 0 0 auto !important;
  min-width: 140px !important;
  max-width: 160px !important;
}
.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}
.filter-toggle:hover { border-color: var(--brand-fg); }
.filter-toggle input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}
.empty {
  padding: 40px;
  text-align: center;
  color: var(--muted-fg);
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: rgba(127, 127, 127, 0.15);
}
.badge-submission { background: rgba(0, 100, 200, 0.15); color: #0064c8; }
.badge-ticket { background: rgba(150, 100, 50, 0.15); color: #966432; }
.badge-status-enviado { background: rgba(0, 150, 0, 0.15); color: #009600; }
.badge-status-devolvido { background: rgba(200, 100, 0, 0.15); color: #c86400; }
.badge-status-implantado { background: rgba(100, 50, 200, 0.15); color: #6432c8; }
.badge-priority-urgente { background: rgba(220, 0, 0, 0.18); color: #dc0000; font-weight: 600; }
.badge-priority-alta { background: rgba(220, 100, 0, 0.15); color: #dc6400; }
.badge-priority-media { background: rgba(220, 200, 0, 0.18); color: #806000; }
.badge-priority-baixa { background: rgba(100, 150, 100, 0.15); color: #649664; }
.admin-drilldown {
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--border);
}
.drilldown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.drilldown-actions {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding: 12px;
  background: rgba(127, 127, 127, 0.05);
  border-radius: 8px;
  margin-bottom: 20px;
}
.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.action-label { font-weight: 600; font-size: 14px; }
.drilldown-notes h3 { margin: 0 0 12px; font-size: 16px; }
.note-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.note-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.note-list li {
  padding: 12px;
  background: rgba(127, 127, 127, 0.05);
  border-left: 3px solid var(--brand-fg);
  border-radius: 4px;
}
.note-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}
.note-body { white-space: pre-wrap; word-wrap: break-word; }
.btn-link {
  background: none;
  border: none;
  color: var(--brand-fg);
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
  padding: 0;
  margin-left: auto;
}

/* v5.22.29 — Tabs do drilldown */
.drilldown-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tab-btn {
  background: none;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  color: var(--muted-fg);
  font-size: 14px;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-weight: 500;
}
.tab-btn:hover { color: var(--fg); }
.tab-btn.active {
  color: var(--brand-fg);
  border-bottom-color: var(--brand-fg);
}
.drilldown-tab-content { padding-top: 8px; }

.alert {
  padding: 8px 12px;
  border-radius: 6px;
  margin: 8px 0;
}
.alert.info {
  background: rgba(0, 120, 200, 0.08);
  color: #006499;
  border-left: 3px solid #0078c8;
}

/* Comentários públicos: visual diferente (warning, aparece ao cliente) */
.public-comment {
  border-left-color: #c8782e !important;
  background: rgba(200, 120, 50, 0.05) !important;
}
.badge-admin-author {
  font-size: 10px;
  background: rgba(150, 100, 200, 0.15);
  color: #6432c8;
  margin-left: auto;
}

/* Timeline de audit */
.audit-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.audit-event {
  padding: 10px 12px;
  background: rgba(127, 127, 127, 0.04);
  border-left: 3px solid var(--muted-fg);
  border-radius: 4px;
}
.audit-event-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
  font-size: 12px;
}
.audit-time { color: var(--muted-fg); font-variant-numeric: tabular-nums; }
.audit-actor { font-weight: 500; }
.audit-event-action { font-size: 14px; }
.badge-source { font-size: 10px; padding: 1px 6px; }
.badge-source-admin_panel {
  background: rgba(197, 17, 126, 0.15);
  color: #c5117e;
}
.badge-source-frontend {
  background: rgba(0, 120, 200, 0.10);
  color: #0078c8;
}
.badge-source-backend, .badge-source-edge_function {
  background: rgba(100, 150, 100, 0.12);
  color: #649664;
}
.btn.warning {
  background: #c8782e;
  color: white;
  border-color: #c8782e;
}
.btn.warning:hover:not(:disabled) { background: #b56a26; }
@media (max-width: 700px) {
  .admin-filters { flex-direction: column; }
  .admin-filters .input { width: 100%; }
  .drilldown-actions { flex-direction: column; gap: 12px; }
}
</style>
