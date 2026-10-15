/**
 * Modelos do JSON técnico v5 — mantém forma estável (metadata, customerInput,
 * normalizedStructure, technicalMapping, validation, renderTree, audit)
 * mesmo quando o customerInput agora vem do modelo "Grupo + Peça" do
 * protótipo HTML.
 *
 * Termos técnicos só aparecem aqui — nunca na interface principal.
 */

import type {
  Concreto,
  Grupo,
  ObraMetadata,
  TipoEstruturaModelo,
  AuditLocalEvent,
  SetupSnapshot,
  UsuarioObra,
  Fornecedor,
} from './setup.models';
import type { ValidationIssue, ValidationResult } from './validation.models';

/* ------------------------------------------------------------------ */
/* customerInput                                                       */
/* ------------------------------------------------------------------ */

export interface CustomerInputSnapshot {
  dadosBasicos: ObraMetadata;
  tipoEstrutura: TipoEstruturaModelo;
  grupos: Grupo[];
  concretos: Concreto[];
  mode: 'estruturas';
  projectDesignerFreeText: true;
  structureTypeOptions: readonly string[];
  /** v5.22.6: usuários cadastrados para acesso à obra. */
  usuariosObra?: UsuarioObra[];
  /** v5.22.7: fornecedores cadastrados (usinas + laboratórios). */
  fornecedores?: Fornecedor[];
}

/* ------------------------------------------------------------------ */
/* normalizedStructure                                                 */
/* ------------------------------------------------------------------ */

export interface NormalizedGroup {
  id: string;
  nome: string;
  tipoEdificacao: string;
  projetista: string;
}

export interface NormalizedItem {
  id: string;
  nome: string;
  ordem: number;
  grupoId: string;
  fck: number | null;
  volume: number | null;
  etapa: string;
}

export interface NormalizedStructure {
  groups: NormalizedGroup[];
  items: NormalizedItem[];
}

/* ------------------------------------------------------------------ */
/* technicalMapping                                                    */
/* ------------------------------------------------------------------ */

export interface UnidadeGrupoMap {
  tempId: string;
  nome: string;
  tipoEdificacao: string;
  projetista: string;
  ordem: number;
  customerInputRef: string;
}

export interface UnidadeTipoMap {
  tempId: string;
  descricao: string;
  fckProjeto: number | null;
  volumeProjeto: number | null;
  classificacaoId: number;
  concretoId?: number;
  croquiObrigatorio: boolean;
  formaObrigatorio: boolean;
  apareceNoDashboard: boolean;
  permiteUnidadeAdicional: boolean;
  mostrarLegendaMapa: boolean;
  localAplicacaoSelecionadoPorEntrega: boolean;
  percentualOverbreak?: number;
  centroDeCustoId?: number;
  produtoIndicadoId?: number;
}

export interface UnidadeMap {
  tempId: string;
  descricao: string;
  ordem: number;
  unidadeGrupoTempId: string;
  unidadeTipoTempId: string;
}

export interface VinculoConcretoMap {
  unidadeTipoTempId: string;
  concretoId: number;
  aplicacao: string;
}

export interface TechnicalMapping {
  unidadeGrupos: UnidadeGrupoMap[];
  unidadeTipos: UnidadeTipoMap[];
  unidades: UnidadeMap[];
  vinculosConcreto: VinculoConcretoMap[];
}

/* ------------------------------------------------------------------ */
/* renderTree (para Etapa 6: árvore e pilhas)                          */
/* ------------------------------------------------------------------ */

export type RenderChildStatus = 'ok' | 'pendente' | 'erro';

export interface RenderChildNode {
  id: string;
  label: string;
  etapa: string;
  fck: number | null;
  volume: number | null;
  status: RenderChildStatus;
  unidadeTipoTempId: string;
}

export interface RenderGroupNode {
  id: string;
  label: string;
  type: 'estrutura';
  children: RenderChildNode[];
}

export interface RenderTree {
  nodes: RenderGroupNode[];
}

/* ------------------------------------------------------------------ */
/* metadata do JSON técnico                                            */
/* ------------------------------------------------------------------ */

export interface TechnicalMetadata extends ObraMetadata {
  generatedAt: string;
  generatedBy: string;
  source: string;
  environment: string;
  projectName: string;
  projectVersion: string;
  tenantHint: string | null;
  draftId: string | null;
  submissionId: string | null;
}

/* ------------------------------------------------------------------ */
/* JSON técnico raiz                                                   */
/* ------------------------------------------------------------------ */

export interface TechnicalJson {
  metadata: TechnicalMetadata;
  customerInput: CustomerInputSnapshot;
  normalizedStructure: NormalizedStructure;
  technicalMapping: TechnicalMapping;
  validation: {
    summary: ValidationResult;
    issues: ValidationIssue[];
    bloqueantes: ValidationIssue[];
    alertas: ValidationIssue[];
    sugestoes: ValidationIssue[];
    pendenciasInternas: ValidationIssue[];
  };
  renderTree: RenderTree;
  audit: AuditLocalEvent[];
}

/* ------------------------------------------------------------------ */
/* Helpers de mapeamento etapa <-> classificacaoId                     */
/* ------------------------------------------------------------------ */

export const ETAPA_TO_CLASSIFICACAO_ID: Record<string, number> = {
  Fundação: 1,
  Infraestrutura: 2,
  Estrutura: 3,
  Contenção: 4,
  Anexos: 5,
};

export function etapaToId(etapa: string): number {
  return ETAPA_TO_CLASSIFICACAO_ID[etapa] ?? 3;
}

export function idToEtapa(id: number): string {
  return (
    Object.entries(ETAPA_TO_CLASSIFICACAO_ID).find(([, v]) => v === id)?.[0] ??
    'Estrutura'
  );
}

/* re-exports para conveniência */
export type { SetupSnapshot };
