import {verifyConsulteGeoUpgrade} from './consultegeo-upgrade.ts';
try{const r=await verifyConsulteGeoUpgrade(process.cwd());console.log(`Consulte GEO upgrade verified: schema ${r.schemaVersion}, ${r.file}, ${r.sha256}. No SQL executed.`);}
catch{console.error('Consulte GEO upgrade integrity failed. No SQL executed or files repaired.');process.exitCode=1;}
