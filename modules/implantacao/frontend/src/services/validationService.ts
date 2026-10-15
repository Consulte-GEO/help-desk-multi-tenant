/**
 * Serviço de validação · v5
 *
 * Réplica de `validateState()` do protótipo HTML:
 *  - bloqueantes (error)         → impedem envio
 *  - alertas (warning)           → permitem envio com confirmação
 *  - sugestoes (info)            → apenas orientações
 *  - pendenciasInternas (pending) → revisão interna Consulte GEO
 */

import type { Grupo, SetupSnapshot } from '../models/setup.models';
import type {
  Severity,
  ValidationIssue,
  ValidationResult,
} from '../models/validation.models';
import { VALIDATION_CODES } from '../models/validation.models';
import {
  expandRange,
  formatGroupName,
  normalizeText,
  parseFck,
  parseVolume,
  volumeHasTooManyDecimals,
  isValidCNPJ,
} from './normalizationService';
// v5.22.25 — mapeamento centralizado path → etapa. Substitui literais
// "Etapa N" obsoletas que ainda mostravam números pré-v5.22.11.
import { localizacaoForPath } from './stepMappingService';

function issue(
  code: string,
  severity: Severity,
  bucket: ValidationIssue['bucket'],
  message: string,
  path: string,
  extra: Partial<Pick<ValidationIssue,
    'localizacao' | 'entityTemporaryId' | 'suggestedFix' | 'campo'
  >> = {},
): ValidationIssue {
  return {
    code,
    severity,
    bucket,
    message,
    path,
    localizacao: extra.localizacao ?? null,
    entityTemporaryId: extra.entityTemporaryId ?? null,
    suggestedFix: extra.suggestedFix ?? null,
    campo: extra.campo,
  };
}

export interface ValidationBuckets extends ValidationResult {
  bloqueantes: ValidationIssue[];
  alertas: ValidationIssue[];
  sugestoes: ValidationIssue[];
  pendenciasInternas: ValidationIssue[];
}

export function validateSnapshot(snapshot: SetupSnapshot): ValidationBuckets {
  const bloqueantes: ValidationIssue[] = [];
  const alertas: ValidationIssue[] = [];
  const sugestoes: ValidationIssue[] = [];
  const pendenciasInternas: ValidationIssue[] = [];

  /* --- Obra (Etapa 1 · Dados básicos) ------------------------------ */
  if (!snapshot.metadata.obraNome?.trim()) {
    bloqueantes.push(
      issue(
        VALIDATION_CODES.OBRA_SEM_NOME,
        'error',
        'bloqueante',
        'Informe o nome da obra.',
        'metadata.obraNome',
        { localizacao: localizacaoForPath('metadata.obraNome'), campo: 'obraNome' },
      ),
    );
  }

  /* --- Grupos / peças ---------------------------------------------- */
  if (!snapshot.grupos.length) {
    bloqueantes.push(
      issue(
        VALIDATION_CODES.OBRA_SEM_GRUPOS,
        'error',
        'bloqueante',
        'Cadastre pelo menos um bloco, torre ou estrutura.',
        'grupos',
        { localizacao: localizacaoForPath('grupos'), campo: 'blocos' },
      ),
    );
  }
  if (!snapshot.grupos.some((g) => g.pecas.length)) {
    bloqueantes.push(
      issue(
        VALIDATION_CODES.OBRA_SEM_PECAS,
        'error',
        'bloqueante',
        'Cadastre pelo menos uma peça ou pavimento.',
        'grupos[*].pecas',
        { localizacao: localizacaoForPath('grupos[*].pecas'), campo: 'pecas' },
      ),
    );
  }

  const allNames: Array<{ raw: string; normalized: string }> = [];
  snapshot.grupos.forEach((grupo, gi) => {
    const expanded = expandRange(grupo.edificacoesInput);
    const expandedNames = expandedToGroupNames(grupo, expanded);

    if (!expandedNames.length && snapshot.metadata.modeloPreenchimento === 'comum') {
      bloqueantes.push(
        issue(
          VALIDATION_CODES.GRUPO_SEM_NUMERO,
          'error',
          'bloqueante',
          'Informe quais blocos, torres ou estruturas fazem parte deste grupo.',
          `grupos[${gi}]`,
          {
            localizacao: grupo.nome || `Grupo ${gi + 1}`,
            entityTemporaryId: grupo.id,
            suggestedFix: 'Ex.: 1 a 4 ou Torre A, Torre B',
          },
        ),
      );
    }
    expandedNames.forEach((name) =>
      allNames.push({ raw: name, normalized: normalizeText(name) }),
    );

    grupo.pecas.forEach((p, pi) => {
      if (!String(p.local || '').trim()) {
        bloqueantes.push(
          issue(
            VALIDATION_CODES.PECA_SEM_DESCRICAO,
            'error',
            'bloqueante',
            'Informe o nome da peça ou pavimento.',
            `grupos[${gi}].pecas[${pi}].local`,
            {
              localizacao: grupo.nome || `Grupo ${gi + 1}`,
              entityTemporaryId: p.id,
              campo: 'local',
            },
          ),
        );
      }
      /*
       * v5.22.23 — FCK e Volume não são mais obrigatórios.
       *
       * Pedido do usuário: "FCK, Volume por unidade e Concreto não são
       * obrigatórios". Mudança de comportamento:
       *
       *  - FCK vazio: antes era bloqueante; agora silencioso.
       *  - FCK preenchido mas inválido (fora do range 10-100 MPa, ou
       *    texto que não parseia): vira alerta (warning) em vez de
       *    bloqueante. Não impede envio, mas indica o problema.
       *  - Volume vazio: antes era warning; agora silencioso.
       *  - Volume com valores estranhos (> 1000 m³ ou casas decimais
       *    demais): continua warning — input inválido é diferente de
       *    input ausente.
       *  - Concreto: já era `pendenciaInterna` (não aparece para o
       *    cliente). Sem mudança.
       */
      if (p.fck && String(p.fck).trim() && !parseFck(p.fck)) {
        alertas.push(
          issue(
            VALIDATION_CODES.PECA_FCK_INVALIDO,
            'warning',
            'alerta',
            'FCK informado não está entre 10 e 100 MPa. Confirme o valor.',
            `grupos[${gi}].pecas[${pi}].fck`,
            {
              localizacao: p.local || grupo.nome,
              entityTemporaryId: p.id,
              campo: 'fck',
              suggestedFix: 'Ex.: 30, FCK 30, 30 MPa',
            },
          ),
        );
      }
      const volume = parseVolume(p.volume);
      // v5.22.23: removido o issue PECA_VOLUME_AUSENTE — volume vazio
      // é OK agora. Mantemos só os warnings de input inválido abaixo.
      if (volume && volume > 1000) {
        alertas.push(
          issue(
            VALIDATION_CODES.PECA_VOLUME_ALTO,
            'warning',
            'alerta',
            'Volume alto para uma unidade. Confirme se o valor é por unidade, não somado do grupo.',
            `grupos[${gi}].pecas[${pi}].volume`,
            {
              localizacao: p.local || grupo.nome,
              entityTemporaryId: p.id,
              campo: 'volume',
            },
          ),
        );
      }
      // v5.22.7: detecta 3+ casas decimais no raw (defesa em profundidade
      // contra dados vindos do Excel ou copy-paste; UI já mascara digitação)
      if (p.volume && volumeHasTooManyDecimals(p.volume)) {
        alertas.push(
          issue(
            'PECA_VOLUME_PRECISAO',
            'warning',
            'alerta',
            `Volume com mais de 2 casas decimais ("${p.volume}"). Será tratado como inválido até ajustar.`,
            `grupos[${gi}].pecas[${pi}].volume`,
            {
              localizacao: p.local || grupo.nome,
              entityTemporaryId: p.id,
              campo: 'volume',
            },
          ),
        );
      }
      if (!p.concretoId) {
        pendenciasInternas.push(
          issue(
            VALIDATION_CODES.PECA_SEM_CONCRETO,
            'pending',
            'pendenciaInterna',
            `Vincular concreto para ${p.local || 'peça sem nome'}.`,
            `grupos[${gi}].pecas[${pi}].concretoId`,
            {
              localizacao: p.local || grupo.nome,
              entityTemporaryId: p.id,
              campo: 'concreto',
            },
          ),
        );
      }
    });
  });

  /* --- Duplicatas de nomes de grupo -------------------------------- */
  const duplicates = allNames.filter(
    (item, index) =>
      allNames.findIndex((other) => other.normalized === item.normalized) !== index,
  );
  if (duplicates.length) {
    bloqueantes.push(
      issue(
        VALIDATION_CODES.GRUPO_DUPLICADO,
        'error',
        'bloqueante',
        `Há blocos/torres duplicados: ${[...new Set(duplicates.map((d) => d.raw))].join(', ')}.`,
        'grupos[*].expandedNames',
        { localizacao: localizacaoForPath('grupos[*].expandedNames'), campo: 'nomes' },
      ),
    );
  }

  /* --- Suspeitas de duplicata com zero à esquerda ------------------ */
  const possibleDuplicates = allNames.filter((item) => /\b0\d/.test(item.raw));
  if (possibleDuplicates.length) {
    sugestoes.push(
      issue(
        VALIDATION_CODES.GRUPO_DUPLICATA_ZERO,
        'info',
        'sugestao',
        'Há nomes com zero à esquerda. Confirme se Torre 01 e Torre 1 são a mesma estrutura.',
        'grupos[*].expandedNames',
        {
          localizacao: localizacaoForPath('grupos[*].expandedNames'),
          campo: 'nomes',
          suggestedFix: possibleDuplicates.map((d) => d.raw).join(', '),
        },
      ),
    );
  }

  /* --- Modelo com projetista: número da estrutura obrigatório ----- */
  if (snapshot.metadata.modeloPreenchimento === 'modelo_projeto') {
    snapshot.grupos.forEach((g, gi) => {
      if (!g.edificacoesInput) {
        bloqueantes.push(
          issue(
            VALIDATION_CODES.GRUPO_SEM_NUMERO,
            'error',
            'bloqueante',
            'Informe o Número da Estrutura, como 1 a 24, 1 e 2, ANEXOS ou -.',
            `grupos[${gi}].edificacoesInput`,
            {
              localizacao: g.tipoEdificacao || 'Estrutura',
              entityTemporaryId: g.id,
              campo: 'numeroEstrutura',
            },
          ),
        );
      }
    });
  }

  /* --- Sugestão de agrupamento (mesma assinatura de peças) -------- */
  if (snapshot.grupos.length > 1) {
    const signatures = snapshot.grupos.map((g) => ({
      id: g.id,
      nome: g.nome,
      sig: JSON.stringify(
        g.pecas
          .map((p) => [normalizeText(p.local), parseFck(p.fck), normalizeText(String(p.etapa))])
          .sort(),
      ),
    }));
    signatures.forEach((s, i) => {
      signatures.slice(i + 1).forEach((other) => {
        if (s.sig !== '[]' && s.sig === other.sig) {
          sugestoes.push(
            issue(
              VALIDATION_CODES.GRUPO_SIMILAR_OUTRO,
              'info',
              'sugestao',
              `Os grupos ${s.nome || s.id} e ${other.nome || other.id} parecem ter a mesma estrutura. Você pode agrupá-los para reduzir retrabalho.`,
              'grupos',
              {
                localizacao: localizacaoForPath('grupos'),
                campo: 'agrupamento',
              },
            ),
          );
        }
      });
    });
  }

  /*
   * v5.22.6 / corrigido v5.22.25 — usuários da obra. Eram alertas marcados
   * como "Etapa 6" antes do remap v5.22.11; agora usam localizacaoForPath
   * que devolve "Etapa 5 · Usuários da obra" automaticamente.
   */
  if (Array.isArray(snapshot.usuariosObra)) {
    if (snapshot.usuariosObra.length === 0) {
      alertas.push(
        issue(
          'USUARIOS_OBRA_VAZIO',
          'warning',
          'alerta',
          'Nenhum usuário cadastrado para a obra. Recomenda-se cadastrar pelo menos 1 responsável antes de submeter.',
          'usuariosObra',
          { localizacao: localizacaoForPath('usuariosObra') },
        ),
      );
    } else {
      snapshot.usuariosObra.forEach((u, i) => {
        if (!u.nome.trim()) {
          alertas.push(
            issue(
              'USUARIO_NOME_VAZIO',
              'warning',
              'alerta',
              `Usuário ${i + 1} não tem nome preenchido.`,
              `usuariosObra[${i}].nome`,
              { localizacao: localizacaoForPath(`usuariosObra[${i}].nome`) },
            ),
          );
        }
        if (!u.email.trim()) {
          alertas.push(
            issue(
              'USUARIO_EMAIL_VAZIO',
              'warning',
              'alerta',
              `Usuário ${i + 1} (${u.nome || 'sem nome'}) não tem e-mail. Sem e-mail não receberá convite para o sistema.`,
              `usuariosObra[${i}].email`,
              { localizacao: localizacaoForPath(`usuariosObra[${i}].email`) },
            ),
          );
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())) {
          alertas.push(
            issue(
              'USUARIO_EMAIL_INVALIDO',
              'warning',
              'alerta',
              `E-mail do usuário ${i + 1} parece inválido: "${u.email}"`,
              `usuariosObra[${i}].email`,
              { localizacao: localizacaoForPath(`usuariosObra[${i}].email`) },
            ),
          );
        }
        if (!u.perfil) {
          alertas.push(
            issue(
              'USUARIO_PERFIL_VAZIO',
              'warning',
              'alerta',
              `Usuário ${i + 1} (${u.nome || 'sem nome'}) não tem perfil definido.`,
              `usuariosObra[${i}].perfil`,
              { localizacao: localizacaoForPath(`usuariosObra[${i}].perfil`) },
            ),
          );
        }
      });
    }
  }

  /*
   * v5.22.7 / corrigido v5.22.25 — fornecedores. Localizações marcadas
   * como "Etapa 7" antes do remap; agora "Etapa 6 · Fornecedores" via
   * localizacaoForPath.
   */
  if (Array.isArray(snapshot.fornecedores)) {
    if (snapshot.fornecedores.length === 0) {
      alertas.push(
        issue(
          'FORNECEDORES_VAZIO',
          'warning',
          'alerta',
          'Nenhum fornecedor cadastrado. Recomenda-se cadastrar pelo menos uma usina concreteira e um laboratório antes de submeter.',
          'fornecedores',
          { localizacao: localizacaoForPath('fornecedores') },
        ),
      );
    } else {
      // Conta tipos para alertar se faltar usina ou laboratório
      const usinas = snapshot.fornecedores.filter((f) => f.tipo === 'usina').length;
      const labs = snapshot.fornecedores.filter((f) => f.tipo === 'laboratorio').length;
      if (usinas === 0) {
        alertas.push(
          issue(
            'FORNECEDOR_USINA_AUSENTE',
            'warning',
            'alerta',
            'Nenhuma usina concreteira cadastrada. A obra precisa de pelo menos 1 usina para programar concretagens.',
            'fornecedores',
            { localizacao: localizacaoForPath('fornecedores') },
          ),
        );
      }
      if (labs === 0) {
        alertas.push(
          issue(
            'FORNECEDOR_LAB_AUSENTE',
            'warning',
            'alerta',
            'Nenhum laboratório cadastrado. A obra precisa de pelo menos 1 laboratório para receber laudos de rompimento.',
            'fornecedores',
            { localizacao: localizacaoForPath('fornecedores') },
          ),
        );
      }

      snapshot.fornecedores.forEach((f, i) => {
        const labelTipo = f.tipo === 'usina' ? 'Usina' : 'Laboratório';
        if (!f.nome.trim()) {
          alertas.push(
            issue(
              'FORNECEDOR_NOME_VAZIO',
              'warning',
              'alerta',
              `${labelTipo} ${i + 1} sem nome.`,
              `fornecedores[${i}].nome`,
              { localizacao: localizacaoForPath(`fornecedores[${i}].nome`) },
            ),
          );
        }
        if (!f.cnpj.trim()) {
          sugestoes.push(
            issue(
              'FORNECEDOR_CNPJ_VAZIO',
              'info',
              'sugestao',
              `${labelTipo} ${i + 1} (${f.nome || 'sem nome'}) sem CNPJ.`,
              `fornecedores[${i}].cnpj`,
              { localizacao: localizacaoForPath(`fornecedores[${i}].cnpj`) },
            ),
          );
        } else if (!isValidCNPJ(f.cnpj)) {
          // v5.22.8: CNPJ preenchido mas com DV inválido — sugestão (não bloqueia)
          sugestoes.push(
            issue(
              'FORNECEDOR_CNPJ_DV_INVALIDO',
              'info',
              'sugestao',
              `${labelTipo} ${i + 1} (${f.nome || 'sem nome'}) com CNPJ aparentemente inválido: "${f.cnpj}". Confirme se digitou corretamente.`,
              `fornecedores[${i}].cnpj`,
              { localizacao: localizacaoForPath(`fornecedores[${i}].cnpj`) },
            ),
          );
        }
        const emailsValidos = f.emailsProgramacao.filter((e) => e.trim());
        if (emailsValidos.length === 0) {
          alertas.push(
            issue(
              'FORNECEDOR_EMAIL_VAZIO',
              'warning',
              'alerta',
              `${labelTipo} ${i + 1} (${f.nome || 'sem nome'}) sem nenhum e-mail de programação.`,
              `fornecedores[${i}].emailsProgramacao`,
              { localizacao: localizacaoForPath(`fornecedores[${i}].emailsProgramacao`) },
            ),
          );
        } else {
          emailsValidos.forEach((em) => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim())) {
              alertas.push(
                issue(
                  'FORNECEDOR_EMAIL_INVALIDO',
                  'warning',
                  'alerta',
                  `${labelTipo} ${i + 1} tem e-mail aparentemente inválido: "${em}"`,
                  `fornecedores[${i}].emailsProgramacao`,
                  { localizacao: localizacaoForPath(`fornecedores[${i}].emailsProgramacao`) },
                ),
              );
            }
          });
        }
      });
    }
  }

  const issues = [...bloqueantes, ...alertas, ...sugestoes, ...pendenciasInternas];
  return {
    issues,
    bloqueantes,
    alertas,
    sugestoes,
    pendenciasInternas,
    errorCount: bloqueantes.length,
    warningCount: alertas.length,
    infoCount: sugestoes.length,
    pendingCount: pendenciasInternas.length,
    blocking: bloqueantes.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* helper interno                                                      */
/* ------------------------------------------------------------------ */

function expandedToGroupNames(
  grupo: Grupo,
  expanded: Array<number | string | null>,
): string[] {
  if (expanded.length === 0 && grupo.nome) return [grupo.nome];
  if (expanded.length === 0) return [];
  return expanded.map((numero) => formatGroupName(grupo.nome, numero, grupo.tipoEdificacao));
}
