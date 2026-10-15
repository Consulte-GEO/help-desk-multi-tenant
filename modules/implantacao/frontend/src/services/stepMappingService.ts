/**
 * Serviço centralizado de mapeamento entre `path` (do ValidationIssue)
 * e a etapa atual do wizard.
 *
 * ──────────────────────────────────────────────────────────────────────
 * v5.22.25 — POR QUE ESTE ARQUIVO EXISTE
 *
 * Histórico:
 *  - Até v5.22.11 o wizard tinha 8 etapas (cliente). A Etapa 2 era
 *    "Tipo de estrutura" e a Etapa 3 era "Blocos e torres".
 *  - v5.22.11 fundiu o switch de Modelo de Preenchimento no topo da
 *    Etapa 3 e removeu a Etapa 2. O número da etapa de cada Step caiu
 *    em 1 (Blocos → 2, Concretos → 3, Peças → 4, Usuários → 5,
 *    Fornecedores → 6, Revisão → 7).
 *  - O `validationService.ts` continuou produzindo strings literais
 *    como `localizacao: 'Etapa 3'` para grupos (que hoje são Etapa 2),
 *    `'Etapa 6'` para usuários (Etapa 5) e `'Etapa 7'` para
 *    fornecedores (Etapa 6). Essas labels apareciam direto no Painel
 *    de Pendências, no Step8Preview e no Excel técnico.
 *  - O `PendenciasPanel` contornou parcialmente o problema (v5.22.20+)
 *    usando `path` como fonte de verdade e reescrevendo o label;
 *    Step8Preview e Excel não tinham essa proteção e mostravam números
 *    errados ao usuário.
 *
 * v5.22.25 resolve direto na fonte: o `validationService` passa a
 * usar `localizacaoForPath(path)` em vez de strings literais, e o
 * PendenciasPanel reusa `pathToStep` daqui em vez de duplicar a função.
 *
 * Resultado:
 *  - Uma única tabela de mapeamento. Quando o wizard mudar de novo,
 *    só este arquivo precisa de ajuste.
 *  - Step8Preview, PendenciasPanel e Excel técnico passam a mostrar
 *    sempre o número e o título correto da etapa.
 *  - `localizacao` agora inclui o título legível ("Etapa 2 · Blocos e
 *    torres") em vez de só o número, melhorando UX e legibilidade do
 *    Excel exportado.
 * ──────────────────────────────────────────────────────────────────────
 */

import { WIZARD_STEPS } from '../models/setup.models';

/**
 * Tabela path → ID da etapa.
 *
 * Ordem importa: padrões mais específicos primeiro (peças compartilham
 * prefixo `grupos` com grupos genéricos, então peças aparecem antes).
 *
 * Cada entrada tem um teste de regex sobre o path. O primeiro match
 * vence.
 */
const PATH_RULES: Array<{ matches: RegExp; stepId: number }> = [
  // metadata.* — Dados básicos (Etapa 1)
  { matches: /^metadata\./, stepId: 1 },

  // grupos[*].pecas.* — Pavimentos e peças (Etapa 4) — ANTES de grupos genérico
  { matches: /^grupos(\[[^\]]*\])?\.pecas/, stepId: 4 },

  // grupos / grupos[*].* — Blocos e torres (Etapa 2)
  { matches: /^grupos/, stepId: 2 },

  // concretos.* — Concretos (Etapa 3)
  { matches: /^concretos/, stepId: 3 },

  // usuariosObra.* — Usuários da obra (Etapa 5)
  { matches: /^usuariosObra/, stepId: 5 },

  // fornecedores.* — Fornecedores (Etapa 6)
  { matches: /^fornecedores/, stepId: 6 },
];

/**
 * Mapeia o `path` de um ValidationIssue para o ID da etapa onde o
 * usuário deve corrigir o problema. Fallback defensivo: Etapa 1
 * (nunca deveria acontecer se as regras cobrirem todos os paths).
 *
 * @param path Ex.: "grupos[0].pecas[1].fck", "metadata.obraNome"
 * @returns ID da etapa (1–7)
 */
export function pathToStep(path: string): number {
  for (const rule of PATH_RULES) {
    if (rule.matches.test(path)) return rule.stepId;
  }
  return 1;
}

/**
 * Retorna o título da etapa (ex.: "Blocos e torres"). Lê direto de
 * `WIZARD_STEPS` para garantir consistência com o wizard renderizado.
 * Se o stepId for inválido (não deveria), devolve "Etapa N" como
 * último recurso.
 */
export function stepTitle(stepId: number): string {
  const step = WIZARD_STEPS.find((s) => s.id === stepId);
  return step?.title ?? `Etapa ${stepId}`;
}

/**
 * Retorna a `localizacao` padrão a partir do `path` do issue.
 * Formato: "Etapa N · Título". Ex.: "Etapa 2 · Blocos e torres".
 *
 * Para issues onde já há um contexto melhor (nome do grupo, nome da
 * peça, tipo da estrutura), o validationService passa esse texto
 * diretamente em vez de chamar este helper — preserva legibilidade
 * para o usuário.
 */
export function localizacaoForPath(path: string): string {
  const stepId = pathToStep(path);
  return `Etapa ${stepId} · ${stepTitle(stepId)}`;
}
