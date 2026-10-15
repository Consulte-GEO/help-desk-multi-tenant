/**
 * implantacaoImportService · v5.22.47
 *
 * Importa uma planilha de implantação preenchida (.xlsx) e devolve as
 * coleções prontas para hidratar o wizard via `setup/applyImportedData`.
 *
 * Formatos aceitos:
 *   - MODELO NOVO (R02, tabular): abas Obra, Estruturas, Concretos,
 *     Peças, Usuários, Fornecedores — gerado por nós em
 *     public/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx;
 *   - MODELO ANTIGO (R00/R01): abas 'Dados Obra l Acessos', 'Estrutura'
 *     (seções em duas colunas), 'Concreto', 'Usina', 'Laboratório' —
 *     parse best-effort com avisos (sem Projetista e sem concreto por
 *     peça, que não existiam naquele modelo).
 *
 * Arquitetura (mesma da Pré-análise/Pré-importação):
 *   - o PARSE determinístico vive em um módulo UMD sem dependência de
 *     DOM (`public/assets/implantacao-import-core.js`), testável em
 *     Node via `tools/run-implantacao-import-tests.js`;
 *   - este service é a ponte browser: carrega o SheetJS vendorizado +
 *     o core sob demanda (lazy, fora do bundle), lê o File e converte
 *     a saída do core para os shapes canônicos do wizard usando as
 *     factories reais de `setup.models.ts` (ids `cryptoUid`, padrões de
 *     moldagem seedados a partir do FCK, etc.).
 *
 * Regras herdadas do projeto:
 *   - nunca inventar dado: campo ausente fica vazio e vira aviso;
 *   - texto original preservado (descrição do concreto, nome da peça);
 *   - volume com >2 casas é arredondado para 2 COM aviso (máscara do
 *     wizard rejeita mais casas);
 *   - ids da planilha nunca são usados — todos são gerados aqui.
 */

import {
  novoConcreto,
  novoFornecedor,
  novoGrupo,
  novaPeca,
  novoUsuarioObra,
  type Concreto,
  type Fornecedor,
  type Grupo,
  type ObraMetadata,
  type UsuarioObra,
} from '../models/setup.models';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface ImportacaoResumo {
  formato: 'novo' | 'legado';
  estruturas: number;
  pecas: number;
  concretos: number;
  usuarios: number;
  fornecedores: number;
  avisos: number;
}

/** Payload final — é exatamente o que `setup/applyImportedData` espera. */
export interface ImportacaoResultado {
  formato: 'novo' | 'legado';
  metadata: Partial<
    Pick<ObraMetadata, 'obraNome' | 'clienteNome' | 'obraEndereco' | 'obraCEP' | 'obraObservacoes'>
  >;
  grupos: Grupo[];
  concretos: Concreto[];
  usuariosObra: UsuarioObra[];
  fornecedores: Fornecedor[];
  avisos: string[];
  resumo: ImportacaoResumo;
}

/** Saída crua do core UMD (shape espelhado, ids temporários do core). */
interface CoreResultado {
  formato: 'novo' | 'legado';
  metadata: Record<string, string>;
  grupos: Array<{
    nome: string;
    edificacoesInput: string;
    tipoEdificacao: string;
    projetista: string;
    observacoes: string;
    pecas: Array<{
      local: string;
      etapa: string;
      fck: string | number;
      volume: string;
      concretoId: string;
      observacoes: string;
      ordem: number;
    }>;
  }>;
  concretos: Array<{
    id: string;
    descricao: string;
    aplicacao: string;
    fck: string | number;
    moldagem: string;
  }>;
  usuariosObra: Array<{
    nome: string;
    email: string;
    cargo: string;
    telefone: string;
    perfil: string;
  }>;
  fornecedores: Array<{
    tipo: 'usina' | 'laboratorio';
    nome: string;
    cnpj: string;
    endereco: string;
    responsavel: string;
    emailsProgramacao: string[];
    telefone: string;
    observacoes: string;
  }>;
  avisos: string[];
}

interface CoreModule {
  VERSION: string;
  parse(data: Uint8Array | string, xlsxLib: unknown): CoreResultado;
}

/* ------------------------------------------------------------------ */
/* Carregamento lazy do SheetJS vendorizado + core UMD                 */
/* ------------------------------------------------------------------ */

const scriptPromises = new Map<string, Promise<void>>();

function injectScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Importação de planilha só está disponível no navegador.'));
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromises.delete(src); // permite nova tentativa após falha de rede
      reject(new Error(`Falha ao carregar ${src}`));
    };
    document.head.appendChild(el);
  });
  scriptPromises.set(src, p);
  return p;
}

function baseUrl(): string {
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  return base.replace(/\/$/, '');
}

async function loadXlsxVendor(): Promise<unknown> {
  const w = globalThis as Record<string, unknown>;
  if (!w.XLSX) await injectScript(`${baseUrl()}/vendor/xlsx.full.min.js`);
  if (!w.XLSX) throw new Error('Biblioteca de leitura de planilhas não carregou.');
  return w.XLSX;
}

async function loadCore(): Promise<CoreModule> {
  const w = globalThis as Record<string, unknown>;
  if (!w.ImplantacaoImportCore) {
    await injectScript(`${baseUrl()}/assets/implantacao-import-core.js`);
  }
  const core = w.ImplantacaoImportCore as CoreModule | undefined;
  if (!core || typeof core.parse !== 'function') {
    throw new Error('Módulo de importação não carregou.');
  }
  return core;
}

/* ------------------------------------------------------------------ */
/* Conversão core → shapes canônicos do wizard                         */
/* ------------------------------------------------------------------ */

/**
 * Reconstrói cada entidade pelas factories reais do wizard:
 * ids `cryptoUid`, `padroesMoldagem` seedados a partir do FCK do
 * concreto, defaults consistentes ('-' para estrutura sem numeração,
 * 1 slot de email em fornecedor). Remapeia `concretoId` das peças dos
 * ids temporários do core para os ids definitivos.
 */
export function converterResultadoCore(bruto: CoreResultado): ImportacaoResultado {
  const idConcreto = new Map<string, string>();
  const concretos: Concreto[] = bruto.concretos.map((c) => {
    const novo = novoConcreto({
      descricao: c.descricao,
      aplicacao: c.aplicacao,
      fck: c.fck,
      moldagem: c.moldagem,
    });
    idConcreto.set(c.id, novo.id);
    return novo;
  });

  const grupos: Grupo[] = bruto.grupos.map((g) =>
    novoGrupo({
      nome: g.nome,
      // '' (seção legada sem número) vira '-' = "1 item sem numeração",
      // mesmo default de um grupo criado manualmente no wizard.
      edificacoesInput: g.edificacoesInput || '-',
      tipoEdificacao: g.tipoEdificacao,
      projetista: g.projetista,
      observacoes: g.observacoes,
      pecas: g.pecas.map((p, ordem) =>
        novaPeca({
          local: p.local,
          etapa: p.etapa,
          fck: p.fck,
          volume: p.volume,
          concretoId: p.concretoId ? idConcreto.get(p.concretoId) ?? '' : '',
          observacoes: p.observacoes,
          ordem,
        }),
      ),
    }),
  );

  const usuariosObra: UsuarioObra[] = bruto.usuariosObra.map((u) => {
    const novo = novoUsuarioObra();
    novo.nome = u.nome;
    novo.email = u.email;
    novo.cargo = u.cargo;
    novo.telefone = u.telefone;
    novo.perfil = u.perfil as UsuarioObra['perfil'];
    return novo;
  });

  const fornecedores: Fornecedor[] = bruto.fornecedores.map((f) => {
    const novo = novoFornecedor(f.tipo);
    novo.nome = f.nome;
    novo.cnpj = f.cnpj;
    novo.endereco = f.endereco;
    novo.responsavel = f.responsavel;
    novo.emailsProgramacao = f.emailsProgramacao.length ? f.emailsProgramacao : [''];
    novo.telefone = f.telefone;
    novo.observacoes = f.observacoes;
    return novo;
  });

  const metadata: ImportacaoResultado['metadata'] = {};
  const m = bruto.metadata || {};
  if (m.obraNome) metadata.obraNome = m.obraNome;
  if (m.clienteNome) metadata.clienteNome = m.clienteNome;
  if (m.obraEndereco) metadata.obraEndereco = m.obraEndereco;
  if (m.obraCEP) metadata.obraCEP = m.obraCEP;
  if (m.obraObservacoes) metadata.obraObservacoes = m.obraObservacoes;

  return {
    formato: bruto.formato,
    metadata,
    grupos,
    concretos,
    usuariosObra,
    fornecedores,
    avisos: [...bruto.avisos],
    resumo: {
      formato: bruto.formato,
      estruturas: grupos.length,
      pecas: grupos.reduce((acc, g) => acc + g.pecas.length, 0),
      concretos: concretos.length,
      usuarios: usuariosObra.length,
      fornecedores: fornecedores.length,
      avisos: bruto.avisos.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

/** Lê o File (.xlsx), roda o core e devolve o payload do wizard. */
export async function importarPlanilhaImplantacao(file: File): Promise<ImportacaoResultado> {
  const [xlsxLib, core] = await Promise.all([loadXlsxVendor(), loadCore()]);
  const buffer = await file.arrayBuffer();
  const bruto = core.parse(new Uint8Array(buffer), xlsxLib);
  return converterResultadoCore(bruto);
}
