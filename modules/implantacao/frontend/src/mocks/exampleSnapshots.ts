/**
 * Exemplos pré-cadastrados acessíveis pelos botões "Carregar exemplo
 * comum" e "Carregar exemplo completo com projetista" no topo do app.
 */

import {
  concretosPadrao,
  cryptoUid,
  defaultSnapshot,
  type Concreto,
  type Grupo,
  type Peca,
  type SetupSnapshot,
} from '../models/setup.models';
import { orderOf } from '../services/normalizationService';

/* ------------------------------------------------------------------ */
/* Exemplo 1: Cliente comum                                            */
/* ------------------------------------------------------------------ */

export function exampleCommon(): SetupSnapshot {
  const s = defaultSnapshot();
  s.concretos = concretosPadrao();
  s.metadata.obraNome = 'Evo Vila Clementino';
  s.metadata.clienteNome = 'Bacelar';
  s.metadata.obraEndereco = 'São Paulo - SP';
  s.metadata.obraCEP = '00000-000';
  s.metadata.createdBy = {
    userId: 'eng_demo',
    nome: 'Engenheira da Obra',
    email: 'engenharia@bacelar.com.br',
    telefone: '(11) 91234-5678',
  };
  s.tipoEstrutura = 'torres_iguais';

  // Concretos por aplicação (índices em s.concretos)
  //   [0] FCK 25 BRITA 1 SLUMP — Radier/Pavimentos
  //   [1] FCK 30 BRITA 1 SLUMP — Sapata/Cortina/Blocos
  const cRadier = s.concretos[0].id;
  const cSapata = s.concretos[1].id;

  const pecas: Peca[] = [
    {
      id: cryptoUid('peca'),
      local: 'Cortina de Concreto',
      etapa: 'Contenção',
      fck: 30,
      volume: '177,97',
      concretoId: cSapata,
      observacoes: '',
      ordem: 1,
    },
    {
      id: cryptoUid('peca'),
      local: 'Estaca Escavada',
      etapa: 'Fundação',
      fck: 25,
      volume: '2,00',
      concretoId: cRadier,
      observacoes: '',
      ordem: 2,
    },
    {
      id: cryptoUid('peca'),
      local: 'Broca',
      etapa: 'Fundação',
      fck: 30,
      volume: '8,00',
      concretoId: cSapata,
      observacoes: '',
      ordem: 3,
    },
    {
      id: cryptoUid('peca'),
      local: 'Sapata',
      etapa: 'Fundação',
      fck: 30,
      volume: '164,84',
      concretoId: cSapata,
      observacoes: '',
      ordem: 4,
    },
    {
      id: cryptoUid('peca'),
      local: '1º subsolo até 9º pavimento / Ático e Cobertura',
      etapa: 'Estrutura',
      fck: 30,
      volume: '1121,46',
      concretoId: cSapata,
      observacoes: 'Confirmar se volume é por unidade ou agregado.',
      ordem: 5,
    },
  ];

  const grupo: Grupo = {
    id: cryptoUid('grp'),
    nome: 'Torre Única',
    edificacoesInput: '',
    edificacoesExpanded: [],
    tipoEdificacao: 'Torre',
    projetista: '',
    observacoes: '',
    pecas,
  };

  s.grupos = [grupo];
  return s;
}

/* ------------------------------------------------------------------ */
/* Exemplo 2: Modelo com projetista                                    */
/*   4 grupos: Bloco 1 a 6 · Anexos · Contenção 1 a 3 · Bloco 7 a 10   */
/* ------------------------------------------------------------------ */

export function exampleModeloProjeto(): SetupSnapshot {
  const s = defaultSnapshot();
  s.concretos = concretosPadrao();
  s.metadata.modeloPreenchimento = 'modelo_projeto';
  s.tipoEstrutura = 'torres_iguais';
  s.metadata.obraNome = 'Parque dos Condes';
  s.metadata.clienteNome = 'Construtora Exemplo';
  s.metadata.createdBy = {
    userId: 'modelo_projeto_demo',
    nome: 'Gestor da Obra',
    email: 'gestor.obra@construtora.com.br',
    telefone: '(11) 98765-4321',
  };
  s.metadata.obraObservacoes = 'Versão 02 do procedimento; obra com drywall na superestrutura.';
  s.metadata.modeloProjetoFields = {
    idCRM: '123e4567-e89b-42d3-a456-426614174000',
    estadoRegional: 'BAHIA - NE1',
    gestorObra: 'Gestor da Obra',
    gestorExecutivoDiretor: 'Diretoria Regional',
  };

  // Mapeamento por aplicação para vincular peças aos concretos certos.
  //   [0] FCK 25 BRITA 1 SLUMP   → Radier/Pavimentos
  //   [1] FCK 30 BRITA 1 SLUMP   → Sapata/Cortina/Blocos
  //   [2] FCK 30 BRITA 0 SLUMP   → Estaca Hélice
  //   [3] FCK 40 BRITA 0 SLUMP   → Contenções
  //   [4] FCK 25 BRITA 0 FLOW    → Parede/Laje
  const cRadier  = s.concretos[0].id;
  const cBlocos  = s.concretos[1].id;
  const cHelice  = s.concretos[2].id;
  const cConten  = s.concretos[3].id;

  /* ---------- Peças base de bloco (Bloco 1 a 6) ---------- */
  const basePecasBloco16: Array<Omit<Peca, 'id'>> = [
    { local: 'Estacas hélice',     etapa: 'Fundação',       fck: 30, volume: '12,50',  concretoId: cHelice, observacoes: '', ordem: orderOf('Estacas hélice') },
    { local: 'Bloco de Coroamento', etapa: 'Fundação',       fck: 30, volume: '18,20',  concretoId: cBlocos, observacoes: '', ordem: orderOf('Bloco de Coroamento') },
    { local: 'Radier',             etapa: 'Fundação',       fck: 25, volume: '170,00', concretoId: cRadier, observacoes: '', ordem: orderOf('Radier') },
    { local: 'Térreo',             etapa: 'Estrutura', fck: 25, volume: '92,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('Térreo') },
    { local: '1º pav',             etapa: 'Estrutura', fck: 25, volume: '87,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('1º pav') },
    { local: '2º pav',             etapa: 'Estrutura', fck: 25, volume: '87,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('2º pav') },
    { local: '3º pav',             etapa: 'Estrutura', fck: 25, volume: '87,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('3º pav') },
    { local: '4º pav',             etapa: 'Estrutura', fck: 25, volume: '87,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('4º pav') },
    { local: 'Cobertura',          etapa: 'Estrutura', fck: 25, volume: '54,00',  concretoId: cRadier, observacoes: '', ordem: orderOf('Cobertura') },
  ];

  /* ---------- Peças do Bloco 7 a 10 (mesma estrutura + 1 pavimento extra) ---------- */
  const basePecasBloco710: Array<Omit<Peca, 'id'>> = [
    ...basePecasBloco16.slice(0, -1), // tudo menos a cobertura
    // 5º pav adicional — diferencial do Bloco 7 a 10
    { local: '5º pav',    etapa: 'Estrutura', fck: 25, volume: '87,00', concretoId: cRadier, observacoes: 'Pavimento adicional — Bloco 7 a 10', ordem: orderOf('5º pav') },
    { local: 'Cobertura', etapa: 'Estrutura', fck: 25, volume: '54,00', concretoId: cRadier, observacoes: '', ordem: orderOf('Cobertura') },
  ];

  /* ---------- Peças de Contenção 1 a 3 (imagem 2) ---------- */
  const pecasContencao: Array<Omit<Peca, 'id'>> = [
    { local: 'Parede Diafragma - L1', etapa: 'Contenção', fck: 40, volume: '12,00', concretoId: cConten, observacoes: '', ordem: 1 },
    { local: 'Parede Diafragma - L2', etapa: 'Contenção', fck: 40, volume: '12,00', concretoId: cConten, observacoes: '', ordem: 2 },
    { local: 'Parede Diafragma - L3', etapa: 'Contenção', fck: 40, volume: '12,00', concretoId: cConten, observacoes: '', ordem: 3 },
    { local: 'Parede Diafragma - L4', etapa: 'Contenção', fck: 40, volume: '12,00', concretoId: cConten, observacoes: '', ordem: 4 },
  ];

  const grupoBloco16: Grupo = {
    id: cryptoUid('grp'),
    nome: 'Bloco',
    edificacoesInput: '1 a 6',
    edificacoesExpanded: [],
    tipoEdificacao: 'Bloco',
    projetista: 'Estrutural Projetos',
    observacoes: '',
    pecas: basePecasBloco16.map((p) => ({ ...p, id: cryptoUid('peca') })),
  };

  const grupoAnexos: Grupo = {
    id: cryptoUid('grp'),
    nome: 'Anexos',
    edificacoesInput: 'ANEXOS',
    edificacoesExpanded: [],
    tipoEdificacao: 'Anexos',
    projetista: 'Teste Engenharia',
    observacoes: '',
    pecas: [
      { id: cryptoUid('peca'), local: 'Guarita', etapa: 'Anexos', fck: 25, volume: '-', concretoId: cRadier, observacoes: 'Anexo sem volumetria obrigatória.', ordem: 1 },
      { id: cryptoUid('peca'), local: 'Piscina', etapa: 'Anexos', fck: 25, volume: '-', concretoId: cRadier, observacoes: '', ordem: 2 },
    ],
  };

  const grupoContencao: Grupo = {
    id: cryptoUid('grp'),
    nome: 'Contenção',
    edificacoesInput: '1 a 3',
    edificacoesExpanded: [],
    tipoEdificacao: 'Contenção',
    projetista: 'Arrimo Estrutura',
    observacoes: '',
    pecas: pecasContencao.map((p) => ({ ...p, id: cryptoUid('peca') })),
  };

  const grupoBloco710: Grupo = {
    id: cryptoUid('grp'),
    nome: 'Bloco',
    edificacoesInput: '7 a 10',
    edificacoesExpanded: [],
    tipoEdificacao: 'Bloco',
    projetista: 'Estrutural Projetos',
    observacoes: 'Pavimento adicional em relação ao Bloco 1 a 6.',
    pecas: basePecasBloco710.map((p) => ({ ...p, id: cryptoUid('peca') })),
  };

  s.grupos = [grupoBloco16, grupoAnexos, grupoContencao, grupoBloco710];
  return s;
}

/* ------------------------------------------------------------------ */
/* (helper de compatibilidade — não removo embora não esteja em uso)   */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _concretoIdForFck(fck: number, concretos: Concreto[]): string {
  const match = concretos.find((c) => Number(c.fck) === Number(fck));
  return match?.id ?? '';
}
