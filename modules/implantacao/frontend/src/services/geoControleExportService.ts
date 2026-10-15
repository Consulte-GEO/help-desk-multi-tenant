/**
 * Exportador "GEO Controle Tecnológico" (Supabase/Postgres) · v1.2
 *
 * Converte o SetupSnapshot do wizard no PAYLOAD do contrato `criar_obra(jsonb)`
 * do GEO Controle Tecnológico (codebase geomat). É o JSON que o wizard de
 * "Nova obra" do produto importa (botão "Importar JSON") para pré-implantar a
 * obra: obra + concretos + grupos + TIPOS DE UNIDADE + unidades + usuários +
 * fornecedores, com o projetista (texto livre) catalogado e vinculado.
 *
 * IMPORTANTE: este é um alvo DIFERENTE do `jsonGeneratorService` (que mapeia para
 * o modelo legado SQL Server `Ges_*`/`Pro_Projetista`). Aqui o destino é o
 * Postgres/Supabase. Estável e independente: os dois exports coexistem.
 *
 * v1.2 (IMP-01): tipos não compartilham grupos/locais/volumes/projetistas
 * diferentes; volume de projeto preservado por tipo, sem somar repetições.
 * A forma do payload é preservada; o destino ainda exige qualificação.
 *
 * Histórico v1.1 (v5.22.40):
 *   - concretos carregam `slumpPrevisto`/`slumpTolerancia`/`validadeMinutos`
 *     (slump/tolerância são extraídos da descrição, ex.: "… SLUMP 10±2 CM");
 *     habilita a NC automática de slump no recebimento do geomat.
 *   - catálogo de `tipos[]` de unidade DERIVADO das peças (agrupadas por
 *     etapa|fck|concreto); cada peça aponta o tipo por `tipoTempId`. O FCK de
 *     projeto do tipo é derivado do concreto no geomat. "Forma obrigatória" e
 *     "tolerância de resistência" NÃO fazem parte do contrato; projetista é opcional.
 *
 * Forma de saída (chaves lidas por `criar_obra`):
 *   { dadosBasicos, concretos[], tipos[], grupos[], pecas[], usuarios[], fornecedores[] }
 * + `meta` (apenas rastreabilidade; o backend e o importador ignoram extras).
 */

import {
  expandRange, formatGroupName,
} from './normalizationService';
import type {
  Concreto, Fornecedor, Grupo, PadraoMoldagem, Peca, SetupSnapshot, UsuarioObra,
} from '../models/setup.models';

export const GEO_CONTROLE_SCHEMA = 'geo-controle-tecnologico.implantacao';
export const GEO_CONTROLE_SCHEMA_VERSION = '1.2.0';

export interface GeoControleDadosBasicos {
  obraNome: string; obraCodigo: string; cliente: string; regional: string;
  municipio: string; uf: string; endereco: string; cep: string;
  responsavelNome: string; responsavelEmail: string; responsavelTelefone: string;
  observacoes: string;
}
export interface GeoControleConcreto {
  id: string; descricao: string; aplicacao: string;
  fck: number | string;
  slumpPrevisto: number | string | null;
  slumpTolerancia: number | string | null;
  validadeMinutos: number | string | null;
  padroesMoldagem: PadraoMoldagem[];
}
// Tipo de unidade (Estacas, Laje, Pilar…) → unit_types no geomat. O FCK de projeto
// é DERIVADO do concreto; projetista é opcional. "forma"/"tolerância" não entram.
export interface GeoControleTipo {
  id: string; nome: string; etapa: string; concretoTempId: string;
  croquiObrigatorio: boolean; volumeProjeto: number | string; projetista: string;
}
export interface GeoControleGrupo {
  id: string; nome: string; tipoEdificacao: string; projetista: string;
  edificacoes: string; observacoes: string;
}
export interface GeoControlePeca {
  grupoTempId: string; tipoTempId: string; concretoTempId: string; local: string;
  etapa: string; fck: number | string; volume: string; observacoes: string;
}
export interface GeoControleUsuario {
  nome: string; email: string; cargo: string; telefone: string; perfil: string;
}
export interface GeoControleFornecedor {
  tipo: 'usina' | 'laboratorio'; nome: string; cnpj: string; responsavel: string;
  telefone: string; endereco: string; emailsProgramacao: string[];
}
export interface GeoControlePayload {
  meta: {
    schema: string;
    schemaVersion: string;
    generatedAt: string;
    source: string;
    target: 'geomat:criar_obra';
    draftId: string | null;
    submissionId: string | null;
    obraNome: string;
    projetistas: string[];
    counts: { grupos: number; concretos: number; tipos: number; pecas: number; usuarios: number; fornecedores: number; projetistas: number };
  };
  dadosBasicos: GeoControleDadosBasicos;
  concretos: GeoControleConcreto[];
  tipos: GeoControleTipo[];
  grupos: GeoControleGrupo[];
  pecas: GeoControlePeca[];
  usuarios: GeoControleUsuario[];
  fornecedores: GeoControleFornecedor[];
}

export interface BuildGeoControleOptions {
  draftId?: string | null;
  submissionId?: string | null;
}

/** Prévia expandida da estrutura (mesma regra do editor): só rastreabilidade no `meta`. */
function expandedGroupNames(grupo: Grupo): string[] {
  const expanded = expandRange(grupo.edificacoesInput);
  if (expanded.length) return expanded.map((n) => formatGroupName(grupo.nome, n, grupo.tipoEdificacao));
  return grupo.nome ? [grupo.nome] : [];
}

/** Especificação de SLUMP com unidade documentada. FLOW não cabe nos campos
 * slump_* deste contrato: preservamos a descrição e deixamos esses campos nulos.
 * Unidade ausente não é inferida pela magnitude do número.
 */
function parseSlump(descricao: string): { previsto: number; tolerancia: number } | null {
  const raw = descricao || '';
  if (/FLOW|ESPALHAMENTO|AUTO\s*ADENS[ÁA]VEL/i.test(raw)) return null;
  const m = /(?:SLUMP|ABATIMENTO)\s*([0-9]+(?:[.,][0-9]+)?)\s*(CM\b|MM\b)?\s*(?:±|\+\s*\/\s*-|\+\s*-)\s*([0-9]+(?:[.,][0-9]+)?)\s*(CM\b|MM\b)?/i.exec(raw);
  if (!m) return null;
  const unit = (m[2] || m[4] || '').toUpperCase();
  const toleranceUnit = (m[4] || m[2] || '').toUpperCase();
  if (!unit || !toleranceUnit) return null;
  const previsto = Number(m[1].replace(',', '.')) / (unit === 'MM' ? 10 : 1);
  const tolerancia = Number(m[3].replace(',', '.')) / (toleranceUnit === 'MM' ? 10 : 1);
  return Number.isFinite(previsto) && Number.isFinite(tolerancia) ? { previsto, tolerancia } : null;
}

function mapDadosBasicos(snapshot: SetupSnapshot): GeoControleDadosBasicos {
  const m = snapshot.metadata;
  const created = m.createdBy ?? { nome: '', email: '', telefone: '', userId: '' };
  const mpf = m.modeloProjetoFields ?? { idCRM: '', estadoRegional: '', gestorObra: '', gestorExecutivoDiretor: '' };
  return {
    obraNome: (m.obraNome ?? '').trim(),
    // o wizard não coleta código/município/UF — deixados em branco; o criar_obra
    // gera OBRA-<token> quando o código vem vazio.
    obraCodigo: '',
    cliente: (m.clienteNome ?? '').trim(),
    regional: (mpf.estadoRegional ?? '').trim(),
    municipio: '',
    uf: '',
    endereco: (m.obraEndereco ?? '').trim(),
    cep: (m.obraCEP ?? '').trim(),
    responsavelNome: (created.nome ?? '').trim(),
    responsavelEmail: (created.email ?? '').trim(),
    responsavelTelefone: (created.telefone ?? '').trim(),
    observacoes: (m.obraObservacoes ?? '').trim(),
  };
}

function mapConcreto(c: Concreto): GeoControleConcreto {
  const s = parseSlump(c.descricao ?? '');
  return {
    id: c.id,
    descricao: (c.descricao ?? '').trim(),
    aplicacao: (c.aplicacao ?? '').trim(),
    fck: c.fck,
    // slump/tolerância derivados da descrição → operational_materials.slump_*; o
    // geomat liga a NC automática de slump no recebimento quando presentes.
    slumpPrevisto: s ? s.previsto : null,
    slumpTolerancia: s ? s.tolerancia : null,
    validadeMinutos: null,
    // o shape de PadraoMoldagem é idêntico ao do geomat (foi portado de lá): 1:1.
    padroesMoldagem: Array.isArray(c.padroesMoldagem) ? c.padroesMoldagem : [],
  };
}

function mapGrupo(g: Grupo): GeoControleGrupo {
  return {
    id: g.id,
    nome: (g.nome ?? '').trim(),
    tipoEdificacao: String(g.tipoEdificacao ?? '').trim(),
    projetista: (g.projetista ?? '').trim(),
    // o editor guarda o range bruto em edificacoesInput → vira unit_groups.edificacoes
    edificacoes: (g.edificacoesInput ?? '').trim() || '-',
    observacoes: (g.observacoes ?? '').trim(),
  };
}

function mapPeca(grupoId: string, tipoTempId: string, p: Peca): GeoControlePeca {
  return {
    grupoTempId: grupoId,
    tipoTempId,
    concretoTempId: p.concretoId ?? '',
    local: (p.local ?? '').trim(),
    etapa: String(p.etapa ?? '').trim(),
    fck: p.fck,
    volume: String(p.volume ?? '').trim(),
    observacoes: (p.observacoes ?? '').trim(),
  };
}

function mapUsuario(u: UsuarioObra): GeoControleUsuario {
  return {
    nome: (u.nome ?? '').trim(),
    email: (u.email ?? '').trim(),
    cargo: (u.cargo ?? '').trim(),
    telefone: (u.telefone ?? '').trim(),
    perfil: u.perfil ?? '',
  };
}

function mapFornecedor(f: Fornecedor): GeoControleFornecedor {
  return {
    tipo: f.tipo === 'laboratorio' ? 'laboratorio' : 'usina',
    nome: (f.nome ?? '').trim(),
    cnpj: (f.cnpj ?? '').trim(),
    responsavel: (f.responsavel ?? '').trim(),
    telefone: (f.telefone ?? '').trim(),
    endereco: (f.endereco ?? '').trim(),
    emailsProgramacao: (f.emailsProgramacao ?? []).map((e) => (e ?? '').trim()).filter(Boolean),
  };
}

/** Constrói o payload `criar_obra` do GEO Controle Tecnológico a partir do snapshot. */
export function buildGeoControlePayload(
  snapshot: SetupSnapshot,
  options: BuildGeoControleOptions = {},
): GeoControlePayload {
  const dadosBasicos = mapDadosBasicos(snapshot);
  const concretos = (snapshot.concretos ?? []).map(mapConcreto);
  const grupos = (snapshot.grupos ?? []).map(mapGrupo);

  // projetista por grupo (id → texto), para preencher o tipo derivado
  const grupoProjById = new Map<string, string>();
  for (const g of grupos) grupoProjById.set(g.id, g.projetista);

  // peças aninhadas por grupo → lista achatada (grupoTempId/concretoTempId) +
  // catálogo de TIPOS DE UNIDADE por equivalência explícita dos atributos.
  const pecas: GeoControlePeca[] = [];
  const tipos: GeoControleTipo[] = [];
  const tipoByKey = new Map<string, GeoControleTipo>();
  let tipoSeq = 0;
  for (const g of snapshot.grupos ?? []) {
    for (const p of g.pecas ?? []) {
      const concretoTempId = p.concretoId ?? '';
      const etapa = String(p.etapa ?? '').trim();
      const fckStr = p.fck === '' || p.fck === null || p.fck === undefined ? '' : String(p.fck);
      // V16 / IMP-01: equivalência conservadora dentro do grupo. A chave
      // anterior perdia local, projetista, volume e observações; JSON evita
      // colisões quando o texto do cliente contém o separador "|".
      const key = JSON.stringify([
        g.id, (p.local ?? '').trim(), etapa, fckStr, concretoTempId,
        String(p.volume ?? '').trim(), (grupoProjById.get(g.id) ?? '').trim(),
        (p.observacoes ?? '').trim(),
      ]);
      let tipo = tipoByKey.get(key);
      if (!tipo) {
        tipoSeq += 1;
        tipo = {
          id: `tip-${tipoSeq}`,
          // nome real a partir da primeira peça do grupo (fallback genérico);
          // vira unit_types.nome no geomat (resolve o nome derivado genérico).
          nome: (p.local ?? '').trim() || `Tipo ${etapa || '—'}`,
          etapa,
          concretoTempId,
          croquiObrigatorio: true,
          volumeProjeto: String(p.volume ?? '').trim(),
          projetista: (grupoProjById.get(g.id) ?? '').trim(),
        };
        tipoByKey.set(key, tipo);
        tipos.push(tipo);
      }
      pecas.push(mapPeca(g.id, tipo.id, p));
    }
  }

  const usuarios = (snapshot.usuariosObra ?? []).map(mapUsuario);
  const fornecedores = (snapshot.fornecedores ?? []).map(mapFornecedor);

  // projetistas distintos (case-insensitive): grupos + tipos. Só para o bloco meta.
  const projSet = new Map<string, string>();
  for (const g of grupos) {
    const nome = g.projetista.trim();
    if (nome) projSet.set(nome.toLowerCase(), nome);
  }
  for (const t of tipos) {
    const nome = t.projetista.trim();
    if (nome) projSet.set(nome.toLowerCase(), nome);
  }
  const projetistas = Array.from(projSet.values());

  return {
    meta: {
      schema: GEO_CONTROLE_SCHEMA,
      schemaVersion: GEO_CONTROLE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'cadastro-simplificado-estrutura',
      target: 'geomat:criar_obra',
      draftId: options.draftId ?? null,
      submissionId: options.submissionId ?? null,
      obraNome: dadosBasicos.obraNome,
      projetistas,
      counts: {
        grupos: grupos.length,
        concretos: concretos.length,
        tipos: tipos.length,
        pecas: pecas.length,
        usuarios: usuarios.length,
        fornecedores: fornecedores.length,
        projetistas: projetistas.length,
      },
    },
    dadosBasicos,
    concretos,
    tipos,
    grupos,
    pecas,
    usuarios,
    fornecedores,
  };
}

/** Nome de arquivo do export (slug da obra + timestamp). */
export function buildGeoControleFilename(snapshot: SetupSnapshot): string {
  const slug = (snapshot.metadata.obraNome || 'sem-nome').toString().trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-nome';
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  return `geo-controle-${slug}-${ts}.json`;
}

/** Aviso opcional para a UI: campos que o produto vai completar (não coletados aqui). */
export function geoControleGaps(snapshot: SetupSnapshot): string[] {
  const gaps: string[] = [];
  const totalPecas = (snapshot.grupos ?? []).reduce((acc, g) => acc + (g.pecas?.length ?? 0), 0);
  if ((snapshot.grupos ?? []).length === 0) gaps.push('Nenhuma estrutura cadastrada.');
  if ((snapshot.concretos ?? []).length === 0) gaps.push('Nenhum traço de concreto cadastrado.');
  if (totalPecas === 0) gaps.push('Nenhuma peça/pavimento cadastrado.');
  gaps.push('Código da obra, município e UF não são coletados aqui — preencher no GEO Controle (o código é gerado se ficar vazio).');
  return gaps;
}
