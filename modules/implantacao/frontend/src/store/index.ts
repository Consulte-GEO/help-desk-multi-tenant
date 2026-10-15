import { createStore } from 'vuex';
import setup from './modules/setup';
import validation from './modules/validation';
import exportModule from './modules/export';

export interface RootState {
  /* preenchido por módulos */
}

const store = createStore({
  modules: {
    setup,
    validation,
    export: exportModule,
  },
});

export default store;
