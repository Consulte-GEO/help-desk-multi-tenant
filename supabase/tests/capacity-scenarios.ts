/** Foundation scenarios registered exclusively by rls.test.ts after its fresh-PG17 guard. */
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {registerCapacityTests as registerCapacityWorkloadTests} from './capacity-workload-scenarios.ts';
import {registerResourceAccessSqlCandidateTests} from './resource-access-scenarios.ts';
import {registerResourceScopeStoreSqlTests} from './resource-scope-store-scenarios.ts';
import {registerResourcePublicationSqlTests} from './resource-publication-scenarios.ts';
import {registerExecutionChecklistSqlTests} from './execution-checklist-scenarios.ts';
import {registerSupportWorkflowSqlTests} from './support-workflow-scenarios.ts';
import {registerConsulteGeoConfigurationSqlTests} from './consultegeo-configuration-scenarios.ts';
export function registerCapacityTests(adminPool:()=>SqlPool){
 registerCapacityWorkloadTests(adminPool);
 registerResourceAccessSqlCandidateTests(adminPool);
 registerResourceScopeStoreSqlTests(adminPool);
 registerResourcePublicationSqlTests(adminPool);
 registerExecutionChecklistSqlTests(adminPool);
 registerSupportWorkflowSqlTests(adminPool);
 registerConsulteGeoConfigurationSqlTests(adminPool);
}
