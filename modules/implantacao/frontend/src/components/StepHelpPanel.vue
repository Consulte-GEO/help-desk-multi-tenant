<template>
  <div v-if="hasContent && help" class="step-help">
    <button type="button" class="step-help-toggle" :aria-expanded="open" @click="open = !open">
      <span class="step-help-icon" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="step-help-title">{{ help.help_title || 'Material de apoio desta etapa' }}</span>
      <span class="step-help-badges">
        <span v-if="videoId" class="step-help-badge" title="Tem vídeo">▶ vídeo</span>
        <span v-if="imageUrls.length" class="step-help-badge" title="Tem imagem">
          🖼 {{ imageUrls.length > 1 ? imageUrls.length + ' imagens' : 'imagem' }}
        </span>
      </span>
    </button>
    <div v-show="open" class="step-help-body">
      <p v-if="help.help_description" class="step-help-desc">{{ help.help_description }}</p>
      <div class="step-help-media">
        <div v-if="embedUrl" class="step-help-video">
          <div class="video-wrap">
            <iframe :src="embedUrl || undefined" :title="help.help_title || 'Vídeo de ajuda'"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
          </div>
        </div>

        <!-- v5.22.37: carrossel de imagens. Setas só quando >1. -->
        <div v-if="imageUrls.length" class="step-help-image">
          <div class="carousel">
            <a :href="currentImage" target="_blank" rel="noopener noreferrer"
               title="Abrir imagem em tamanho real">
              <img :src="currentImage" :alt="imageAlt" />
            </a>

            <template v-if="imageUrls.length > 1">
              <button type="button" class="carousel-nav prev"
                @click.prevent="prevImage" aria-label="Imagem anterior">‹</button>
              <button type="button" class="carousel-nav next"
                @click.prevent="nextImage" aria-label="Próxima imagem">›</button>
              <div class="carousel-indicator" aria-live="polite">
                {{ imageIndex + 1 }} / {{ imageUrls.length }}
              </div>
              <div class="carousel-dots">
                <button
                  v-for="(u, i) in imageUrls"
                  :key="i"
                  type="button"
                  class="carousel-dot"
                  :class="{ active: i === imageIndex }"
                  :aria-label="`Ir para imagem ${i + 1}`"
                  @click.prevent="imageIndex = i"
                ></button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { getStepHelp, resolveImageUrls, STEP_KEY_BY_ID, type StepHelp } from '../services/stepHelpService';
import { youtubeEmbedUrl } from '../services/youtubeService';

export default defineComponent({
  name: 'StepHelpPanel',
  props: { stepId: { type: Number, required: true } },
  data() {
    return {
      help: null as StepHelp | null,
      imageUrls: [] as string[],
      imageIndex: 0,
      open: false,
      loadedKey: '' as string,
    };
  },
  computed: {
    videoId(): string | null { return this.help?.youtube_video_id ?? null; },
    embedUrl(): string | null { return youtubeEmbedUrl(this.videoId); },
    hasContent(): boolean { return !!(this.help && (this.videoId || this.imageUrls.length)); },
    currentImage(): string {
      return this.imageUrls[this.imageIndex] ?? this.imageUrls[0] ?? '';
    },
    imageAlt(): string {
      const base = this.help?.help_title || 'Imagem de exemplo da etapa';
      return this.imageUrls.length > 1
        ? `${base} (${this.imageIndex + 1} de ${this.imageUrls.length})`
        : base;
    },
  },
  watch: {
    stepId: { immediate: true, handler() { this.loadForStep(); } },
  },
  methods: {
    prevImage() {
      if (this.imageUrls.length < 2) return;
      this.imageIndex = (this.imageIndex - 1 + this.imageUrls.length) % this.imageUrls.length;
    },
    nextImage() {
      if (this.imageUrls.length < 2) return;
      this.imageIndex = (this.imageIndex + 1) % this.imageUrls.length;
    },
    async loadForStep() {
      const stepKey = STEP_KEY_BY_ID[this.stepId];
      if (!stepKey) { this.help = null; this.imageUrls = []; return; }
      if (this.loadedKey === stepKey && this.help) return;
      this.loadedKey = stepKey;
      this.help = null; this.imageUrls = []; this.imageIndex = 0; this.open = false;
      try {
        const help = await getStepHelp(stepKey);
        if (this.loadedKey !== stepKey) return;
        this.help = help;
        if (help?.image_paths?.length) {
          const urls = await resolveImageUrls(help.image_paths);
          if (this.loadedKey === stepKey) this.imageUrls = urls;
        }
      } catch {
        this.help = null; this.imageUrls = [];
      }
    },
  },
});
</script>

<style scoped>
.step-help { margin: 0 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); overflow: hidden; }
.step-help-toggle { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; background: transparent; border: 0; cursor: pointer; text-align: left; font-size: 14px; color: var(--fg); }
.step-help-toggle:hover { background: rgba(0, 0, 0, 0.02); }
.step-help-toggle:focus-visible { outline: 2px solid var(--brand-fg); outline-offset: -2px; }
.step-help-icon { color: var(--brand-fg); font-size: 12px; }
.step-help-title { font-weight: 600; flex: 1; }
.step-help-badges { display: inline-flex; gap: 6px; }
.step-help-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(197, 17, 126, 0.08); color: var(--brand-fg); white-space: nowrap; }
.step-help-body { padding: 0 16px 16px; border-top: 1px solid var(--border); padding-top: 14px; }
.step-help-desc { margin: 0 0 14px; font-size: 14px; color: var(--fg); line-height: 1.5; }
.step-help-media { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.step-help-media > :only-child { grid-column: 1 / -1; }
@media (max-width: 680px) { .step-help-media { grid-template-columns: 1fr; } }
.video-wrap { position: relative; width: 100%; padding-top: 56.25%; border-radius: 8px; overflow: hidden; background: #000; }
.video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

/* v5.22.37 — carrossel de imagens */
.carousel { position: relative; }
.step-help-image img { width: 100%; border-radius: 8px; border: 1px solid var(--border); display: block; }
.step-help-image a { display: block; }
.carousel-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 34px; height: 34px; border-radius: 50%;
  border: 0; background: rgba(0, 0, 0, 0.55); color: #fff;
  font-size: 22px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.carousel-nav:hover { background: rgba(0, 0, 0, 0.75); }
.carousel-nav:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.carousel-nav.prev { left: 8px; }
.carousel-nav.next { right: 8px; }
.carousel-indicator {
  position: absolute; top: 8px; right: 8px;
  padding: 2px 8px; border-radius: 999px;
  background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 11px;
}
.carousel-dots {
  display: flex; justify-content: center; gap: 6px; margin-top: 8px;
}
.carousel-dot {
  width: 8px; height: 8px; border-radius: 50%; padding: 0;
  border: 0; background: var(--border); cursor: pointer;
}
.carousel-dot.active { background: var(--brand-fg); }
.carousel-dot:focus-visible { outline: 2px solid var(--brand-fg); outline-offset: 2px; }
</style>
