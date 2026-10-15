/**
 * Shim de tipo para o $store da Options API.
 * Sem isto, vue-tsc strict reclama de this.$store.
 */
import type { Store } from 'vuex';

declare module 'vue' {
  interface ComponentCustomProperties {
    $store: Store<unknown>;
  }
}

export {};
