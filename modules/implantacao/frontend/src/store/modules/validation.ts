/**
 * Vuex module: validation · v5
 *
 * Roda `validateSnapshot()` sob demanda e mantém o resultado para a Etapa 6.
 */

import type { Module } from 'vuex';
import type { SetupSnapshot } from '../../models/setup.models';
import type { ValidationResult } from '../../models/validation.models';
import {
  validateSnapshot,
  type ValidationBuckets,
} from '../../services/validationService';

export interface ValidationState {
  lastResult: ValidationBuckets | null;
  validatedAt: string | null;
}

const validationModule: Module<ValidationState, unknown> = {
  namespaced: true,
  state: () => ({ lastResult: null, validatedAt: null }),
  getters: {
    summary: (state): ValidationResult | null => state.lastResult,
    blocking: (state) => Boolean(state.lastResult?.blocking),
    bloqueantes: (state) => state.lastResult?.bloqueantes ?? [],
    alertas: (state) => state.lastResult?.alertas ?? [],
    sugestoes: (state) => state.lastResult?.sugestoes ?? [],
    pendenciasInternas: (state) => state.lastResult?.pendenciasInternas ?? [],
  },
  mutations: {
    setResult(state, result: ValidationBuckets) {
      state.lastResult = result;
      state.validatedAt = new Date().toISOString();
    },
    clear(state) {
      state.lastResult = null;
      state.validatedAt = null;
    },
  },
  actions: {
    validate({ commit }, snapshot: SetupSnapshot) {
      const result = validateSnapshot(snapshot);
      commit('setResult', result);
      return result;
    },
  },
};

export default validationModule;
