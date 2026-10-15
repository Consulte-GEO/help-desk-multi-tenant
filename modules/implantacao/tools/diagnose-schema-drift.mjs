#!/usr/bin/env node
/**
 * diagnose-schema-drift.mjs · v5.22.46
 *
 * Compara o que as migrations do REPOSITÓRIO criam com o que existe de fato no
 * banco Supabase. Nasceu de um achado real da auditoria V9: o banco remoto
 * estava com três funções ausentes e uma migration (009) inaplicável, porque a
 * coluna `client_token` que ela usa nunca existiu — o modelo real usa
 * `setup_tickets.access_token`.
 *
 * NÃO altera nada. Só lê e imprime o diagnóstico.
 *
 * Uso:
 *   SUPABASE_DB_URL="postgresql://..." node tools/diagnose-schema-drift.mjs
 *   # ou, sem conexão, apenas para listar o que o repositório espera:
 *   node tools/diagnose-schema-drift.mjs --repo-only
 *
 * Sem driver de banco instalado, o script imprime o SQL pronto para você rodar
 * no SQL Editor do Supabase e conferir manualmente.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG = join(ROOT, 'supabase', 'migrations');

const arquivos = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();

const funcoes = new Set();
const tabelas = new Set();
const colunas = new Set();

for (const f of arquivos) {
  const sql = readFileSync(join(MIG, f), 'utf8');
  for (const m of sql.matchAll(/create (?:or replace )?function\s+(?:public\.)?([a-z0-9_]+)/gi)) funcoes.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) tabelas.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/alter table\s+(?:public\.)?([a-z0-9_]+)[\s\S]{0,200}?add column\s+(?:if not exists\s+)?([a-z0-9_]+)/gi)) {
    colunas.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }
}

console.log(`\nMigrations lidas: ${arquivos.length}`);
console.log(`Objetos esperados pelo repositório:`);
console.log(`  tabelas : ${tabelas.size}`);
console.log(`  funções : ${funcoes.size}`);
console.log(`  colunas adicionadas por ALTER: ${colunas.size}`);

const sqlVerificacao = `
-- ============================================================================
-- Verificação de deriva de schema · gerado por tools/diagnose-schema-drift.mjs
-- Rode no SQL Editor do Supabase. Qualquer linha "FALTANDO" é deriva real.
-- ============================================================================
with esperadas(tipo, nome) as (values
${[...[...tabelas].map((t) => `  ('tabela','${t}')`), ...[...funcoes].map((f) => `  ('funcao','${f}')`)].join(',\n')}
)
select e.tipo, e.nome,
       case
         when e.tipo = 'tabela' and to_regclass('public.'||e.nome) is not null then 'ok'
         when e.tipo = 'funcao' and exists (
              select 1 from pg_proc p
              where p.proname = e.nome and p.pronamespace = 'public'::regnamespace) then 'ok'
         else 'FALTANDO'
       end as status
from esperadas e
order by status desc, e.tipo, e.nome;

-- Migrations registradas no banco (compare com supabase/migrations/):
select version, name from supabase_migrations.schema_migrations order by version;
`.trim();

if (process.argv.includes('--repo-only') || !process.env.SUPABASE_DB_URL) {
  console.log('\nSem SUPABASE_DB_URL — imprimindo o SQL de verificação para rodar manualmente:\n');
  console.log(sqlVerificacao);
  console.log('\nDica: a auditoria V9 encontrou FALTANDO em: resubmit_by_client_token,');
  console.log('return_submission_with_comment, update_technical_json_by_client_token.');
  process.exit(0);
}

let pg;
try {
  pg = (await import('pg')).default;
} catch {
  console.log('\nDriver `pg` não instalado (npm i pg). SQL de verificação:\n');
  console.log(sqlVerificacao);
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();
const { rows } = await client.query(sqlVerificacao.split('-- Migrations registradas')[0]);
await client.end();

const faltando = rows.filter((r) => r.status === 'FALTANDO');
for (const r of rows) console.log(`  ${r.status === 'ok' ? '✓' : '✗'} ${r.tipo} ${r.nome}`);
console.log(`\n${rows.length - faltando.length}/${rows.length} presentes · ${faltando.length} FALTANDO`);
process.exit(faltando.length ? 1 : 0);
