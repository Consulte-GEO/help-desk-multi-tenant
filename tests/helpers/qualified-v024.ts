/** Exact immutable operational predecessor, for its dedicated Native stage. */
import type {SqlPool} from '../../src/infrastructure/sql.ts';import {assertSchemaCompatibility as currentSchema,assertDatabaseSecurity as currentSecurity} from '../../src/infrastructure/postgres.ts';
export {DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/consultegeo-v024-security-contract.ts';
export const assertSchemaCompatibility=(pool:SqlPool)=>currentSchema(pool,'0.24.0');
export const assertDatabaseSecurity=(pool:SqlPool)=>currentSecurity(pool,'0.24.0');
