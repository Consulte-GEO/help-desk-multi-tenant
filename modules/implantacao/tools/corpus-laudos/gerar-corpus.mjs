#!/usr/bin/env node
/**
 * gerar-corpus.mjs · Implantação Consulte GEO · V14
 *
 * Monta um corpus LOCAL (não versionado) a partir de PDFs de laudos reais para
 * medir a qualidade do motor: quantos campos vieram com valor, quantos ausentes,
 * quantos ilegíveis e quantas linhas por arquivo.
 *
 *   node tools/corpus-laudos/gerar-corpus.mjs <pasta-com-pdfs> [saida.json]
 *
 * REGRA DO PROJETO: nada do que sai daqui entra no repositório. O manifesto
 * versionado (manifest.json) é sintético de propósito — laudo de cliente não
 * vira fixture. A saída default fica em tools/corpus-laudos/local/, que está
 * no .gitignore.
 *
 * O texto posicional é extraído com o mesmo pdf.js que a página usa, para que a
 * medição reflita o que o usuário vê.
 */
import { readdirSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const entrada = process.argv[2];
if (!entrada) {
  console.error('uso: node tools/corpus-laudos/gerar-corpus.mjs <pasta-com-pdfs> [saida.json]');
  process.exit(2);
}
const saida = process.argv[3] || join(here, 'local', `corpus-${new Date().toISOString().slice(0, 10)}.json`);

const ctx = { console, structuredClone, setTimeout, clearTimeout };
ctx.globalThis = ctx;
createContext(ctx);
for (const nome of ['laudo-perfis.js', 'laudo-invariantes.js', 'laudo-parser-core.js']) {
  runInContext(readFileSync(join(root, 'frontend/public/assets', nome), 'utf8'), ctx, { filename: nome });
}

const pdfjs = await import(pathToFileURL(join(root, 'frontend/public/vendor/pdf.mjs')).href);

/** Mesma reconstrução posicional da página (colunas por largura mediana de caractere). */
async function textoPosicional(caminho) {
  const data = new Uint8Array(readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise;
  const paginas = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const itens = content.items
      .filter((it) => (it.str || '').trim() && it.transform)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }));
    const larguras = itens.filter((i) => i.str.trim().length >= 2 && i.w > 0).map((i) => i.w / i.str.length).sort((a, b) => a - b);
    const charW = larguras.length ? larguras[Math.floor(larguras.length / 2)] : 5;
    itens.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    for (const it of itens) {
      const ultima = linhas[linhas.length - 1];
      if (ultima && Math.abs(ultima[0].y - it.y) <= 2) ultima.push(it);
      else linhas.push([it]);
    }
    paginas.push(linhas.map((linha) => {
      linha.sort((a, b) => a.x - b.x);
      let out = '';
      for (const it of linha) {
        const col = Math.max(0, Math.round(it.x / charW));
        if (col > out.length) out += ' '.repeat(col - out.length);
        else if (out.length && !out.endsWith(' ')) out += ' ';
        out += it.str;
      }
      return out;
    }).join('\n'));
  }
  await doc.destroy();
  return paginas.join('\f');
}

const CAMPOS = ['cp', 'nf', 'idade', 'mpa', 'dataMoldagem', 'dataRompimento'];
const arquivos = readdirSync(entrada).filter((n) => /\.pdf$/i.test(n));
if (!arquivos.length) { console.error(`nenhum PDF em ${entrada}`); process.exit(2); }

const itens = [];
const total = { arquivos: 0, resultados: 0, valor: 0, ausente: 0, ilegivel: 0, semNf: 0, erros: 0 };
for (const nome of arquivos) {
  try {
    const texto = await textoPosicional(join(entrada, nome));
    const doc = ctx.LaudoParserCore.parseDocumentoTexto(texto, { incluirCustomerInput: false });
    const contagem = { valor: 0, ausente: 0, ilegivel: 0 };
    for (const r of doc.resultados) for (const campo of CAMPOS) contagem[r[campo]?.estado === 'valor' ? 'valor' : r[campo]?.estado === 'ilegivel' ? 'ilegivel' : 'ausente'] += 1;
    const semNf = doc.resultados.filter((r) => !r.nf.valor).length;
    itens.push({
      arquivo: basename(nome), perfil: doc.metadata.perfilDetectado, fonte: doc.metadata.fonte,
      paginas: doc.diagnostico.paginas, escaneadas: doc.diagnostico.paginasEscaneadas,
      resultados: doc.resultados.length, semNf, campos: contagem,
      nfPorOrigem: doc.resultados.reduce((acc, r) => { const k = r.nf.origem || 'ausente'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
    });
    total.arquivos += 1; total.resultados += doc.resultados.length; total.semNf += semNf;
    total.valor += contagem.valor; total.ausente += contagem.ausente; total.ilegivel += contagem.ilegivel;
  } catch (error) {
    total.erros += 1;
    itens.push({ arquivo: basename(nome), erro: String(error && error.message || error) });
  }
}

const campos = total.valor + total.ausente + total.ilegivel;
const resumo = {
  gerado_em: new Date().toISOString(),
  pasta: entrada,
  ...total,
  preenchimento_pct: campos ? Math.round((total.valor / campos) * 1000) / 10 : 0,
  linhas_sem_nf_pct: total.resultados ? Math.round((total.semNf / total.resultados) * 1000) / 10 : 0,
};
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify({ resumo, itens }, null, 2));
console.log(JSON.stringify(resumo, null, 2));
console.log(`\ncorpus salvo em ${saida}`);
console.log('Nenhum conteúdo de laudo é gravado: só contagens por arquivo.');
