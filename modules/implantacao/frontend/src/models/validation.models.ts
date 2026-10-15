/**
 * Modelo de validação v5.
 *
 * Mantém o padrão estruturado v4
 *   { code, severity, message, path, entityTemporaryId, suggestedFix }
 * e expõe os 4 buckets do protótipo HTML
 *   { bloqueantes, alertas, sugestoes, pendenciasInternas }.
 *
 * Erros bloqueiam envio para validação.
 * Avisos permitem envio com confirmação.
 * Sugestões e pendências internas são apenas orientações.
 */

export type Severity = 'error' | 'warning' | 'info' | 'pending';

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  /** ex.: 'grupos[2].pecas[1].fck' */
  path: string;
  /** localização legível (nome do grupo, peça, etapa) — vem do protótipo */
  localizacao?: string | null;
  /** temporaryId da entidade alvo */
  entityTemporaryId?: string | null;
  /** sugestão de correção em PT-BR */
  suggestedFix?: string | null;
  /** classificação do protótipo: 'bloqueante' | 'alerta' | 'sugestao' | 'pendenciaInterna' */
  bucket: 'bloqueante' | 'alerta' | 'sugestao' | 'pendenciaInterna';
  /** campo (ex.: 'volume') usado pelo protótipo */
  campo?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  pendingCount: number;
  blocking: boolean;
}

export const VALIDATION_CODES = {
  /* Obra */
  OBRA_SEM_NOME:               'VAL-OBRA-001',
  OBRA_SEM_CLIENTE:            'VAL-OBRA-002',
  OBRA_SEM_GRUPOS:             'VAL-OBRA-003',
  OBRA_SEM_PECAS:              'VAL-OBRA-004',

  /* Grupos */
  GRUPO_SEM_NUMERO:            'VAL-GRP-001',
  GRUPO_DUPLICADO:             'VAL-GRP-002',
  GRUPO_DUPLICATA_ZERO:        'VAL-GRP-003',
  GRUPO_SIMILAR_OUTRO:         'VAL-GRP-004',

  /* Peças */
  PECA_SEM_DESCRICAO:          'VAL-PEC-001',
  PECA_FCK_INVALIDO:           'VAL-PEC-002',
  PECA_VOLUME_AUSENTE:         'VAL-PEC-003',
  PECA_VOLUME_ALTO:            'VAL-PEC-004',
  PECA_SEM_CONCRETO:           'VAL-PEC-005',
} as const;

export type ValidationCode = (typeof VALIDATION_CODES)[keyof typeof VALIDATION_CODES];
