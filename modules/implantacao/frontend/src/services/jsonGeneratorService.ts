/**
 * Gerador do JSON técnico · v5
 *
 * Réplica de `buildPayload()` do protótipo HTML, com 7 seções:
 *  metadata · customerInput · normalizedStructure · technicalMapping
 *  · validation · renderTree · audit
 *
 * O JSON é o contrato de saída — estável para o protótipo Supabase e para o
 * backend oficial .NET 8 + SQL Server.
 */

import {
  TIPO_ESTRUTURA_MODELO_PROJETO,
  cryptoUid,
  type Grupo,
  type SetupSnapshot,
} from '../models/setup.models';
import type {
  CustomerInputSnapshot,
  NormalizedItem,
  NormalizedStructure,
  RenderChildNode,
  RenderGroupNode,
  RenderTree,
  TechnicalJson,
  TechnicalMapping,
  TechnicalMetadata,
  UnidadeGrupoMap,
  UnidadeMap,
  UnidadeTipoMap,
} from '../models/technicalMapping.models';
import { etapaToId } from '../models/technicalMapping.models';
import {
  expandRange,
  formatGroupName,
  normalizeText,
  orderOf,
  parseFck,
  parseVolume,
} from './normalizationService';
import { validateSnapshot } from './validationService';
import type { ValidationIssue, Severity } from '../models/validation.models';

export interface GenerateOptions {
  draftId?: string | null;
  submissionId?: string | null;
  generatedBy?: string;
  environment?: string;
  tenantHint?: string | null;
  projectVersion?: string;
}

const SCHEMA_VERSION = '5.0.0';

/* ------------------------------------------------------------------ */
/* expansion helper (preserva contrato do HTML)                        */
/* ------------------------------------------------------------------ */

export function getExpandedGroupNames(grupo: Grupo): string[] {
  const expanded = expandRange(grupo.edificacoesInput);
  if (expanded.length) {
    return expanded.map((n) => formatGroupName(grupo.nome, n, grupo.tipoEdificacao));
  }
  return grupo.nome ? [grupo.nome] : [];
}

function statusForPeca(peca: { local: string; fck: unknown; volume: unknown; concretoId: unknown }): 'ok' | 'pendente' | 'erro' {
  if (!parseFck(peca.fck) || !peca.local) return 'erro';
  if (!peca.volume || !peca.concretoId) return 'pendente';
  return 'ok';
}

/* ------------------------------------------------------------------ */
/* entrada pública                                                     */
/* ------------------------------------------------------------------ */

export function buildTechnicalJson(
  snapshot: SetupSnapshot,
  options: GenerateOptions = {},
): TechnicalJson {
  const generatedAt = new Date().toISOString();

  /* validação --------------------------------------------------------- */
  const v = validateSnapshot(snapshot);

  /* normalized structure + technical mapping ------------------------ */
  const unidadeGrupos: UnidadeGrupoMap[] = [];
  const unidadeTipos: UnidadeTipoMap[] = [];
  const unidades: UnidadeMap[] = [];
  const renderNodes: RenderGroupNode[] = [];
  const tipoBySignature = new Map<string, string>();

  snapshot.grupos.forEach((grupo) => {
    const groupNames = getExpandedGroupNames(grupo);
    groupNames.forEach((name) => {
      const ugTempId = cryptoUid('ug');
      unidadeGrupos.push({
        tempId: ugTempId,
        nome: name,
        tipoEdificacao: String(grupo.tipoEdificacao),
        projetista: grupo.projetista,
        ordem: unidadeGrupos.length + 1,
        customerInputRef: grupo.id,
      });
      const children: RenderChildNode[] = [];

      grupo.pecas.forEach((peca) => {
        const fck = parseFck(peca.fck);
        const volume = parseVolume(peca.volume);
        const signature = `${normalizeText(peca.local)}|${fck}|${volume ?? ''}|${normalizeText(String(peca.etapa))}`;

        let unidadeTipoTempId = tipoBySignature.get(signature);
        if (!unidadeTipoTempId) {
          unidadeTipoTempId = cryptoUid('ut');
          tipoBySignature.set(signature, unidadeTipoTempId);
          unidadeTipos.push({
            tempId: unidadeTipoTempId,
            descricao: peca.local,
            fckProjeto: fck,
            volumeProjeto: volume,
            classificacaoId: etapaToId(String(peca.etapa)),
            concretoId: peca.concretoId ? maybeNumber(peca.concretoId) : undefined,
            croquiObrigatorio: true,
            formaObrigatorio: false,
            apareceNoDashboard: true,
            permiteUnidadeAdicional: false,
            mostrarLegendaMapa: true,
            localAplicacaoSelecionadoPorEntrega: false,
          });
        }

        const unidadeTempId = cryptoUid('un');
        unidades.push({
          tempId: unidadeTempId,
          descricao: peca.local,
          ordem: orderOf(peca.local),
          unidadeGrupoTempId: ugTempId,
          unidadeTipoTempId,
        });

        children.push({
          id: unidadeTempId,
          label: peca.local,
          etapa: String(peca.etapa),
          fck,
          volume,
          status: statusForPeca(peca),
          unidadeTipoTempId,
        });
      });

      renderNodes.push({
        id: ugTempId,
        label: name,
        type: 'estrutura',
        children,
      });
    });
  });

  const vinculosConcreto = unidadeTipos
    .filter((t) => t.concretoId)
    .map((t) => ({
      unidadeTipoTempId: t.tempId,
      concretoId: t.concretoId as number,
      aplicacao: t.descricao,
    }));

  const technicalMapping: TechnicalMapping = {
    unidadeGrupos,
    unidadeTipos,
    unidades,
    vinculosConcreto,
  };

  /* normalized structure -------------------------------------------- */
  const normalizedItems: NormalizedItem[] = unidades.map((u) => {
    const tipo = unidadeTipos.find((t) => t.tempId === u.unidadeTipoTempId);
    return {
      id: u.tempId,
      nome: u.descricao,
      ordem: u.ordem,
      grupoId: u.unidadeGrupoTempId,
      fck: tipo?.fckProjeto ?? null,
      volume: tipo?.volumeProjeto ?? null,
      etapa: tipo
        ? Object.entries({
            1: 'Fundação',
            2: 'Infraestrutura',
            3: 'Estrutura',
            4: 'Contenção',
            5: 'Anexos',
            6: 'Estrutura',
          }).find(([id]) => Number(id) === tipo.classificacaoId)?.[1] ?? 'Estrutura'
        : 'Estrutura',
    };
  });

  const normalizedStructure: NormalizedStructure = {
    groups: unidadeGrupos.map((g) => ({
      id: g.tempId,
      nome: g.nome,
      tipoEdificacao: g.tipoEdificacao,
      projetista: g.projetista,
    })),
    items: normalizedItems,
  };

  /* customerInput --------------------------------------------------- */
  const customerInput: CustomerInputSnapshot = {
    dadosBasicos: snapshot.metadata,
    tipoEstrutura: snapshot.tipoEstrutura,
    grupos: snapshot.grupos,
    concretos: snapshot.concretos,
    mode: 'estruturas',
    projectDesignerFreeText: true,
    structureTypeOptions: TIPO_ESTRUTURA_MODELO_PROJETO,
    // v5.22.6: usuários da obra preservados no JSON técnico
    usuariosObra: snapshot.usuariosObra ?? [],
    // v5.22.7: fornecedores (usinas + laboratórios) preservados no JSON técnico
    fornecedores: snapshot.fornecedores ?? [],
  };

  /* renderTree ------------------------------------------------------ */
  const renderTree: RenderTree = { nodes: renderNodes };

  /* metadata -------------------------------------------------------- */
  const metadata: TechnicalMetadata = {
    ...snapshot.metadata,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: generatedAt,
    generatedAt,
    generatedBy: options.generatedBy ?? snapshot.metadata.createdBy.email ?? 'frontend-setup',
    source: 'cadastro-simplificado-estrutura',
    environment: options.environment ?? 'preview',
    projectName: 'Implantação Consulte GEO',
    projectVersion: options.projectVersion ?? 'v5',
    tenantHint: options.tenantHint ?? null,
    draftId: options.draftId ?? null,
    submissionId: options.submissionId ?? null,
  };

  return {
    metadata,
    customerInput,
    normalizedStructure,
    technicalMapping,
    validation: {
      summary: v,
      issues: v.issues,
      bloqueantes: v.bloqueantes,
      alertas: v.alertas,
      sugestoes: v.sugestoes,
      pendenciasInternas: v.pendenciasInternas,
    },
    renderTree,
    audit: snapshot.audit,
  };
}

function maybeNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Severity helper exposto para componentes (mapeia bucket → badge). */
export function severityToBadge(s: Severity): 'success' | 'warning' | 'danger' | 'info' {
  switch (s) {
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'pending':
      return 'info';
    default:
      return 'info';
  }
}

export function issuesToBadgeKind(issues: ValidationIssue[]): 'success' | 'warning' | 'danger' | 'info' {
  if (issues.some((i) => i.severity === 'error')) return 'danger';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  if (issues.length) return 'info';
  return 'success';
}
