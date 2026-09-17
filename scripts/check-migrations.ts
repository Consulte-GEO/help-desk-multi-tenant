import {loadMigrationBundle} from './migration-files.ts';
try{
 const bundle=await loadMigrationBundle(process.cwd());
 console.log(`Verified ${bundle.migrations.length} migration files; candidate schema ${bundle.schemaVersion}. No SQL executed.`);
}catch{
 console.error('Migration integrity verification failed. Review the manifest and files; nothing was executed or repaired.');
 process.exitCode=1;
}
