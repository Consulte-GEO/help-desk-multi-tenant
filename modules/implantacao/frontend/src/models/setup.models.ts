/**
 * Modelos do Cadastro Simplificado da Estrutura · v5
 *
 * Adota o modelo do protótipo HTML "prototipo-estrutura-atualizado-v2":
 *  - Obra com Identificação + Responsável
 *  - Tipo de Estrutura (decisão prévia, Etapa 2)
 *  - Grupos com expansão de range ("1 A 24", "1 e 2", "ANEXOS", "-")
 *  - Peças por grupo (com FCK raw, volume raw, concretoId, etapa)
 *  - Catálogo de Concretos (Etapa 5)
 *  - Comentários + Status + Auditoria pós-envio
 *
 * Vocabulário visível ao usuário em PT-BR. Termos técnicos
 * (Ges_Unidade*, Pro_Projetista, etc.) só aparecem no JSON técnico /
 * Exportação técnica.
 */

/* ------------------------------------------------------------------ */
/* Tipo de Estrutura (Etapa 2) — 6 modelos                            */
/* ------------------------------------------------------------------ */

export type TipoEstruturaModelo =
  | 'torres_iguais'
  | 'torres_diferentes'
  | 'obra_horizontal'
  | 'personalizado'
  /** legados — não aparecem mais como card, mas mantidos para snapshots antigos */
  | 'areas_externas'
  | 'modelo_projeto';

export interface TipoEstruturaOpcao {
  value: TipoEstruturaModelo;
  title: string;
  description: string;
}

export const TIPO_ESTRUTURA_OPCOES: readonly TipoEstruturaOpcao[] = [
  {
    value: 'torres_iguais',
    title: 'Torres ou blocos iguais',
    description:
      'Um grupo de estrutura é preenchido uma vez e replicado para várias torres.',
  },
  {
    value: 'torres_diferentes',
    title: 'Torres ou blocos diferentes',
    description: 'Use quando cada torre tem pavimentos ou FCKs próprios.',
  },
  {
    value: 'obra_horizontal',
    title: 'Obra horizontal',
    description:
      'Casas ou unidades repetidas, com poucos níveis e estrutura idêntica.',
  },
  {
    value: 'personalizado',
    title: 'Personalizado',
    description:
      'Tabela flexível para obra industrial, infraestrutura ou caso fora do padrão.',
  },
] as const;

/* ------------------------------------------------------------------ */
/* Tipos visíveis (dropdowns)                                         */
/* ------------------------------------------------------------------ */

export type TipoEdificacao =
  | 'Bloco'
  | 'Torre'
  | 'Casa'
  | 'Estrutura'
  | 'Área Externa'
  | 'Contenção'
  | 'Anexos'
  | 'Apoio';

export const TIPO_EDIFICACAO_PADRAO: readonly TipoEdificacao[] = [
  'Bloco',
  'Torre',
  'Casa',
  'Estrutura',
  'Área Externa',
  'Contenção',
] as const;

/** Modo "modelo com projetista" — alinhado ao prompt original (6 opções). */
export const TIPO_ESTRUTURA_MODELO_PROJETO: readonly TipoEdificacao[] = [
  'Bloco',
  'Torre',
  'Contenção',
  'Área Externa',
  'Anexos',
  'Apoio',
] as const;

export type Etapa =
  | 'Fundação'
  | 'Infraestrutura'
  | 'Contenção'
  | 'Anexos'
  | 'Estrutura';

export const ETAPAS_OPCOES: readonly Etapa[] = [
  'Fundação',
  'Infraestrutura',
  'Contenção',
  'Anexos',
  'Estrutura',
] as const;

export type ModeloPreenchimento = 'comum' | 'modelo_projeto';

/* ------------------------------------------------------------------ */
/* Obra / metadata                                                     */
/* ------------------------------------------------------------------ */

export interface ModeloProjetoFields {
  idCRM: string;
  estadoRegional: string;
  gestorObra: string;
  gestorExecutivoDiretor: string;
}

export interface CreatedBy {
  userId: string;
  nome: string;
  email: string;
  /** v5.22.18: telefone do responsável (card Responsável na Etapa 1). */
  telefone: string;
}

export type ObraStatus =
  | 'rascunho'
  | 'enviado_validacao'
  | 'em_analise'
  | 'devolvido'
  | 'validado'
  | 'implantado';

export interface ObraMetadata {
  schemaVersion: string;
  obraId: string;
  obraNome: string;
  obraEndereco: string;
  obraCEP: string;
  /**
   * v5.22.18: campo livre de observações da obra na Etapa 1.
   * Exemplo de uso: versão do procedimento, com/sem drywall, particularidades.
   */
  obraObservacoes: string;
  clienteId: string;
  clienteNome: string;
  origem: 'cliente_direto' | 'consulte_geo';
  modeloPreenchimento: ModeloPreenchimento;
  createdAt: string;
  updatedAt: string;
  createdBy: CreatedBy;
  status: ObraStatus;
  protocoloEnvio: string;
  modeloProjetoFields: ModeloProjetoFields;
}

export function novaObraMetadata(): ObraMetadata {
  const now = new Date().toISOString();
  return {
    schemaVersion: '5.0.0',
    obraId: cryptoUid('obra'),
    obraNome: '',
    obraEndereco: '',
    obraCEP: '',
    obraObservacoes: '',
    clienteId: '',
    clienteNome: '',
    origem: 'cliente_direto',
    // v5.0.22-40: padrão passa a ser o "Modelo Completo com Projetista" (pedido do
    // produto — alinha o wizard externo ao modelo completo do GEO Controle).
    modeloPreenchimento: 'modelo_projeto',
    createdAt: now,
    updatedAt: now,
    createdBy: { userId: 'usuario_demo', nome: '', email: '', telefone: '' },
    status: 'rascunho',
    protocoloEnvio: '',
    modeloProjetoFields: {
      idCRM: '',
      estadoRegional: '',
      gestorObra: '',
      gestorExecutivoDiretor: '',
    },
  };
}

/* ------------------------------------------------------------------ */
/* Grupo (Etapa 3) e Peça (Etapa 4)                                    */
/* ------------------------------------------------------------------ */

export interface Peca {
  id: string;
  local: string;
  etapa: Etapa | string;
  fck: string | number;
  volume: string;
  concretoId: string;
  observacoes: string;
  ordem: number;
}

export interface Grupo {
  id: string;
  nome: string;
  /** texto livre tipo "1 A 24", "1 e 2", "ANEXOS", "-" */
  edificacoesInput: string;
  /** resultado da expansão (números, strings ou null para "-") */
  edificacoesExpanded: Array<number | string | null>;
  tipoEdificacao: TipoEdificacao | string;
  projetista: string;
  observacoes: string;
  pecas: Peca[];
}

export function novoGrupo(seed: Partial<Grupo> = {}): Grupo {
  return {
    id: cryptoUid('grp'),
    nome: seed.nome ?? '',
    /**
     * v5.22.23 — Default mudou de '' para '-'.
     *
     * O caractere '-' é interpretado por `expandRange` como "1 item
     * sem numeração" (retorna [null]). Isso faz com que ao criar um
     * grupo novo a prévia mostre exatamente 1 elemento ("sem número")
     * em vez de ficar vazia com aviso de validação para o usuário
     * preencher.
     *
     * Pedido do usuário: ao criar novo grupo, ele já vir com
     * "sem numeração" e a prévia expandida com 1 elemento.
     *
     * Validação `GRUPO_SEM_NUMERO` continua disparando quando o campo
     * é APAGADO explicitamente — só não dispara mais por default na
     * criação.
     */
    edificacoesInput: seed.edificacoesInput ?? '-',
    edificacoesExpanded: seed.edificacoesExpanded ?? [],
    tipoEdificacao: seed.tipoEdificacao ?? 'Bloco',
    projetista: seed.projetista ?? '',
    observacoes: seed.observacoes ?? '',
    pecas: seed.pecas ?? [],
  };
}

export function novaPeca(seed: Partial<Peca> = {}): Peca {
  return {
    id: cryptoUid('peca'),
    local: seed.local ?? '',
    etapa: (seed.etapa as Etapa) ?? 'Estrutura',
    fck: seed.fck ?? '',
    volume: seed.volume ?? '',
    concretoId: seed.concretoId ?? '',
    observacoes: seed.observacoes ?? '',
    ordem: seed.ordem ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Concreto + Padrão de Moldagem (Etapa 4)                             */
/* ------------------------------------------------------------------ */

/**
 * Tipos de ensaio que aparecem na tabela CTe_TipoEnsaio do Consulte GEO.
 * "compressao" é o padrão (pré-selecionado em novas linhas).
 */
export type TipoEnsaioPadrao = 'compressao' | 'elasticidade' | 'tracao_flexao';

export const TIPO_ENSAIO_OPCOES: ReadonlyArray<{
  value: TipoEnsaioPadrao;
  label: string;
}> = [
  { value: 'compressao',   label: 'Resistência a Compressão' },
  { value: 'elasticidade', label: 'Módulo Elasticidade' },
  { value: 'tracao_flexao', label: 'Resistência a Tração na Flexão' },
] as const;

export type UnidadeIdade = 'dias' | 'horas';

/**
 * Linha do padrão de moldagem: uma idade de controle (ex. 28 dias) com
 * o tipo de ensaio aplicado, valor esperado, crescimento (%) e qtd CPs.
 * Vira `CTe_PadraoMoldagem` na implantação backend.
 */
export interface PadraoMoldagem {
  id: string;
  idadeControle: number | string;
  unidadeIdade: UnidadeIdade;
  tipoEnsaio: TipoEnsaioPadrao;
  /** Em compressão = FCK (MPa). Em outros ensaios = valor de projeto. */
  valorEsperado: number | string;
  /** % do FCK esperada nessa idade. 28 dias = 100%, idades menores = curva. */
  crescimentoPct: number;
  /** Quantidade de corpos de prova moldados nesta idade. */
  quantidadeCp: number;
}

/**
 * Atalhos para o usuário criar uma linha do padrão rapidamente.
 * Aparecem como botões no topo da tabela de padrão de moldagem.
 *
 * `mode` define o que o atalho fixa:
 *   - 'percent' → fixa `crescimentoPct`; o `valorEsperado` é derivado
 *                 do FCK do concreto (ex.: 7 dias = 70% → se FCK=30,
 *                 valor=21 MPa).
 *   - 'value'   → fixa `valorEsperado` em MPa; o `crescimentoPct` é
 *                 derivado (ex.: 12 horas = 3 MPa → se FCK=30,
 *                 crescimento=10%).
 *   - 'empty'   → adiciona linha vazia (sem idade pré-definida).
 */
export interface PadraoMoldagemShortcut {
  label: string;
  idadeControle: number;
  unidadeIdade: UnidadeIdade;
  mode: 'percent' | 'value' | 'empty';
  /** Quando mode='percent', valor de referência da curva (% do FCK). */
  crescimentoPct?: number;
  /** Quando mode='value', valor esperado fixo em MPa. */
  valorMpa?: number;
  variant?: 'default' | 'empty';
}

export const PADRAO_MOLDAGEM_SHORTCUTS: ReadonlyArray<PadraoMoldagemShortcut> = [
  { label: '+ Vazio',    idadeControle: 0,  unidadeIdade: 'dias',  mode: 'empty',                    variant: 'empty' },
  { label: '+ 12 horas', idadeControle: 12, unidadeIdade: 'horas', mode: 'value',   valorMpa: 3      },
  { label: '+ 14 horas', idadeControle: 14, unidadeIdade: 'horas', mode: 'value',   valorMpa: 3      },
  { label: '+ 60 horas', idadeControle: 60, unidadeIdade: 'horas', mode: 'percent', crescimentoPct: 60  },
  { label: '+ 3 dias',   idadeControle: 3,  unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 50  },
  { label: '+ 7 dias',   idadeControle: 7,  unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 70  },
  { label: '+ 14 dias',  idadeControle: 14, unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 85  },
  { label: '+ 28 dias',  idadeControle: 28, unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 100 },
  { label: '+ 56 dias',  idadeControle: 56, unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 100 },
  { label: '+ 63 dias',  idadeControle: 63, unidadeIdade: 'dias',  mode: 'percent', crescimentoPct: 100 },
] as const;

/**
 * Converte a idade de controle de uma linha (idadeControle + unidade)
 * para horas absolutas — usado tanto para ordenar a tabela quanto para
 * detectar linhas duplicadas (mesma idade + mesma unidade).
 *
 * Idades em branco ou inválidas retornam `Number.POSITIVE_INFINITY` —
 * vão para o final da lista, não bloqueiam comparação de duplicatas.
 */
export function padraoMoldagemAgeInHours(pm: {
  idadeControle: number | string;
  unidadeIdade: UnidadeIdade;
}): number {
  if (pm.idadeControle === '' || pm.idadeControle === null || pm.idadeControle === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const n = Number(pm.idadeControle);
  if (!Number.isFinite(n)) return Number.POSITIVE_INFINITY;
  return pm.unidadeIdade === 'horas' ? n : n * 24;
}

export interface Concreto {
  id: string;
  descricao: string;
  aplicacao: string;
  fck: string | number;
  moldagem: string;
  /** Padrões de moldagem associados (CTe_PadraoMoldagem). */
  padroesMoldagem: PadraoMoldagem[];
}

/**
 * Padrões iniciais sugeridos quando um concreto é criado:
 * - 28 dias / compressão / valor = FCK / 100% / 2 CPs
 * - 63 dias / compressão / valor = FCK / 100% / 2 CPs (contraprova)
 *
 * v5.22.18: 56 → 63 dias por solicitação da equipe (alinha com a
 * janela de moldagem prática usada no Consulte GEO Concreto).
 *
 * O `valorEsperado` é mantido sincronizado com o FCK enquanto o usuário
 * não customizá-lo (lógica no store).
 */
export function padroesMoldagemPadrao(fck?: string | number): PadraoMoldagem[] {
  const fckNum = typeof fck === 'number' ? fck : Number(String(fck || '').replace(/[^\d]/g, '')) || '';
  return [
    {
      id: cryptoUid('pm'),
      idadeControle: 28, unidadeIdade: 'dias',
      tipoEnsaio: 'compressao',
      valorEsperado: fckNum,
      crescimentoPct: 100, quantidadeCp: 2,
    },
    {
      id: cryptoUid('pm'),
      idadeControle: 63, unidadeIdade: 'dias',
      tipoEnsaio: 'compressao',
      valorEsperado: fckNum,
      crescimentoPct: 100, quantidadeCp: 2,
    },
  ];
}

export function novoConcreto(seed: Partial<Concreto> = {}): Concreto {
  return {
    id: cryptoUid('conc'),
    descricao: seed.descricao ?? '',
    aplicacao: seed.aplicacao ?? '',
    fck: seed.fck ?? '',
    moldagem: seed.moldagem ?? '',
    padroesMoldagem: seed.padroesMoldagem ?? padroesMoldagemPadrao(seed.fck),
  };
}

export function concretosPadrao(): Concreto[] {
  return [
    // 1. Radier/Pavimentos — FCK 25, BRITA 1, SLUMP 10±2
    novoConcreto({
      descricao: 'FCK 25 | BRITA 1 | SLUMP 10±2 CM',
      aplicacao: 'Radier, Térreo, Pavimentos',
      fck: 25,
      moldagem: '1 CP - 7 dias / 2 CPs - 28 dias / 1 CP - 63 dias',
    }),
    // 2. Sapata/Blocos — FCK 30, BRITA 1, SLUMP 10±2 (trocado FLOW → SLUMP)
    novoConcreto({
      descricao: 'FCK 30 | BRITA 1 | SLUMP 10±2 CM',
      aplicacao: 'Sapata, Cortina, Blocos',
      fck: 30,
      moldagem: '1 CP - 7 dias / 2 CPs - 28 dias / 1 CP - 63 dias',
    }),
    // 3. Estaca Hélice — FCK 30, BRITA 0, SLUMP 22±3
    novoConcreto({
      descricao: 'FCK 30 | BRITA 0 | SLUMP 22±3 CM',
      aplicacao: 'Estaca Hélice',
      fck: 30,
      moldagem: '2 CPs - 7 dias / 2 CPs - 28 dias / 2 CPs - 63 dias',
      padroesMoldagem: padroesMoldagemHelice(30),
    }),
    // 4. Contenções — FCK 40, BRITA 0, SLUMP 16±3
    novoConcreto({
      descricao: 'FCK 40 | BRITA 0 | SLUMP 16±3 CM',
      aplicacao: 'Contenções',
      fck: 40,
      moldagem: '2 CPs - 7 dias / 2 CPs - 28 dias / 2 CPs - 63 dias',
      padroesMoldagem: padroesMoldagemHelice(40),
    }),
    // 5. Parede/Laje (autoadensável) — FCK 25, BRITA 0, FLOW 70±5
    novoConcreto({
      descricao: 'FCK 25 | BRITA 0 | FLOW 70±5 CM',
      aplicacao: 'Parede/Laje',
      fck: 25,
      moldagem: '2 CPs - 12h / 2 CPs - 7 dias / 2 CPs - 14 dias / 2 CPs - 28 dias / 2 CPs - 63 dias',
      padroesMoldagem: padroesMoldagemParedeLaje(25),
    }),
  ];
}

/**
 * Padrão típico para Estaca Hélice e Contenções:
 * 2 CPs em 7d (70%), 28d (100%) e 63d (100%).
 */
function padroesMoldagemHelice(fck: number): PadraoMoldagem[] {
  return [
    linhaPct(fck, 7, 'dias', 70, 2),
    linhaPct(fck, 28, 'dias', 100, 2),
    linhaPct(fck, 63, 'dias', 100, 2),
  ];
}

/**
 * Padrão completo para Parede/Laje (autoadensável):
 * 12h (3 MPa fixo), 7d (70%), 14d (87%), 28d (100%), 63d (100%).
 * Valor do 12h é fixo em MPa; o crescimento % deriva do FCK.
 */
function padroesMoldagemParedeLaje(fck: number): PadraoMoldagem[] {
  return [
    linhaValor(fck, 12, 'horas', 3, 2),
    linhaPct(fck, 7, 'dias', 70, 2),
    linhaPct(fck, 14, 'dias', 87, 2),
    linhaPct(fck, 28, 'dias', 100, 2),
    linhaPct(fck, 63, 'dias', 100, 2),
  ];
}

/** Linha de padrão com `crescimentoPct` fixo; valor derivado do FCK. */
function linhaPct(
  fck: number,
  idade: number,
  unidade: UnidadeIdade,
  pct: number,
  qtd: number,
): PadraoMoldagem {
  return {
    id: cryptoUid('pm'),
    idadeControle: idade,
    unidadeIdade: unidade,
    tipoEnsaio: 'compressao',
    valorEsperado: fck > 0 ? Number(((pct * fck) / 100).toFixed(1)) : '',
    crescimentoPct: pct,
    quantidadeCp: qtd,
  };
}

/** Linha de padrão com `valorEsperado` fixo (em MPa); % derivado do FCK. */
function linhaValor(
  fck: number,
  idade: number,
  unidade: UnidadeIdade,
  valorMpa: number,
  qtd: number,
): PadraoMoldagem {
  return {
    id: cryptoUid('pm'),
    idadeControle: idade,
    unidadeIdade: unidade,
    tipoEnsaio: 'compressao',
    valorEsperado: valorMpa,
    crescimentoPct: fck > 0 ? Math.round((valorMpa / fck) * 100) : 100,
    quantidadeCp: qtd,
  };
}

/* ------------------------------------------------------------------ */
/* Comentário (Etapa 8)                                                */
/* ------------------------------------------------------------------ */

export interface Comentario {
  id: string;
  autor: string;
  mensagem: string;
  timestamp: string;
  itemReferenciado: string;
}

/* ------------------------------------------------------------------ */
/* Auditoria local (Etapa 8)                                           */
/* ------------------------------------------------------------------ */

export interface AuditLocalEvent {
  id: string;
  timestamp: string;
  autor: string;
  acao: string;
  before?: unknown;
  after?: unknown;
}

/* ------------------------------------------------------------------ */
/* Sugestões de Peças (datalist)                                       */
/* ------------------------------------------------------------------ */

export const PECAS_SUGERIDAS: readonly string[] = [
  'Estacas hélice',
  'Estaca Escavada',
  'Broca',
  'Bloco de Coroamento',
  'Cintamento',
  'Lajão estaqueado',
  'Radier',
  'Sapata',
  'Tubulão',
  'Térreo',
  '1º Pavimento',
  'Pavimento Tipo',
  'Cobertura',
  'Platibanda',
  'Barrilete',
  "Caixa d'água",
  'Muro de Arrimo',
  'Parede Diafragma',
  'Piscina',
  'Guarita',
  'Churrasqueira',
  'Casa de Bombas',
] as const;

export const FCKS_PADRAO: readonly number[] = [15, 20, 25, 30, 35, 40, 45, 50] as const;

/* ------------------------------------------------------------------ */
/* Tipo do snapshot completo                                           */
/* ------------------------------------------------------------------ */

export interface SetupSnapshot {
  step: number;
  theme: 'light' | 'dark';
  showJson: boolean;
  metadata: ObraMetadata;
  tipoEstrutura: TipoEstruturaModelo;
  grupos: Grupo[];
  concretos: Concreto[];
  comentarios: Comentario[];
  audit: AuditLocalEvent[];
  /**
   * v5.22.6: usuários da obra (até ~10 pessoas). Cada usuário tem
   * dados de contato + um perfil de acesso da lista fixa.
   * Cadastrado em uma etapa própria do wizard (Etapa 6).
   */
  usuariosObra: UsuarioObra[];
  /**
   * v5.22.7: fornecedores da obra (usinas concreteiras e laboratórios).
   * Cadastrados em etapa própria (Etapa 7). Cada um tem tipo, dados de
   * contato e até 3 emails para programação.
   */
  fornecedores: Fornecedor[];
}

/** v5.22.6: perfis de acesso fixos disponíveis no Consulte GEO. */
export type PerfilAcesso =
  | 'operador_campo'
  | 'engenheiro'
  | 'qualidade'
  | 'laboratorio'
  | 'analista_gestor';

/** v5.22.6: usuário individual cadastrado para acesso à obra. */
export interface UsuarioObra {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  telefone: string;
  perfil: PerfilAcesso | '';
}

/**
 * v5.22.6: cria um novo usuário vazio.
 */
export function novoUsuarioObra(): UsuarioObra {
  return {
    id: cryptoUid('usr'),
    nome: '',
    email: '',
    cargo: '',
    telefone: '',
    perfil: '',
  };
}

/**
 * v5.22.6: labels human-readable + descrições dos perfis.
 * São fixos no produto (não vêm do banco); refletem o cadastro
 * institucional da Consulte GEO.
 */
export const PERFIS_INFO: Record<PerfilAcesso, { label: string; descricao: string }> = {
  operador_campo: {
    label: 'Operador de Campo',
    descricao:
      'Realiza o registro de dados no sistema, incluindo programações, concretagens, rompimentos, e importação de laudos. Monitora resultados e visualiza relatórios e não conformidades. Recebe e-mail de programação e cancelamento de concretagem.',
  },
  engenheiro: {
    label: 'Engenheiro',
    descricao:
      'Mesmas permissões do Operador de Campo. Pode aprovar laudos anexados e executar ações para tratar não conformidades. Pode abrir RAC (Registro de Ação Corretiva) com plano de ação para NC reincidentes.',
  },
  qualidade: {
    label: 'Qualidade',
    descricao:
      'Responsável pelo monitoramento e gestão de pendências e não conformidades. Acessa relatórios detalhados, log de ações, e pode abrir RAC com plano de ação para NC reincidentes e analisar eficácia.',
  },
  laboratorio: {
    label: 'Laboratório',
    descricao:
      'Foco exclusivo no lançamento de rompimentos e importação de laudos com resultados. Desempenha papel crucial na análise de qualidade do concreto.',
  },
  analista_gestor: {
    label: 'Analista / Gestor',
    descricao:
      'Foco na análise e supervisão. Acessa todos os relatórios e pode receber notificações semanais de forma consolidada com todas as obras e os resultados de resistência insatisfatórias.',
  },
};

/* ------------------------------------------------------------------ */
/* v5.22.7: Fornecedores (Usinas concreteiras + Laboratórios)         */
/* ------------------------------------------------------------------ */

/** v5.22.7: tipo de fornecedor — discriminador. */
export type TipoFornecedor = 'usina' | 'laboratorio';

/**
 * v5.22.7: fornecedor cadastrado pelo cliente. Usina concreteira ou
 * laboratório. Cada fornecedor aceita até 3 emails para programação
 * (separação operacional comum em obras grandes — equipe técnica + comercial + gerencial).
 */
export interface Fornecedor {
  id: string;
  tipo: TipoFornecedor;
  nome: string;
  cnpj: string;
  endereco: string;
  responsavel: string;
  /** Até 3 emails de programação. Array flexível; UI controla limite. */
  emailsProgramacao: string[];
  telefone: string;
  observacoes: string;
}

/** v5.22.7: cria novo fornecedor com 1 email vazio default. */
export function novoFornecedor(tipo: TipoFornecedor = 'usina'): Fornecedor {
  return {
    id: cryptoUid('frn'),
    tipo,
    nome: '',
    cnpj: '',
    endereco: '',
    responsavel: '',
    emailsProgramacao: [''],
    telefone: '',
    observacoes: '',
  };
}

/** v5.22.7: labels para apresentação. */
export const TIPOS_FORNECEDOR_INFO: Record<TipoFornecedor, { label: string; tituloCard: string; nomeLabel: string }> = {
  usina: {
    label: 'Usina concreteira',
    tituloCard: 'Dados da Usina / Concreteira',
    nomeLabel: 'Nome da usina',
  },
  laboratorio: {
    label: 'Laboratório',
    tituloCard: 'Dados do Laboratório',
    nomeLabel: 'Nome do laboratório',
  },
};

export const MAX_EMAILS_FORNECEDOR = 3;

export function defaultSnapshot(): SetupSnapshot {
  return {
    step: 1,
    theme: 'light',
    showJson: false,
    metadata: novaObraMetadata(),
    tipoEstrutura: 'torres_iguais',
    grupos: [],
    // v5.22.10: começa vazio. Cliente pode usar botão "Sugerir traços padrão"
    // no Step4Concretos para popular com os 5 traços comuns. Antes deste
    // patch a tela já abria com 5 concretos pré-cadastrados, o que dava
    // impressão de "obra já configurada" e exigia apagar 5 itens antes de
    // cadastrar de zero.
    concretos: [],
    comentarios: [],
    audit: [],
    usuariosObra: [],
    fornecedores: [],
  };
}

/* ------------------------------------------------------------------ */
/* utils                                                               */
/* ------------------------------------------------------------------ */

export function cryptoUid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}_${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Steps do wizard (8 etapas)                                          */
/* ------------------------------------------------------------------ */

export interface WizardStep {
  id: number;
  title: string;
  subtitle: string;
}

/**
 * Etapas visíveis para o cliente (rota / e modo editável em /s/).
 * v5.22.6: introduzida Etapa 6 "Usuários da obra".
 * v5.22.7: introduzida Etapa 7 "Fornecedores" → Revisão vira Etapa 8.
 */
/**
 * v5.22.11: Etapa 2 (Tipo de estrutura) removida — o switch
 * Modelo de Preenchimento foi mergeado no topo da Etapa 2
 * (antes Etapa 3, Blocos e torres). Cliente agora tem 7 etapas;
 * equipe tem 9 (era 8 / 10 antes).
 */
export const WIZARD_STEPS: readonly WizardStep[] = [
  { id: 1, title: 'Dados básicos',       subtitle: 'Obra e responsável' },
  { id: 2, title: 'Blocos e torres',     subtitle: 'Modelo, grupos e estrutura' },
  { id: 3, title: 'Concretos',           subtitle: 'Traços e aplicações' },
  { id: 4, title: 'Pavimentos e peças',  subtitle: 'FCK, volume e etapa' },
  { id: 5, title: 'Usuários da obra',    subtitle: 'Quem terá acesso ao sistema' },
  { id: 6, title: 'Fornecedores',        subtitle: 'Usinas e laboratórios' },
  { id: 7, title: 'Revisão e envio',     subtitle: 'Confirma e envia para validação' },
] as const;

/**
 * Etapas adicionais visíveis APENAS para a equipe (rota /r/:token).
 * v5.22.11: IDs reordenados para 8 e 9 após remoção da Etapa 2.
 */
export const REVIEW_STEPS_EXTRA: readonly WizardStep[] = [
  { id: 8, title: 'Validação para Implantação', subtitle: 'Protocolo e JSON técnico' },
  { id: 9, title: 'Acompanhamento',             subtitle: 'Devolução ou implantação' },
] as const;

/** v5.22.11: lista completa das 9 etapas (usada pela equipe em /r/:token). */
export const WIZARD_STEPS_FULL: readonly WizardStep[] = [
  ...WIZARD_STEPS,
  ...REVIEW_STEPS_EXTRA,
] as const;

/* ------------------------------------------------------------------ */
/* Ticket de implantação (v5.20)                                       */
/*                                                                    */
/* Resposta da Edge Function `submit-for-validation`. Note: o          */
/* `access_token` JAMAIS aparece aqui — só existe no email enviado     */
/* à equipe Consulte GEO.                                              */
/* ------------------------------------------------------------------ */

export interface TicketSubmissionResponse {
  email_status?: string;
  ok: boolean;
  ticket_number: string;
  submission_id: string;
  email_sent_to: string[];
  email_cc: string[];
  email_error: string | null;
}

/** v5.21 / v5.22: Comentário individual da equipe (ou cliente) na review. */
export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  created_at: string;
  /** v5.22: 'equipe' (default) ou 'cliente'. */
  author_role?: 'equipe' | 'cliente';
  /** v5.22: comentários internal_only não aparecem para o cliente. Só presente em payload da equipe. */
  internal_only?: boolean;
}

/** Payload retornado pela RPC get_submission_by_token (review interno). */
export interface TicketReviewPayload {
  ticket: {
    ticket_number: string;
    created_at: string;
    email_sent_at: string | null;
    email_recipients: string[];
    email_cc: string[];
    accessed_at: string | null;
    accessed_count: number;
    client_message: string | null;
  };
  submission: {
    id: string;
    draft_id: string | null;
    status: string;
    obra_codigo: string;
    obra_nome: string;
    technical_json: unknown;
    submitted_at: string;
    reviewed_at: string | null;
    reviewer: string | null;
    review_note: string | null;
  };
  /** v5.21: histórico de comentários da equipe. Vazio se não houver. */
  comments: ReviewComment[];
}

/**
 * v5.22: Payload da página de status público do cliente (`/s/:token`).
 *
 * Não retorna technical_json bruto nem reviewer/review_note interno.
 * Comentários já vêm filtrados pelo RPC (internal_only=true não aparece).
 */
export interface ClientStatusPayload {
  ticket: {
    ticket_number: string;
    created_at: string;
    client_message: string | null;
  };
  submission: {
    status: string;
    obra_codigo: string;
    obra_nome: string;
    obra_endereco: string;
    responsavel_nome: string;
    submitted_at: string;
    reviewed_at: string | null;
    count_estruturas: number;
    count_pecas: number;
    count_concretos: number;
    /**
     * v5.22.6: presente apenas quando status='devolvido'. Cliente pode
     * editar e reenviar via `updateTechnicalJsonByClientToken` +
     * `resubmitByClientToken`.
     */
    technical_json?: TechnicalJsonForResubmit | null;
    /**
     * v5.22.6: true quando status='devolvido'. UI mostra wizard editável.
     */
    editable?: boolean;
    resubmitted_at?: string | null;
  };
  comments: ReviewComment[];
}

/**
 * v5.22.6: technical_json retornado para o cliente durante devolução.
 * Mantém forma compatível com o que o frontend usa para reconstruir o
 * snapshot. É um subset livre — qualquer extra é mantido.
 */
export interface TechnicalJsonForResubmit {
  customerInput?: {
    dadosBasicos?: Record<string, unknown>;
    usuariosObra?: UsuarioObra[];
    /** v5.22.7: fornecedores cadastrados. */
    fornecedores?: Fornecedor[];
    [k: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  technicalMapping?: Record<string, unknown>;
  [k: string]: unknown;
}
