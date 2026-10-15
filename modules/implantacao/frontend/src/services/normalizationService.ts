/**
 * Serviço de normalização · v5
 *
 * Funções centrais alinhadas 1:1 com o protótipo HTML
 * "prototipo-estrutura-atualizado-v2.html":
 *
 *   normalizeText   — NFD, remove zeros à esquerda, lowercase
 *   parseFck        — aceita "30", "FCK 30", "30 MPa", retorna number (10–100) ou null
 *   parseVolume     — aceita "100", "100,5", "100.5", "100 m³", "-", "" → number | null
 *   expandRange     — "1 A 24" → [1..24], "1 e 2" → [1,2], "ANEXOS" → ['ANEXOS'], "-" → [null]
 *   detectEtapa     — heurística por nome da peça
 *   orderOf         — ordem natural dos pavimentos
 *   formatGroupName — "Bloco 3", "Anexos", "Torre A"
 *   titleCase
 *   slug            — utilitário para chaves técnicas
 */

/* ------------------------------------------------------------------ */
/* texto canônico                                                      */
/* ------------------------------------------------------------------ */

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b0+(\d+)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function titleCase(text: string): string {
  return String(text || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function slug(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30);
}

/* ------------------------------------------------------------------ */
/* FCK                                                                  */
/* ------------------------------------------------------------------ */

/**
 * Aceita: "30", "FCK 30", "FCK30", "30 MPa", "30mpa", "FCK 30mpa".
 * Retorna number entre 10 e 100, ou null se inválido.
 */
export function parseFck(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 10 && n <= 100 ? n : null;
}

/* ------------------------------------------------------------------ */
/* Volume                                                              */
/* ------------------------------------------------------------------ */

/**
 * Aceita: "100", "100,5", "100.5", "100 m³", "100,50 m3", "-", "".
 * Retorna number ou null.
 *   "-"  → null (não aplicável)
 *   ""   → null (ausente)
 *   inválido → null
 *
 * v5.22.7: limita a 2 casas decimais. Valores com mais de 2 casas são
 * REJEITADOS (retorna null) — a UI no Step5 já impede digitar a 3ª casa
 * via input mask, então isso é defesa em profundidade contra dados
 * vindos do Excel, copy-paste, ou snapshots antigos.
 */
export function parseVolume(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const clean = String(value).replace(/m³|m3|M³|M3/g, '').trim();
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  // v5.22.7: rejeita se tiver mais de 2 casas decimais
  const m = /^-?\d+(?:\.(\d+))?$/.exec(normalized);
  if (m && m[1] && m[1].length > 2) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * v5.22.7: detecta SE o input do usuário tinha mais de 2 casas decimais.
 * Usado pelo validationService pra emitir um warning específico
 * (diferente de "volume vazio" ou "volume inválido").
 */
export function volumeHasTooManyDecimals(value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === '-') return false;
  const clean = String(value).replace(/m³|m3|M³|M3/g, '').trim();
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const m = /^-?\d+(?:\.(\d+))?$/.exec(normalized);
  return !!(m && m[1] && m[1].length > 2);
}

/**
 * v5.22.7: máscara aplicada em onInput de campos de volume.
 * Recebe o que o usuário acabou de digitar; devolve a versão "limpa"
 * com no máximo 2 casas decimais. Preserva vírgula/ponto conforme o
 * usuário digitou. Não muda valores válidos.
 *
 * Exemplos:
 *   "100,123"  → "100,12"
 *   "100.456"  → "100.45"
 *   "100"      → "100"
 *   "100,5"    → "100,5"
 *   "100,50"   → "100,50"
 *   "100 m3"   → "100 m3"
 *   ""         → ""
 *   "-"        → "-"
 */
export function maskVolumeInput(input: string): string {
  if (!input) return input;
  // Não mexer em "-" e literais sem dígitos decimais
  if (input.trim() === '-') return input;
  // Detecta vírgula ou ponto como separador decimal
  const sepMatch = /^([^,.]*)([,.])(\d*)(.*)$/.exec(input);
  if (!sepMatch) return input; // sem separador, sem o que limitar
  const [, before, sep, decimals, after] = sepMatch;
  if (decimals.length <= 2) return input;
  return before + sep + decimals.slice(0, 2) + after;
}

/* ------------------------------------------------------------------ */
/* expandRange — chave do fluxo "Grupos"                               */
/* ------------------------------------------------------------------ */

/**
 * Aceita:
 *   ""              → []
 *   "ANEXOS"        → ['ANEXOS']
 *   "-"             → [null]
 *   "1 A 24" / "1 até 24" / "1-24" → [1..24]  (até 1001 itens)
 *   "1 e 2"          → [1, 2]
 *   "1, 2, 5, 6 e 9" → [1, 2, 5, 6, 9]
 *   "Torre A, Torre B" → ['Torre A', 'Torre B']  (cai no fallback de texto)
 */
export function expandRange(input: unknown): Array<number | string | null> {
  const raw = String(input ?? '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  if (upper === 'ANEXOS') return ['ANEXOS'];
  if (upper === '-') return [null];

  const normalized = raw
    .replace(/\s+/g, ' ')
    .replace(/\s+[Ee]\s+/g, ',')
    .trim();

  const interval = normalized.match(/^(\d+)\s*(?:A|a|AO|ao|AT[EÉ]|até|-)\s*(\d+)$/i);
  if (interval) {
    const start = Number(interval[1]);
    const end = Number(interval[2]);
    if (start <= end && end - start <= 1000) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }

  const numbersOnly = normalized.replace(/;/g, ',');
  if (/^[\d\s,]+$/.test(numbersOnly)) {
    return numbersOnly
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number);
  }

  // Texto livre separado por vírgula — preserva os nomes individuais.
  if (numbersOnly.includes(',')) {
    return numbersOnly
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [raw];
}

/* ------------------------------------------------------------------ */
/* Detecção de etapa por nome da peça                                  */
/* ------------------------------------------------------------------ */

export function detectEtapa(nome: string): string {
  const n = normalizeText(nome);
  if (/estaca|broca|sapata|radier|tubulao|coroamento|cintamento|fundacao|lajao/.test(n))
    return 'Fundação';
  if (/muro|arrimo|diafragma|contencao|cortina/.test(n)) return 'Contenção';
  if (
    /guarita|piscina|churrasqueira|area externa|garagem|casa de bombas|loja|edicula|pavimentacao/.test(
      n,
    )
  )
    return 'Anexos';
  if (/terreo|pav|subsolo|atico|cobertura|platibanda|barrilete|caixa/.test(n))
    return 'Estrutura';
  return 'Estrutura';
}

/* ------------------------------------------------------------------ */
/* Ordem natural dos pavimentos                                        */
/* ------------------------------------------------------------------ */

export function orderOf(local: string): number {
  const n = normalizeText(local);
  if (/subsolo/.test(n)) {
    const m = n.match(/(\d+)/);
    return m ? -Number(m[1]) : -1;
  }
  if (/terreo|térreo/i.test(local) || /terreo/.test(n)) return 0;
  const m = n.match(/(\d+)/);
  if (/pav|tipo/.test(n) && m) return Number(m[1]);
  if (/atico/.test(n)) return 900;
  if (/cobertura/.test(n)) return 910;
  if (/platibanda/.test(n)) return 920;
  if (/barrilete/.test(n)) return 930;
  if (/caixa/.test(n)) return 940;
  return 100;
}

/* ------------------------------------------------------------------ */
/* Nome legível do grupo expandido                                     */
/* ------------------------------------------------------------------ */

/**
 * Nome legível de uma estrutura expandida.
 *
 * `primary`  recebe a **Nomenclatura no Sistema** (`grupo.nome`) — é o que
 *            o cliente quer ver replicado nas estruturas. Ex.: "Bloco",
 *            "Torre A", "B".
 * `fallback` recebe o **Tipo de Estrutura** (`grupo.tipoEdificacao`),
 *            usado apenas se `primary` estiver vazio.
 *
 * Resultado: `${label} ${numero}` (ex.: "Bloco 1", "Torre A 3").
 * Se `numero` for nulo ou ANEXOS, retorna sem sufixo.
 */
export function formatGroupName(
  primary: string,
  numero: number | string | null | undefined,
  fallback?: string,
): string {
  const primaryClean = (primary || '').trim();
  const labelRaw = primaryClean || (fallback || '').trim() || 'Estrutura';
  if (numero === null || numero === undefined || numero === '') {
    return titleCase(labelRaw);
  }
  if (numero === 'ANEXOS') return 'Anexos';
  const label = titleCase(labelRaw);
  if (/torre|bloco|casa|estrutura/i.test(String(numero))) {
    return String(numero).trim();
  }
  return `${label} ${numero}`;
}

/* ------------------------------------------------------------------ */
/* v5.22.8 — CNPJ                                                      */
/* ------------------------------------------------------------------ */

/**
 * v5.22.8: extrai apenas os 14 dígitos de um CNPJ.
 *   "34.230.979/0076-23" → "34230979007623"
 *   ""                   → ""
 *   "abc"                → ""
 */
export function cnpjDigits(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\D/g, '');
}

/**
 * v5.22.8: valida CNPJ pelo dígito verificador (Algoritmo da Receita Federal).
 * Retorna `true` para CNPJ formalmente válido, `false` para inválido.
 *
 * Comportamento intencional:
 *   - string vazia retorna `false` (não é um CNPJ "válido")
 *   - 14 dígitos iguais (00000000000000, 11111111111111, etc) retorna `false`
 *   - aceita CNPJ formatado ou não — só os 14 dígitos importam
 *
 * Não detecta CNPJs inativos / baixados — só validade formal.
 * Use isto apenas como SUGESTÃO no validationService; não bloqueia
 * o submit. Cliente pode estar digitando CNPJ estrangeiro / parcial.
 */
export function isValidCNPJ(input: unknown): boolean {
  const digits = cnpjDigits(input);
  if (digits.length !== 14) return false;
  // Rejeita sequências de dígito repetido (00000000000000, 11111111111111, …)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Algoritmo padrão de DV1 + DV2
  const calcDV = (slice: string, pesos: number[]): number => {
    const soma = slice
      .split('')
      .reduce((acc, ch, i) => acc + Number(ch) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const pesosDV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosDV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcDV(digits.slice(0, 12), pesosDV1);
  if (dv1 !== Number(digits[12])) return false;
  const dv2 = calcDV(digits.slice(0, 13), pesosDV2);
  if (dv2 !== Number(digits[13])) return false;
  return true;
}
