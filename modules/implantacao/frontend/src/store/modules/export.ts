/**
 * Vuex module: export · v5.16
 *
 * Exportação técnica (JSON, Excel) e cópia para clipboard, com auditoria.
 *
 * v5.16: `excelExportService` agora é carregado via dynamic import só nas
 * actions que precisam dele (exportExcel, buildExcelWorkbook). Isso tira
 * o código de exportação do bundle inicial — o serviço e o gravador XLSX
 * interno ficam em um chunk assíncrono que só baixa quando o usuário interage
 * com export. O `preloadXlsx()` do warm-up na
 * Etapa 6 (em SetupPage.vue) continua disparando o download cedo.
 */

import type { Module } from 'vuex';
import type { TechnicalJson } from '../../models/technicalMapping.models';
import type { SetupSnapshot } from '../../models/setup.models';
import { recordAudit } from '../../services/setupAuditService';
import { recordExport } from '../../services/setupExportService';
import { buildGeoControlePayload, buildGeoControleFilename } from '../../services/geoControleExportService';

/**
 * Lazy loader do excelExportService. Memoiza a Promise para reaproveitar
 * o módulo já carregado em chamadas subsequentes (mesmo padrão do
 * loadXlsx interno de excelExportService.ts).
 */
type ExcelModule = typeof import('../../services/excelExportService');
let excelModulePromise: Promise<ExcelModule> | null = null;
function loadExcelModule(): Promise<ExcelModule> {
  if (!excelModulePromise) {
    excelModulePromise = import('../../services/excelExportService');
  }
  return excelModulePromise;
}

export interface ExportState {
  lastJsonExportAt: string | null;
  lastExcelExportAt: string | null;
  lastCopyAt: string | null;
  lastFeedback: string;
}

function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

const exportModule: Module<ExportState, unknown> = {
  namespaced: true,
  state: () => ({
    lastJsonExportAt: null,
    lastExcelExportAt: null,
    lastCopyAt: null,
    lastFeedback: '',
  }),
  mutations: {
    setJsonAt(state, iso: string) {
      state.lastJsonExportAt = iso;
    },
    setExcelAt(state, iso: string) {
      state.lastExcelExportAt = iso;
    },
    setCopyAt(state, iso: string) {
      state.lastCopyAt = iso;
    },
    setFeedback(state, msg: string) {
      state.lastFeedback = msg;
    },
  },
  actions: {
    async exportJson(
      { commit },
      payload: {
        json: TechnicalJson;
        draftId: string | null;
        submissionId: string | null;
      },
    ) {
      const { json, draftId, submissionId } = payload;
      const codigo = (json.customerInput.dadosBasicos.obraNome || 'sem-nome')
        .toString()
        .trim()
        .replace(/[^A-Za-z0-9-]+/g, '-');
      const filename = `implantacao-consulte-geo-${codigo}-${new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .slice(0, 16)}.json`;
      const str = JSON.stringify(json, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      downloadBlob(blob, filename);
      const iso = new Date().toISOString();
      commit('setJsonAt', iso);
      commit('setFeedback', `JSON técnico exportado como ${filename}.`);
      await recordExport({
        draftId,
        submissionId,
        kind: 'json',
        filename,
        sizeBytes: blob.size,
      });
      await recordAudit(
        {
          actor: 'user',
          action: 'setup.export.json',
          entity: 'TechnicalJson',
          after: { filename, sizeBytes: blob.size },
        },
        { draftId, submissionId },
      );
      return filename;
    },
    /**
     * Exporta o JSON do GEO Controle Tecnológico (payload do contrato
     * `criar_obra`). É o arquivo que o produto importa em "Nova obra → Importar
     * JSON" para pré-implantar a obra (com a trilha do projetista).
     */
    async exportGeoControle(
      { commit },
      payload: {
        snapshot: SetupSnapshot;
        draftId: string | null;
        submissionId: string | null;
      },
    ) {
      const { snapshot, draftId, submissionId } = payload;
      const geo = buildGeoControlePayload(snapshot, { draftId, submissionId });
      const filename = buildGeoControleFilename(snapshot);
      const str = JSON.stringify(geo, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      downloadBlob(blob, filename);
      const iso = new Date().toISOString();
      commit('setJsonAt', iso);
      commit('setFeedback', `JSON do GEO Controle exportado como ${filename} (${geo.meta.counts.grupos} estruturas, ${geo.meta.counts.projetistas} projetista(s)).`);
      await recordExport({ draftId, submissionId, kind: 'json', filename, sizeBytes: blob.size });
      await recordAudit(
        {
          actor: 'user',
          action: 'setup.export.geo-controle',
          entity: 'GeoControlePayload',
          after: { filename, sizeBytes: blob.size, counts: geo.meta.counts },
        },
        { draftId, submissionId },
      );
      return filename;
    },
    async copyGeoControle(
      { commit },
      payload: {
        snapshot: SetupSnapshot;
        draftId: string | null;
        submissionId: string | null;
      },
    ) {
      const geo = buildGeoControlePayload(payload.snapshot, {
        draftId: payload.draftId,
        submissionId: payload.submissionId,
      });
      const str = JSON.stringify(geo, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
      } else {
        const ta = document.createElement('textarea');
        ta.value = str;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const iso = new Date().toISOString();
      commit('setCopyAt', iso);
      commit('setFeedback', `JSON do GEO Controle (${str.length} caracteres) copiado para a área de transferência.`);
      await recordAudit(
        {
          actor: 'user',
          action: 'setup.export.geo-controle.copy',
          entity: 'GeoControlePayload',
          after: { length: str.length },
        },
        { draftId: payload.draftId, submissionId: payload.submissionId },
      );
      return str.length;
    },
    async exportExcel(      { commit },
      payload: {
        json: TechnicalJson;
        draftId: string | null;
        submissionId: string | null;
      },
    ) {
      const { exportTechnicalWorkbook } = await loadExcelModule();
      const filename = await exportTechnicalWorkbook(payload.json);
      const iso = new Date().toISOString();
      commit('setExcelAt', iso);
      commit('setFeedback', `Planilha Excel exportada como ${filename}.`);
      await recordExport({
        draftId: payload.draftId,
        submissionId: payload.submissionId,
        kind: 'excel',
        filename,
      });
      await recordAudit(
        {
          actor: 'user',
          action: 'setup.export.excel',
          entity: 'TechnicalJson',
          after: { filename },
        },
        { draftId: payload.draftId, submissionId: payload.submissionId },
      );
      return filename;
    },
    async buildExcelWorkbook(_ctx, json: TechnicalJson) {
      const { buildWorkbook, buildWorkbookFilename } = await loadExcelModule();
      const workbook = await buildWorkbook(json);
      return { workbook, filename: buildWorkbookFilename(json) };
    },
    async copyJson(
      { commit },
      payload: {
        json: TechnicalJson;
        draftId: string | null;
        submissionId: string | null;
      },
    ) {
      const str = JSON.stringify(payload.json, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
      } else {
        const ta = document.createElement('textarea');
        ta.value = str;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const iso = new Date().toISOString();
      commit('setCopyAt', iso);
      commit('setFeedback', `JSON técnico (${str.length} caracteres) copiado para a área de transferência.`);
      await recordAudit(
        {
          actor: 'user',
          action: 'setup.export.copy',
          entity: 'TechnicalJson',
          after: { length: str.length },
        },
        { draftId: payload.draftId, submissionId: payload.submissionId },
      );
      return str.length;
    },
  },
};

export default exportModule;
