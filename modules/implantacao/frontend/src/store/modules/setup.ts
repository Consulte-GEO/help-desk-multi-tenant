/**
 * Vuex module: setup · v5
 *
 * Gerencia o snapshot completo do Cadastro Simplificado de Estrutura
 * (8 etapas) e o ciclo rascunho → enviado → analisado → implantado.
 */

import type { Module } from 'vuex';
import {
  cryptoUid,
  concretosPadrao,
  defaultSnapshot,
  novaPeca,
  novoConcreto,
  novoGrupo,
  padraoMoldagemAgeInHours,
  type Concreto,
  type Grupo,
  type ObraMetadata,
  type ObraStatus,
  type PadraoMoldagem,
  type Peca,
  type SetupSnapshot,
  type TipoEnsaioPadrao,
  type TipoEstruturaModelo,
  type UnidadeIdade,
  type Comentario,
  type TicketSubmissionResponse,
  type UsuarioObra,
  type Fornecedor,
} from '../../models/setup.models';
import type { TechnicalJson } from '../../models/technicalMapping.models';
import { buildTechnicalJson } from '../../services/jsonGeneratorService';
import {
  saveDraft as saveDraftRemote,
  saveDraftSilent as saveDraftSilentRemote,
  loadDraft as loadDraftRemote,
  setLastDraftPointer,
  clearLastDraftPointer,
} from '../../services/setupDraftService';
import { recordAudit } from '../../services/setupAuditService';
// v5.20: submit agora via ticketService (Edge Function submit-for-validation)
import {
  submitForValidation as submitForValidationViaEdge,
} from '../../services/ticketService';
import { detectEtapa, orderOf } from '../../services/normalizationService';

export interface SetupState extends SetupSnapshot {
  draftId: string | null;
  submissionId: string | null;
  technicalJson: TechnicalJson | null;
  isDirty: boolean;
  lastSavedAt: string | null;
  loading: boolean;
  error: string | null;
  drawerOpen: boolean;
  drawerItemId: string | null;
  /** v5.20: textarea opcional na Etapa 6 (max 1000 chars). */
  clientMessage: string;
  /** v5.20: resposta do ticket após submit (para exibir no modal). */
  currentTicket: TicketSubmissionResponse | null;
  /**
   * v5.22.4: identificador do exemplo carregado (null se usuário começou
   * do zero ou carregou rascunho real). Combinado com `exampleBaselineHash`
   * abaixo, permite detectar se o conteúdo ainda é "exemplo puro" ou se
   * o usuário já personalizou.
   */
  exampleLoadedKey: 'common' | 'projetista' | null;
  /**
   * v5.22.4: hash JSON da parte "personalizável" do snapshot no momento
   * em que o exemplo foi carregado. Se hash atual == este, exemplo está
   * intocado. Hash atual != este → usuário editou algo.
   */
  exampleBaselineHash: string | null;
}

function emptyState(): SetupState {
  return {
    ...defaultSnapshot(),
    draftId: null,
    submissionId: null,
    technicalJson: null,
    isDirty: false,
    lastSavedAt: null,
    loading: false,
    error: null,
    drawerOpen: false,
    drawerItemId: null,
    clientMessage: '',
    currentTicket: null,
    exampleLoadedKey: null,
    exampleBaselineHash: null,
  };
}

/**
 * v5.22.4: hash JSON-stable da parte "personalizável" do snapshot.
 * Usado para detectar se o exemplo carregado foi de fato editado pelo
 * usuário. NÃO inclui campos derivados (audit local, step atual, theme,
 * showJson) que mudam sem ser edição de conteúdo.
 *
 * Não é hash criptográfico — só comparação textual estável. Suficiente
 * para detectar mudanças exatas no payload do usuário.
 */
function computeUserContentHash(snap: SetupSnapshot): string {
  return JSON.stringify({
    metadata: snap.metadata,
    tipoEstrutura: snap.tipoEstrutura,
    grupos: snap.grupos,
    concretos: snap.concretos,
    comentarios: snap.comentarios,
    usuariosObra: snap.usuariosObra,
    fornecedores: snap.fornecedores,
  });
}

/**
 * v5.22.19 — Janela do debounce do autosave (ms).
 *
 * 3000ms é o ponto de equilíbrio: curto o bastante para "se eu fechar a
 * aba, não perco mais do que 3s de digitação" e longo o bastante para
 * não martelar o Supabase a cada tecla quando o usuário está editando
 * um campo de texto. Cada call site chama persistDebounced que reseta
 * o timer; só quando o usuário "pára" por 3s o save acontece.
 */
const AUTOSAVE_DEBOUNCE_MS = 3000;

/**
 * v5.22.19 — Timer único do autosave. Vive no escopo do módulo (não
 * do state) porque é detalhe de implementação da ação, não dado
 * reativo. Múltiplas chamadas a persistDebounced reusam o mesmo slot
 * e cancelam o timer pendente.
 */
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

const setupModule: Module<SetupState, unknown> = {
  namespaced: true,
  state: emptyState,
  getters: {
    snapshot: (state): SetupSnapshot => ({
      step: state.step,
      theme: state.theme,
      showJson: state.showJson,
      metadata: state.metadata,
      tipoEstrutura: state.tipoEstrutura,
      grupos: state.grupos,
      concretos: state.concretos,
      comentarios: state.comentarios,
      audit: state.audit,
      usuariosObra: state.usuariosObra,
      fornecedores: state.fornecedores,
    }),
    /**
     * v5.22.4: true se um exemplo foi carregado e nada foi editado desde então.
     * Bloqueia o envio para validação (Etapa 7) — para evitar que o cliente
     * envie um exemplo pré-carregado sem personalizar os dados da própria obra.
     */
    isExampleUnchanged: (state, getters): boolean => {
      if (!state.exampleLoadedKey || !state.exampleBaselineHash) return false;
      return computeUserContentHash(getters.snapshot) === state.exampleBaselineHash;
    },
    grupoById: (state) => (id: string) => state.grupos.find((g) => g.id === id),
    concretoById: (state) => (id: string) => state.concretos.find((c) => c.id === id),
    pecaById: (state) => (grupoId: string, pecaId: string) =>
      state.grupos.find((g) => g.id === grupoId)?.pecas.find((p) => p.id === pecaId),
  },

  mutations: {
    /* core */
    /**
     * v5.22.27 — Atualização do clamping após a renumeração v5.22.11.
     * O wizard atual tem:
     *  - Cliente: etapas 1-7 (Revisão e envio = 7)
     *  - Equipe (em ReviewView com WIZARD_STEPS_FULL): etapas 1-9
     *
     * Antes da v5.22.11 era 1-10 (8 cliente + 2 equipe). O clamp
     * permanecia em `Math.min(10, step)` mesmo após o remap, então
     * `setStep(8)`, `setStep(9)` ou `setStep(10)` eram aceitos no
     * estado mas nenhum template do SetupPage cobria — tela branca.
     *
     * Agora: clamp em 1-9. Valores acima são *capados* em 9 (não
     * lançam erro — preserva tolerância contra chamadas legadas) e
     * geram um warning no console em DEV para facilitar debug do
     * bug "tela branca" caso reapareça.
     */
    setStep(state, step: number) {
      const clamped = Math.max(1, Math.min(9, step));
      if (clamped !== step && typeof console !== 'undefined' && console.warn) {
        // Aviso explícito — facilita rastrear callers obsoletos sem
        // quebrar a app. Aparece no DevTools de produção também.
        console.warn(
          `[setup/setStep] valor ${step} fora do intervalo válido [1..9]; ` +
          `clampado para ${clamped}. ` +
          `Provável caller obsoleto após renumeração v5.22.11.`,
        );
      }
      state.step = clamped;
    },
    setTheme(state, theme: 'light' | 'dark') {
      state.theme = theme;
    },
    toggleJson(state) {
      state.showJson = !state.showJson;
    },
    setDirty(state, value: boolean) {
      state.isDirty = value;
    },
    setLastSavedAt(state, iso: string | null) {
      state.lastSavedAt = iso;
    },
    setLoading(state, value: boolean) {
      state.loading = value;
    },
    setError(state, msg: string | null) {
      state.error = msg;
    },
    setDraftId(state, id: string | null) {
      state.draftId = id;
    },
    setSubmissionId(state, id: string | null) {
      state.submissionId = id;
    },
    setTechnicalJson(state, json: TechnicalJson | null) {
      state.technicalJson = json;
    },
    setDrawer(state, payload: { open: boolean; itemId?: string | null }) {
      state.drawerOpen = payload.open;
      state.drawerItemId = payload.itemId ?? null;
    },

    /* obra */
    updateMetadataField(
      state,
      payload: { field: keyof ObraMetadata; value: unknown },
    ) {
      (state.metadata as unknown as Record<string, unknown>)[payload.field] = payload.value;
      state.isDirty = true;
    },
    updateCreatedByField(
      state,
      payload: { field: 'nome' | 'email' | 'userId'; value: string },
    ) {
      state.metadata.createdBy[payload.field] = payload.value;
      state.isDirty = true;
    },
    updateModeloProjetoField(
      state,
      payload: { field: string; value: string },
    ) {
      (state.metadata.modeloProjetoFields as unknown as Record<string, string>)[
        payload.field
      ] = payload.value;
      state.isDirty = true;
    },
    setModeloPreenchimento(state, value: 'comum' | 'modelo_projeto') {
      // Fonte ÚNICA de verdade para "modelo simplificado vs com projetista".
      // Não sincroniza com state.tipoEstrutura — esse representa o tipo de
      // obra (torres iguais, obra horizontal, etc.) e é independente.
      state.metadata.modeloPreenchimento = value;
      state.isDirty = true;
    },
    setStatus(state, status: ObraStatus) {
      state.metadata.status = status;
      state.isDirty = true;
    },
    setProtocolo(state, protocolo: string) {
      state.metadata.protocoloEnvio = protocolo;
      state.isDirty = true;
    },

    /* v5.20: textarea da Etapa 6 e ticket gerado pelo submit */
    setClientMessage(state, msg: string) {
      state.clientMessage = (msg || '').slice(0, 1000);
      state.isDirty = true;
    },
    setCurrentTicket(state, ticket: TicketSubmissionResponse | null) {
      // v5.22.12: log temporário para debug — se o modal "Recebido" não
      // abrir após Enviar para validação, este log confirma se a action
      // chegou a chamar o commit. Próximo passo se logado mas sem modal:
      // verificar <div data-testid="submit-ticket-modal"> no DOM (deve
      // estar como filho direto de <body> via Teleport).
      if (ticket) {
        // eslint-disable-next-line no-console
        console.info('[store/setup] setCurrentTicket:', ticket.ticket_number);
      }
      state.currentTicket = ticket;
    },
    clearTicket(state) {
      state.currentTicket = null;
    },

    /* tipo estrutura */
    setTipoEstrutura(state, value: TipoEstruturaModelo) {
      state.tipoEstrutura = value;
      if (value === 'modelo_projeto') state.metadata.modeloPreenchimento = 'modelo_projeto';
      state.isDirty = true;
    },

    /* grupos */
    addGrupo(state, seed: Partial<Grupo> = {}) {
      state.grupos.push(novoGrupo(seed));
      state.isDirty = true;
    },
    updateGrupoField(
      state,
      payload: { id: string; field: keyof Grupo; value: unknown },
    ) {
      const g = state.grupos.find((x) => x.id === payload.id);
      if (!g) return;
      (g as unknown as Record<string, unknown>)[payload.field] = payload.value;
      state.isDirty = true;
    },
    removeGrupo(state, id: string) {
      state.grupos = state.grupos.filter((g) => g.id !== id);
      state.isDirty = true;
    },
    /**
     * v5.22.38: reordena grupos via drag-and-drop. Move o grupo do
     * índice `from` para o índice `to` (splice + insert). Tolerante a
     * índices fora de faixa (clamp). Idempotente quando from === to.
     */
    reorderGrupos(state, payload: { from: number; to: number }) {
      const len = state.grupos.length;
      const from = Math.max(0, Math.min(payload.from, len - 1));
      const to = Math.max(0, Math.min(payload.to, len - 1));
      if (from === to) return;
      const [moved] = state.grupos.splice(from, 1);
      if (!moved) return;
      state.grupos.splice(to, 0, moved);
      state.isDirty = true;
    },
    duplicateGrupo(state, id: string) {
      const original = state.grupos.find((g) => g.id === id);
      if (!original) return;
      const clone: Grupo = JSON.parse(JSON.stringify(original));
      clone.id = cryptoUid('grp');
      clone.nome = `${clone.nome} - cópia`;
      clone.edificacoesInput = '';
      clone.edificacoesExpanded = [];
      clone.pecas.forEach((p) => (p.id = cryptoUid('peca')));
      state.grupos.push(clone);
      state.isDirty = true;
    },
    /**
     * Copia as peças de um grupo de origem para outro grupo de destino,
     * substituindo as peças existentes no destino. Usado pela ação
     * "Copiar estrutura" na Etapa 5 (Pavimentos e peças).
     */
    copyPecasEntreGrupos(
      state,
      payload: { fromGrupoId: string; toGrupoId: string },
    ) {
      const from = state.grupos.find((g) => g.id === payload.fromGrupoId);
      const to = state.grupos.find((g) => g.id === payload.toGrupoId);
      if (!from || !to) return;
      to.pecas = from.pecas.map(
        (p) => JSON.parse(JSON.stringify({ ...p, id: cryptoUid('peca') })) as Peca,
      );
      state.isDirty = true;
    },

    /* peças */
    addPeca(state, payload: { grupoId: string; seed?: Partial<Peca> }) {
      const g = state.grupos.find((x) => x.id === payload.grupoId);
      if (!g) return;
      const seed = payload.seed ?? {};
      const local = seed.local ?? '';
      g.pecas.push(
        novaPeca({
          ...seed,
          etapa: seed.etapa ?? detectEtapa(local),
          ordem: seed.ordem ?? orderOf(local),
        }),
      );
      state.isDirty = true;
    },
    updatePecaField(
      state,
      payload: { grupoId: string; pecaId: string; field: keyof Peca; value: unknown },
    ) {
      const g = state.grupos.find((x) => x.id === payload.grupoId);
      const p = g?.pecas.find((x) => x.id === payload.pecaId);
      if (!p) return;
      (p as unknown as Record<string, unknown>)[payload.field] = payload.value;
      if (payload.field === 'local') {
        p.etapa = detectEtapa(String(p.local));
        p.ordem = orderOf(String(p.local));
      }
      state.isDirty = true;
    },
    removePeca(state, payload: { grupoId: string; pecaId: string }) {
      const g = state.grupos.find((x) => x.id === payload.grupoId);
      if (!g) return;
      g.pecas = g.pecas.filter((p) => p.id !== payload.pecaId);
      state.isDirty = true;
    },
    /**
     * v5.22.38: reordena peças DENTRO de um grupo via drag-and-drop.
     * Move a peça do índice `from` para o índice `to`. Clamp + idempotente.
     */
    reorderPecas(
      state,
      payload: { grupoId: string; from: number; to: number },
    ) {
      const g = state.grupos.find((x) => x.id === payload.grupoId);
      if (!g) return;
      const len = g.pecas.length;
      const from = Math.max(0, Math.min(payload.from, len - 1));
      const to = Math.max(0, Math.min(payload.to, len - 1));
      if (from === to) return;
      const [moved] = g.pecas.splice(from, 1);
      if (!moved) return;
      g.pecas.splice(to, 0, moved);
      state.isDirty = true;
    },
    bulkAddPavimentos(
      state,
      payload: {
        grupoId: string;
        start: number;
        end: number;
        fck: string;
        volume: string;
      },
    ) {
      const g = state.grupos.find((x) => x.id === payload.grupoId);
      if (!g) return;
      const s = Number(payload.start);
      const e = Number(payload.end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || s > e) return;
      for (let i = s; i <= e; i++) {
        g.pecas.push(
          novaPeca({
            local: `${i}º Pavimento`,
            fck: payload.fck,
            volume: payload.volume,
            etapa: 'Estrutura',
            ordem: i,
          }),
        );
      }
      state.isDirty = true;
    },

    /* concretos */
    addConcreto(state) {
      state.concretos.push(novoConcreto());
      state.isDirty = true;
    },
    /**
     * v5.22.10: popula a lista com os 5 traços padrão (Radier, Sapata,
     * Estaca Hélice, Contenções, Convencional). Cliente pode clicar
     * "Sugerir traços padrão" no estado vazio da Etapa 4. Idempotente:
     * só popula se a lista estiver vazia (proteção contra duplo-clique).
     */
    suggestConcretosDefault(state) {
      if (state.concretos.length > 0) return;
      state.concretos = concretosPadrao();
      state.isDirty = true;
    },
    updateConcretoField(
      state,
      payload: { id: string; field: keyof Concreto; value: unknown },
    ) {
      const c = state.concretos.find((x) => x.id === payload.id);
      if (!c) return;
      (c as unknown as Record<string, unknown>)[payload.field] = payload.value;
      // Sincronização FCK → padrões de compressão:
      // ao mudar o FCK do concreto, mantém o `crescimentoPct` de cada
      // linha de compressão (que é a referência da CURVA) e recalcula
      // o `valorEsperado` com o novo FCK.
      // Ex.: linha 7 dias = 70% → FCK 25 vira 17.5; FCK 30 vira 21.
      if (payload.field === 'fck') {
        const newFckNum =
          Number(String(payload.value || '').replace(/[^\d]/g, '')) || 0;
        c.padroesMoldagem.forEach((pm) => {
          if (pm.tipoEnsaio !== 'compressao') return;
          const pct = Number(pm.crescimentoPct);
          if (newFckNum > 0 && !Number.isNaN(pct) && pct >= 0) {
            pm.valorEsperado = Number(((pct * newFckNum) / 100).toFixed(1));
          } else if (newFckNum === 0) {
            // FCK apagado — não tenta atualizar (valor permanece).
          }
        });
      }
      state.isDirty = true;
    },
    removeConcreto(state, id: string) {
      state.concretos = state.concretos.filter((c) => c.id !== id);
      state.isDirty = true;
    },

    /* padrões de moldagem (filhos de Concreto) */
    addPadraoMoldagem(
      state,
      payload: { concretoId: string; seed?: Partial<PadraoMoldagem> },
    ) {
      const c = state.concretos.find((x) => x.id === payload.concretoId);
      if (!c) return;
      const seed = payload.seed ?? {};
      const fckNum = Number(String(c.fck || '').replace(/[^\d]/g, '')) || 0;
      const tipoEnsaio = (seed.tipoEnsaio as TipoEnsaioPadrao) ?? 'compressao';
      const unidadeIdade = (seed.unidadeIdade as UnidadeIdade) ?? 'dias';
      const idadeControle = seed.idadeControle ?? '';
      const isCompressao = tipoEnsaio === 'compressao';
      const seedQtd = Number(seed.quantidadeCp ?? 2) || 2;

      // Detecção de duplicata: se já existe linha com mesma idade +
      // unidade + tipo de ensaio, **incrementa quantidadeCp** em vez
      // de adicionar nova linha. Idade vazia nunca dedupe (sempre cria).
      if (idadeControle !== '' && idadeControle !== null) {
        const novaIdade = padraoMoldagemAgeInHours({
          idadeControle,
          unidadeIdade,
        });
        if (Number.isFinite(novaIdade)) {
          const existente = c.padroesMoldagem.find(
            (pm) =>
              pm.tipoEnsaio === tipoEnsaio &&
              padraoMoldagemAgeInHours(pm) === novaIdade,
          );
          if (existente) {
            const curQtd = Number(existente.quantidadeCp) || 0;
            existente.quantidadeCp = curQtd + seedQtd;
            state.isDirty = true;
            return; // não cria nova linha
          }
        }
      }

      // Resolve valorEsperado/crescimentoPct conforme o que veio no seed.
      let valorEsperado: number | string = seed.valorEsperado as number | string;
      let crescimentoPct: number = (seed.crescimentoPct as number) ?? 100;
      const hasValor = valorEsperado !== undefined && valorEsperado !== '';
      const hasPct = seed.crescimentoPct !== undefined && seed.crescimentoPct !== null;
      if (!hasValor && !hasPct) {
        valorEsperado = isCompressao ? (fckNum || '') : '';
        crescimentoPct = 100;
      } else if (hasValor && !hasPct && isCompressao && fckNum > 0) {
        crescimentoPct = Math.round((Number(valorEsperado) / fckNum) * 100);
      } else if (!hasValor && hasPct && isCompressao && fckNum > 0) {
        valorEsperado = Number(((crescimentoPct * fckNum) / 100).toFixed(1));
      } else if (!hasValor) {
        valorEsperado = isCompressao ? (fckNum || '') : '';
      }

      c.padroesMoldagem.push({
        id: cryptoUid('pm'),
        idadeControle,
        unidadeIdade,
        tipoEnsaio,
        valorEsperado,
        crescimentoPct,
        quantidadeCp: seedQtd,
      });
      // Mantém a tabela ordenada por temporalidade após cada inserção.
      c.padroesMoldagem.sort(
        (a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b),
      );
      state.isDirty = true;
    },
    updatePadraoMoldagemField(
      state,
      payload: {
        concretoId: string;
        padraoId: string;
        field: keyof PadraoMoldagem;
        value: unknown;
      },
    ) {
      const c = state.concretos.find((x) => x.id === payload.concretoId);
      const pm = c?.padroesMoldagem.find((x) => x.id === payload.padraoId);
      if (!c || !pm) return;
      (pm as unknown as Record<string, unknown>)[payload.field] = payload.value;

      // Sincronização bidirecional valor ↔ crescimento %, apenas para
      // compressão e quando há FCK do concreto.
      //   valor → %    : pct = round(valor / FCK * 100)
      //   % → valor    : valor = round(pct * FCK / 100, 1 casa)
      // Trocar tipoEnsaio: se virou compressão, recalcula % a partir do
      // valor atual (se houver) e FCK; se saiu de compressão, mantém.
      if (pm.tipoEnsaio === 'compressao') {
        const fck = Number(String(c.fck || '').replace(/[^\d]/g, '')) || 0;
        if (fck > 0) {
          if (payload.field === 'valorEsperado') {
            const v = Number(payload.value);
            if (payload.value !== '' && !Number.isNaN(v) && v >= 0) {
              pm.crescimentoPct = Math.round((v / fck) * 100);
            }
          } else if (payload.field === 'crescimentoPct') {
            const p = Number(payload.value);
            if (payload.value !== '' && !Number.isNaN(p) && p >= 0) {
              pm.valorEsperado = Number(((p * fck) / 100).toFixed(1));
            }
          } else if (payload.field === 'tipoEnsaio') {
            // Acabou de virar compressão — recalcula % se há valor.
            const v = Number(pm.valorEsperado);
            if (!Number.isNaN(v) && v > 0) {
              pm.crescimentoPct = Math.round((v / fck) * 100);
            }
          }
        }
      }
      state.isDirty = true;
    },
    removePadraoMoldagem(
      state,
      payload: { concretoId: string; padraoId: string },
    ) {
      const c = state.concretos.find((x) => x.id === payload.concretoId);
      if (!c) return;
      c.padroesMoldagem = c.padroesMoldagem.filter(
        (pm) => pm.id !== payload.padraoId,
      );
      state.isDirty = true;
    },
    /**
     * Copia todos os padrões de moldagem de um concreto para outro.
     * Estratégia: preserva o **crescimento %** e recalcula o
     * `valorEsperado` com base no FCK do destino — é o crescimento da
     * curva que faz sentido transferir, não o valor absoluto.
     */
    copyPadroesEntreConcretos(
      state,
      payload: { fromConcretoId: string; toConcretoId: string },
    ) {
      const from = state.concretos.find((c) => c.id === payload.fromConcretoId);
      const to = state.concretos.find((c) => c.id === payload.toConcretoId);
      if (!from || !to) return;
      const fckTo = Number(String(to.fck || '').replace(/[^\d]/g, '')) || 0;
      to.padroesMoldagem = from.padroesMoldagem.map((pm) => {
        const cloned: PadraoMoldagem = {
          ...JSON.parse(JSON.stringify(pm)),
          id: cryptoUid('pm'),
        };
        if (cloned.tipoEnsaio === 'compressao' && fckTo > 0) {
          const pct = Number(cloned.crescimentoPct);
          if (!Number.isNaN(pct) && pct >= 0) {
            cloned.valorEsperado = Number(((pct * fckTo) / 100).toFixed(1));
          }
        }
        return cloned;
      });
      // Garante ordem temporal (a origem pode ter sido reordenada manualmente).
      to.padroesMoldagem.sort(
        (a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b),
      );
      state.isDirty = true;
    },

    /* comentários e audit local */
    addComentario(state, comentario: Comentario) {
      state.comentarios.push(comentario);
      state.isDirty = true;
    },
    addAuditLocal(
      state,
      event: { actor?: string; acao: string; before?: unknown; after?: unknown },
    ) {
      state.audit.push({
        id: cryptoUid('aud'),
        timestamp: new Date().toISOString(),
        autor: event.actor ?? state.metadata.createdBy.email ?? 'usuario_demo',
        acao: event.acao,
        before: event.before,
        after: event.after,
      });
    },

    /* v5.22.6: usuários da obra */
    addUsuarioObra(state, usuario: UsuarioObra) {
      state.usuariosObra.push(usuario);
      state.isDirty = true;
    },
    updateUsuarioObra(
      state,
      payload: { id: string; field: keyof UsuarioObra; value: string },
    ) {
      const u = state.usuariosObra.find((x) => x.id === payload.id);
      if (!u) return;
      (u as unknown as Record<string, string>)[payload.field] = payload.value;
      state.isDirty = true;
    },
    removeUsuarioObra(state, id: string) {
      const i = state.usuariosObra.findIndex((u) => u.id === id);
      if (i >= 0) {
        state.usuariosObra.splice(i, 1);
        state.isDirty = true;
      }
    },

    /* v5.22.7: fornecedores */
    addFornecedor(state, fornecedor: Fornecedor) {
      state.fornecedores.push(fornecedor);
      state.isDirty = true;
    },
    updateFornecedor(
      state,
      payload: { id: string; field: keyof Fornecedor; value: unknown },
    ) {
      const f = state.fornecedores.find((x) => x.id === payload.id);
      if (!f) return;
      (f as unknown as Record<string, unknown>)[payload.field] = payload.value;
      state.isDirty = true;
    },
    removeFornecedor(state, id: string) {
      const i = state.fornecedores.findIndex((f) => f.id === id);
      if (i >= 0) {
        state.fornecedores.splice(i, 1);
        state.isDirty = true;
      }
    },
    /** v5.22.7: adiciona slot de email no fornecedor (limite: 3). */
    addFornecedorEmail(state, id: string) {
      const f = state.fornecedores.find((x) => x.id === id);
      if (!f) return;
      if (f.emailsProgramacao.length >= 3) return;
      f.emailsProgramacao.push('');
      state.isDirty = true;
    },
    /** v5.22.7: atualiza email de um slot específico do fornecedor. */
    updateFornecedorEmail(
      state,
      payload: { id: string; index: number; value: string },
    ) {
      const f = state.fornecedores.find((x) => x.id === payload.id);
      if (!f) return;
      if (payload.index < 0 || payload.index >= f.emailsProgramacao.length) return;
      f.emailsProgramacao[payload.index] = payload.value;
      state.isDirty = true;
    },
    /** v5.22.7: remove slot de email; mantém pelo menos 1 slot. */
    removeFornecedorEmail(
      state,
      payload: { id: string; index: number },
    ) {
      const f = state.fornecedores.find((x) => x.id === payload.id);
      if (!f) return;
      if (f.emailsProgramacao.length <= 1) {
        // mantém 1 slot vazio em vez de eliminar a coluna
        f.emailsProgramacao[0] = '';
      } else {
        f.emailsProgramacao.splice(payload.index, 1);
      }
      state.isDirty = true;
    },

    /* substituir tudo (carregar exemplo, carregar rascunho) */
    replaceSnapshot(state, snapshot: SetupSnapshot) {
      state.step = snapshot.step;
      state.theme = snapshot.theme;
      state.showJson = snapshot.showJson;
      // v5.22.47: modelo único — rascunhos antigos salvos como 'comum'
      // passam a renderizar o layout completo. Normalização de MODO de
      // interface (não é dado do usuário): nenhum campo digitado muda.
      if (snapshot.metadata && snapshot.metadata.modeloPreenchimento !== 'modelo_projeto') {
        snapshot.metadata.modeloPreenchimento = 'modelo_projeto';
      }
      state.metadata = snapshot.metadata;
      state.tipoEstrutura = snapshot.tipoEstrutura;
      state.grupos = snapshot.grupos;
      state.concretos = snapshot.concretos;
      state.comentarios = snapshot.comentarios;
      state.audit = snapshot.audit;
      // v5.22.6: snapshots salvos antes da v5.22.6 não têm usuariosObra
      state.usuariosObra = snapshot.usuariosObra ?? [];
      // v5.22.7: snapshots salvos antes da v5.22.7 não têm fornecedores
      state.fornecedores = snapshot.fornecedores ?? [];
      state.isDirty = false;
      // v5.22.4: ao carregar rascunho real (não exemplo), limpa baseline
      state.exampleLoadedKey = null;
      state.exampleBaselineHash = null;
    },
    /**
     * v5.22.4: substituir tudo COM marcação de baseline para detecção
     * de "exemplo intocado". O envio para validação fica bloqueado até
     * o usuário modificar algum campo.
     */
    loadExampleSnapshot(state, payload: { snapshot: SetupSnapshot; key: 'common' | 'projetista' }) {
      const snap = payload.snapshot;
      // v5.22.47: modelo único — mesma normalização do replaceSnapshot.
      // Feita ANTES do hash de baseline para o isExampleUnchanged
      // continuar true logo após carregar o exemplo.
      if (snap.metadata && snap.metadata.modeloPreenchimento !== 'modelo_projeto') {
        snap.metadata.modeloPreenchimento = 'modelo_projeto';
      }
      state.step = snap.step;
      state.theme = snap.theme;
      state.showJson = snap.showJson;
      state.metadata = snap.metadata;
      state.tipoEstrutura = snap.tipoEstrutura;
      state.grupos = snap.grupos;
      state.concretos = snap.concretos;
      state.comentarios = snap.comentarios;
      state.audit = snap.audit;
      state.usuariosObra = snap.usuariosObra ?? [];
      state.fornecedores = snap.fornecedores ?? [];
      state.isDirty = false;
      state.exampleLoadedKey = payload.key;
      state.exampleBaselineHash = computeUserContentHash({
        ...snap,
        usuariosObra: snap.usuariosObra ?? [],
        fornecedores: snap.fornecedores ?? [],
      });
    },
    /**
     * v5.22.47: hidrata o wizard a partir de uma planilha de implantação
     * importada (modelo novo R02 ou antigo R00/R01).
     *
     * Regras:
     *  - metadata: só campos NÃO-vazios da planilha sobrescrevem (campo
     *    ausente na planilha preserva o que o usuário já digitou);
     *  - coleções (grupos, concretos, usuários, fornecedores): substituem
     *    a coleção atual SOMENTE se a planilha trouxe ≥1 item — coleção
     *    vazia na planilha não apaga nada. A confirmação de substituição
     *    acontece na UI (SetupPage) antes do commit;
     *  - baseline de exemplo é limpo: conteúdo importado é conteúdo do
     *    usuário, então o envio não fica bloqueado por "exemplo intocado".
     */
    applyImportedData(
      state,
      payload: {
        metadata: Partial<Pick<ObraMetadata, 'obraNome' | 'clienteNome' | 'obraEndereco' | 'obraCEP' | 'obraObservacoes'>>;
        grupos: Grupo[];
        concretos: Concreto[];
        usuariosObra: UsuarioObra[];
        fornecedores: Fornecedor[];
      },
    ) {
      const meta = payload.metadata || {};
      (['obraNome', 'clienteNome', 'obraEndereco', 'obraCEP', 'obraObservacoes'] as const).forEach(
        (campo) => {
          const valor = meta[campo];
          if (typeof valor === 'string' && valor.trim() !== '') {
            state.metadata[campo] = valor;
          }
        },
      );
      // Modelo único (v5.22.47) — garante o layout completo mesmo se o
      // rascunho em edição veio de snapshot antigo 'comum'.
      state.metadata.modeloPreenchimento = 'modelo_projeto';
      if (payload.grupos.length) state.grupos = payload.grupos;
      if (payload.concretos.length) state.concretos = payload.concretos;
      if (payload.usuariosObra.length) state.usuariosObra = payload.usuariosObra;
      if (payload.fornecedores.length) state.fornecedores = payload.fornecedores;
      state.isDirty = true;
      state.exampleLoadedKey = null;
      state.exampleBaselineHash = null;
    },
    reset(state) {
      Object.assign(state, emptyState());
      // v5.22.19: limpa também o ponteiro "último rascunho neste navegador".
      // Sem isto, o banner de retomada continuaria reaparecendo após o
      // usuário clicar em "Limpar rascunho" e recarregar a página.
      clearLastDraftPointer();
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
    },
  },

  actions: {
    /**
     * v5.22.19 — Autosave debounce-safe.
     *
     * Chamada após cada edição (já existem 9 call sites no SetupPage).
     * Antes era no-op. Agora:
     *   1. cancela timer pendente (debounce reset)
     *   2. agenda em AUTOSAVE_DEBOUNCE_MS ms o saveDraftSilent
     *   3. saveDraftSilent NUNCA lança — falha de rede deixa só o LS fallback
     *
     * Não dispara audit log (saveDraftSilent não chama recordAudit). Sem
     * isso, 1 evento a cada 3s poluiria setup_audit_events sem agregar
     * valor. Auditoria explícita continua no saveDraft "manual"
     * (botão Salvar rascunho).
     *
     * isDirty=false e lastSavedAt são atualizados também no autosave para
     * que o indicador "Rascunho salvo" reflita o estado real sem clique.
     *
     * O ponteiro `LastDraftPointer` é gravado a cada autosave bem-sucedido
     * — é o que alimenta o banner "Continuar onde parou" no mounted().
     */
    persistDebounced({ getters, state, commit, dispatch }) {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      // Durante envio formal (loading=true) o saveDraft "manual" já está
      // rodando — não dispara autosave em cima para evitar dupla escrita.
      if (state.loading) return;

      autosaveTimer = setTimeout(async () => {
        autosaveTimer = null;
        // Re-checagem dentro do callback: se o estado mudou nos últimos 3s
        // (ex.: submit começou), aborta. saveDraftSilent dentro de submit
        // não causaria bug funcional mas geraria upsert redundante.
        if (state.loading) return;
        if (!state.isDirty) return;
        try {
          const json = (await dispatch('generateTechnicalJson')) as TechnicalJson;
          const row = await saveDraftSilentRemote(
            getters.snapshot as SetupSnapshot,
            json,
            state.draftId,
          );
          if (!row) return; // falha silenciosa — snapshot continua só local
          commit('setDraftId', row.id);
          commit('setDirty', false);
          commit('setLastSavedAt', row.updated_at);
          setLastDraftPointer({
            id: row.id,
            obraNome: row.obra_nome || state.metadata.obraNome || '',
            updatedAt: row.updated_at,
          });
        } catch {
          /* nunca deve cair aqui (saveDraftSilent é noexcept) — mas
             defesa em profundidade contra futuras alterações */
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },

    /** Geração do JSON técnico in-memory */
    generateTechnicalJson({ getters, state, commit }): TechnicalJson {
      const json = buildTechnicalJson(getters.snapshot as SetupSnapshot, {
        draftId: state.draftId,
        submissionId: state.submissionId,
      });
      commit('setTechnicalJson', json);
      return json;
    },

    /** Salvar rascunho remoto (Supabase ou localStorage fallback) */
    async saveDraft({ getters, state, commit, dispatch }) {
      commit('setLoading', true);
      commit('setError', null);
      try {
        const json = (await dispatch('generateTechnicalJson')) as TechnicalJson;
        const row = await saveDraftRemote(
          getters.snapshot as SetupSnapshot,
          json,
          state.draftId,
        );
        commit('setDraftId', row.id);
        commit('setDirty', false);
        commit('setLastSavedAt', row.updated_at);
        // v5.22.19: ponteiro do "último rascunho neste navegador". Mesmo
        // que no autosave — fonte única de verdade. Quando o usuário
        // reabrir a página, o banner usa este ponteiro.
        setLastDraftPointer({
          id: row.id,
          obraNome: row.obra_nome || state.metadata.obraNome || '',
          updatedAt: row.updated_at,
        });
        await recordAudit(
          {
            actor: state.metadata.createdBy.email || 'usuario_demo',
            action: 'setup.draft.saved',
            entity: 'SetupDraft',
            after: { id: row.id, obraNome: row.obra_nome },
          },
          { draftId: row.id },
        );
        return row;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        commit('setError', msg);
        throw err;
      } finally {
        commit('setLoading', false);
      }
    },

    /** Carregar rascunho remoto */
    async loadDraft({ commit, state }, id: string) {
      commit('setLoading', true);
      commit('setError', null);
      try {
        const row = await loadDraftRemote(id);
        if (!row) {
          commit('setError', `Rascunho ${id} não encontrado.`);
          return null;
        }
        commit('replaceSnapshot', row.snapshot);
        commit('setDraftId', row.id);
        commit('setTechnicalJson', row.technical_json ?? null);
        commit('setLastSavedAt', row.updated_at);
        // v5.22.19: atualiza ponteiro — recarregar conta como "tocar".
        setLastDraftPointer({
          id: row.id,
          obraNome: row.obra_nome || state.metadata.obraNome || '',
          updatedAt: row.updated_at,
        });
        await recordAudit(
          {
            actor: state.metadata.createdBy.email || 'usuario_demo',
            action: 'setup.draft.loaded',
            entity: 'SetupDraft',
            after: { id: row.id },
          },
          { draftId: row.id },
        );
        return row;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        commit('setError', msg);
        throw err;
      } finally {
        commit('setLoading', false);
      }
    },

    /**
     * Envio para validação (v5.20):
     *   1. valida (gera JSON técnico + bloqueia se houver erros)
     *   2. chama Edge Function `submit-for-validation` via ticketService
     *   3. guarda o ticket no state (modal lê daqui)
     *   4. atualiza protocolo + status + audit local
     *
     * Idempotência: a action checa `state.loading` antes — UI já desabilita
     * o botão durante a request mas reforça aqui.
     */
    async submit({ state, dispatch, commit, getters }) {
      if (state.loading) {
        throw new Error('submit_in_progress');
      }
      commit('setLoading', true);
      commit('setError', null);
      try {
        // v5.22.4: bloqueia envio se usuário carregou exemplo e não editou
        if (getters.isExampleUnchanged) {
          throw new Error(
            'Edite ao menos um campo antes de enviar. Você carregou um exemplo, mas precisa personalizar os dados da sua obra.',
          );
        }

        let json = (await dispatch('generateTechnicalJson')) as TechnicalJson;
        if (json.validation.bloqueantes.length) {
          throw new Error(
            `Envio bloqueado: corrija ${json.validation.bloqueantes.length} erro(s).`,
          );
        }

        // V8: a Edge Function aceita o draftId somente acompanhado do token
        // de posse. Persiste o snapshot final antes do submit para garantir
        // que id/token existem e que o banco nunca associa uma submissão a
        // um rascunho arbitrário informado pelo cliente.
        const previousDraftId = state.draftId;
        let persisted = await saveDraftRemote(
          getters.snapshot as SetupSnapshot,
          json,
          previousDraftId,
        );
        commit('setDraftId', persisted.id);
        commit('setDirty', false);
        commit('setLastSavedAt', persisted.updated_at);
        setLastDraftPointer({
          id: persisted.id,
          obraNome: persisted.obra_nome || state.metadata.obraNome || '',
          updatedAt: persisted.updated_at,
        });

        // Se o rascunho ganhou novo UUID (primeiro save ou migração de id
        // legado), regenera o JSON técnico para gravar o draftId correto.
        if (persisted.id !== previousDraftId) {
          json = (await dispatch('generateTechnicalJson')) as TechnicalJson;
          persisted = await saveDraftRemote(
            getters.snapshot as SetupSnapshot,
            json,
            persisted.id,
          );
          commit('setLastSavedAt', persisted.updated_at);
        }

        const ticket = await submitForValidationViaEdge({
          draftId: persisted.id,
          technicalJson: json,
          clientMessage: state.clientMessage,
        });

        commit('setCurrentTicket', ticket);
        commit('setSubmissionId', ticket.submission_id);
        commit('setProtocolo', ticket.ticket_number);
        commit('setStatus', 'enviado_validacao');
        commit('addAuditLocal', {
          actor: state.metadata.createdBy.email || 'usuario_demo',
          acao: 'enviado_validacao',
          after: {
            ticket_number: ticket.ticket_number,
            email_sent_to: ticket.email_sent_to,
            email_cc: ticket.email_cc,
            email_error: ticket.email_error,
          },
        });

        await recordAudit(
          {
            actor: state.metadata.createdBy.email || 'usuario_demo',
            action: 'setup.submission.created',
            entity: 'SetupSubmission',
            after: {
              ticket_number: ticket.ticket_number,
              submission_id: ticket.submission_id,
            },
          },
          { draftId: state.draftId, submissionId: ticket.submission_id },
        ).catch(() => undefined); // audit é best-effort, não bloqueia UX

        return ticket;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        commit('setError', msg);
        throw err;
      } finally {
        commit('setLoading', false);
      }
    },
  },
};

export default setupModule;
