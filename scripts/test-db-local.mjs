/** Select explicitly; never fall back from a failed engine to another server. */
const engine=process.env.HELPDESK_TEST_DB_ENGINE??'docker';
if(engine==='docker')await import('./test-db-docker.mjs');
else if(engine==='native')await import('./test-db-native.mjs');
else {console.error('Engine local inválido. Use docker ou native explicitamente. Nenhum banco foi acessado.');process.exitCode=1;}
