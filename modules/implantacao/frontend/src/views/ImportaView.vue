<template>
  <!--
    v5.22.42 — Importação de Planilhas de Obras (Copilot V3.1, Opção B, rota in-app).
    Embute 1:1 a ferramenta estática de /public/importa.html via iframe full-bleed.
    O isolamento por iframe mantém o app Vue independente do bundle da ferramenta
    (SheetJS + módulo próprio) — zero conflito de libs/escopo.
    Acesso principal (Opção A): https://setup.consultegeo.org/importa via redirect Netlify.
  -->
  <div class="importa-embed">
    <iframe
      src="/importa.html"
      title="Importação de Planilhas de Obras"
      class="importa-frame"
      loading="eager"
    ></iframe>
  </div>
</template>

<style scoped>
/* Ocupa a viewport inteira, sem o chrome do app. Sem hex hardcoded (regra do DS):
   o fundo fica transparente — a própria página embutida pinta o seu. */
.importa-embed {
  position: fixed;
  inset: 0;
}
.importa-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: transparent;
}
</style>
