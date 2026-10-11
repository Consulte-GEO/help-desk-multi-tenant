/** Read-only prerequisite inspection for a declared candidate package.
 * This does not run tests, authenticate a source, approve a release, or alter Git/DB.
 * A matching subset is not proof that the rest of a checkout is correct.
 */
import {lstat, readFile, readdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

const allowedCommands = new Set([
 'npm run check:lock', 'npm run check:migrations', 'npm test', 'npm run typecheck',
 'npm run check:contracts', 'npm run check:secrets', 'npm run build',
 'npm run test:db:native', 'npm run test:db:local', 'npm run test:ui:local',
 'npm run homologate:local', 'npm run check:homologation',
]);
const digest = data => createHash('sha256').update(data).digest('hex');
const pathIsSafe = path => typeof path === 'string' && path.length <= 400 &&
 /^[A-Za-z0-9_.\-/]+$/.test(path) && !path.startsWith('/') &&
 path.split('/').every(part => part && part !== '.' && part !== '..');
const unique = values => new Set(values).size === values.length;
const pinnedVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
const invalid = () => Error('Invalid consolidation specification.');

function validateSpec(spec) {
 const keys = ['schemaVersion','baseCommit','scope','files','migrations','requiredPaths','dependencies','commands'];
 if (!spec || typeof spec !== 'object' || Array.isArray(spec) ||
  Object.keys(spec).length !== keys.length || keys.some(k => !Object.hasOwn(spec,k)) ||
  spec.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(spec.baseCommit) ||
  spec.scope !== 'candidate-package-only') throw invalid();
 for (const [group,key,max] of [['files','path',1024],['migrations','file',100]]) {
  const rows = spec[group];
  if (!Array.isArray(rows) || !rows.length || rows.length > max ||
   !rows.every(row => row && Object.keys(row).length === 2 && pathIsSafe(row[key]) &&
    /^[a-f0-9]{64}$/.test(row.sha256) &&
    (group !== 'migrations' || /^\d{14}_[A-Za-z0-9_]+\.sql$/.test(row.file))) ||
   !unique(rows.map(row => row[key]))) throw invalid();
 }
 if (!Array.isArray(spec.requiredPaths) || !spec.requiredPaths.length || spec.requiredPaths.length > 100 ||
  !spec.requiredPaths.every(pathIsSafe) || !unique(spec.requiredPaths) ||
  !spec.dependencies || typeof spec.dependencies !== 'object' || Array.isArray(spec.dependencies) ||
  !Object.keys(spec.dependencies).length || Object.keys(spec.dependencies).length > 30 ||
  !Object.entries(spec.dependencies).every(([name,version]) =>
   /^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) && pinnedVersion(version)) ||
  !Array.isArray(spec.commands) || !spec.commands.length || !unique(spec.commands) ||
  !spec.commands.every(c => allowedCommands.has(c))) throw invalid();
}

async function inspectPath(root, path, directory = false) {
 try {
  const parts = path.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
   current = join(current, parts[i]);
   const info = await lstat(current);
   if (info.isSymbolicLink()) return {kind:'unsafe'};
   if (i < parts.length - 1 && !info.isDirectory()) return {kind:'unsafe'};
   if (i === parts.length - 1) {
    if (directory) return info.isDirectory() ? {kind:'directory',path:current} : {kind:'unsafe'};
    if (!info.isFile() || info.size > 8 * 1024 * 1024) return {kind:'unsafe'};
    return {kind:'file',data:await readFile(current)};
   }
  }
 } catch (error) {
  return {kind:error?.code === 'ENOENT' ? 'missing' : 'unreadable'};
 }
 return {kind:'unreadable'};
}

/** Tooling values are observations supplied by the CLI, not security credentials.
 * Unit tests may supply synthetic observations. SQL and CI flags remain false.
 */
export async function inspectConsolidation(root, spec, tooling) {
 validateSpec(spec);
 if (typeof root !== 'string' || !root || !tooling || typeof tooling !== 'object') throw invalid();
 const directory = resolve(root);
 const rootInfo = await lstat(directory).catch(() => null);
 if (!rootInfo || rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw Error('Invalid consolidation root.');
 const blockers = [];
 let matched = 0, matchedMigrations = 0;
 const add = (code,path) => blockers.push({code,...(path ? {path} : {})});
 for (const file of spec.files) {
  const value = await inspectPath(directory,file.path);
  if (value.kind !== 'file') add('source_' + value.kind,file.path);
  else if (digest(value.data) !== file.sha256) add('source_mismatch',file.path);
  else matched++;
 }
 for (const path of spec.requiredPaths) {
  const value = await inspectPath(directory,path);
  if (value.kind !== 'file') add(value.kind === 'missing' ? 'required_file_missing' : 'required_file_unsafe',path);
 }
 for (const migration of spec.migrations) {
  const path = 'supabase/migrations/' + migration.file;
  const value = await inspectPath(directory,path);
  if (value.kind !== 'file') add('migration_' + value.kind,path);
  else if (digest(value.data) !== migration.sha256) add('migration_mismatch',path);
  else matchedMigrations++;
 }
 const migrationDirectory = await inspectPath(directory,'supabase/migrations',true);
 if (migrationDirectory.kind !== 'directory') add('migration_inventory_unavailable');
 else {
  const inventory = await readdir(migrationDirectory.path).catch(() => null);
  const actual = inventory?.filter(p => p.endsWith('.sql')).sort();
  const expected = spec.migrations.map(m => m.file).sort();
  if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) add('migration_inventory_changed');
 }
 const manifestPath = 'supabase/migrations.manifest.json';
 const manifest = await inspectPath(directory,manifestPath);
 try {
  if (manifest.kind !== 'file') throw invalid();
  const parsed = JSON.parse(manifest.data.toString('utf8'));
  if (parsed.format !== 1 || parsed.schemaVersion !== '0.19.0' ||
   !Array.isArray(parsed.migrations) || parsed.migrations.length !== spec.migrations.length ||
   parsed.migrations.some((m,i) => m.file !== spec.migrations[i].file || m.sha256 !== spec.migrations[i].sha256)) throw invalid();
 } catch { add('migration_manifest_mismatch',manifestPath); }
 const node = typeof tooling.nodeVersion === 'string' && /^(\d+)\.(\d+)\.(\d+)$/.exec(tooling.nodeVersion);
 if (!node || Number(node[1]) !== 22 || Number(node[2]) < 16) add('node22_unavailable');
 const postgresOk = typeof tooling.postgresVersion === 'string' && /^17\.\d+(?:\.\d+)?$/.test(tooling.postgresVersion);
 if (!postgresOk) add('postgres17_unavailable');
 const installed = tooling.dependencies ?? {};
 for (const [name,version] of Object.entries(spec.dependencies)) {
  if (installed[name] !== version) add('dependency_not_verified',name);
 }
 return {
  schemaVersion:1, stage:'preflight_only', coverage:'declared-files-and-prerequisites-only',
  status:blockers.length ? 'blocked' : 'ready_for_existing_runners',
  baseCommit:spec.baseCommit,
  packageFingerprint:digest(JSON.stringify(spec.files.map(f => [f.path,f.sha256]))),
  sourceFiles:{expected:spec.files.length,matched},
  baselineMigrations:{expected:spec.migrations.length,matched:matchedMigrations},
  tooling:{nodeVersion:node ? tooling.nodeVersion : null,postgresVersion:postgresOk ? tooling.postgresVersion : null},
  blockers, nextCommands:blockers.length ? [] : [...spec.commands],
  requiredFollowUp:['lock_verification','postgres_integration','upgrade_tests','browser_tests','source_bound_ci','independent_review'],
  sqlExecuted:false,ciExecuted:false,productionApproved:false,
 };
}
