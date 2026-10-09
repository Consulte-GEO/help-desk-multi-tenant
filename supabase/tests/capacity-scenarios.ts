/** Foundation scenarios registered exclusively by rls.test.ts after its fresh-PG17 guard. */
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {registerCapacityTests as registerCapacityWorkloadTests} from './capacity-workload-scenarios.ts';
import {registerResourceAccessSqlCandidateTests} from './resource-access-scenarios.ts';
export function registerCapacityTests(adminPool:()=>SqlPool){
 registerCapacityWorkloadTests(adminPool);
 registerResourceAccessSqlCandidateTests(adminPool);
}
