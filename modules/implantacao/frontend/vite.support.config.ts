import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {supportLegacyPlugin} from './support-build.mjs';
const base=dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins:[supportLegacyPlugin(base),vue()],
  base:'/implantacao/',publicDir:false,
  resolve:{alias:[
    {find:/^(.*\/)?supabaseClient(?:\.ts)?$/,replacement:resolve(base,'src/support/backend.ts')},
    {find:/^(.*\/)?authService(?:\.ts)?$/,replacement:resolve(base,'src/support/auth.ts')},
    {find:/^(.*\/)?AppShell\.vue$/,replacement:resolve(base,'src/support/NativeWizardShell.vue')},
    {find:/^(.*\/)?StepHelpPanel\.vue$/,replacement:resolve(base,'src/support/StepHelp.vue')},
  ]},
  define:{'process.env.NODE_ENV':JSON.stringify('production'),'import.meta.env.BASE_URL':JSON.stringify('/implantacao/'),'window.__APP_VERSION__':JSON.stringify('helpdesk-support'),'window.__BUILD_TIME__':JSON.stringify('host-build')},
  build:{outDir:'dist-support',emptyOutDir:true,target:'es2022',sourcemap:false,
    lib:{entry:resolve(base,'src/support/entry.ts'),formats:['es'],fileName:()=> 'support-app.js',cssFileName:'support'},
    rollupOptions:{external:['/implantacao/vendor/pdf.mjs','/implantacao/assets/xlsx-style-lite.js'],output:{assetFileNames:'[name][extname]',chunkFileNames:'chunks/[name]-[hash].js'}}},
});
