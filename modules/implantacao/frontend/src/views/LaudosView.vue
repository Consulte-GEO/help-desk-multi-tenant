<template>
  <!--
    v5.22.41 — Leitor de Laudos de Rompimento (Opção B, rota in-app).
    Embute 1:1 o leitor estático de /public/laudos.html via iframe full-bleed.
    O isolamento por iframe mantém o app Vue independente do bundle do leitor
    (pdf.js + SheetJS + módulo próprio) — zero conflito de libs/escopo.
  -->
  <div class="laudos-embed">
    <iframe
      src="/laudos.html"
      title="Leitor de Laudos de Rompimento"
      class="laudos-frame"
      loading="eager"
    ></iframe>
  </div>
</template>

<style scoped>
/* Ocupa a viewport inteira, sem o chrome do app. Sem hex hardcoded (regra do DS):
   o fundo fica transparente — a própria página embutida pinta o seu. */
.laudos-embed {
  position: fixed;
  inset: 0;
}
.laudos-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: transparent;
}
</style>
