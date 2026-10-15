<template>
  <!-- v5.22.37 — Configuração de ajuda por etapa (até 5 imagens). -->
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-brand">
        <strong>Implantação Consulte GEO</strong>
        <span class="muted">· Ajuda das etapas</span>
      </div>
      <div class="admin-user">
        <router-link to="/admin" class="btn sm">← Voltar ao painel</router-link>
        <span class="muted">{{ currentUserName }}</span>
      </div>
    </header>

    <main class="admin-main">
      <p class="muted help-intro">
        Configure o material de apoio que aparece em cada etapa do
        cadastro de implantação. Você pode anexar até {{ maxImages }} imagens
        por etapa. Campos vazios não aparecem para o cliente.
      </p>

      <div v-if="loading" class="empty">Carregando…</div>

      <div v-else class="help-cards">
        <section
          v-for="row in rows"
          :key="row.step_key"
          class="help-card"
          :class="{ 'is-disabled': !row.enabled }"
        >
          <div class="help-card-head">
            <h2>{{ labelFor(row.step_key) }}</h2>
            <label class="filter-toggle" :title="row.enabled ? 'Visível para o cliente' : 'Oculto'">
              <input type="checkbox" v-model="row.enabled" />
              {{ row.enabled ? 'Ativa' : 'Inativa' }}
            </label>
          </div>

          <div class="help-grid">
            <div class="help-fields">
              <label class="field">
                <span class="field-label">Título (opcional)</span>
                <input class="input" type="text" v-model="row.help_title"
                  maxlength="200" placeholder="Ex.: Como cadastrar estruturas em lote" />
              </label>

              <label class="field">
                <span class="field-label">Descrição (opcional)</span>
                <textarea class="input" rows="3" v-model="row.help_description"
                  maxlength="1000" placeholder="Texto curto explicando o material de apoio."></textarea>
              </label>

              <label class="field">
                <span class="field-label">Link do vídeo (YouTube)</span>
                <input class="input" type="url" v-model="row.youtube_url"
                  placeholder="https://www.youtube.com/watch?v=..." @blur="validateYoutube(row)" />
                <span v-if="row._youtubeError" class="field-error">
                  Link de YouTube inválido. Cole um link como youtube.com/watch?v=… ou youtu.be/…
                </span>
                <span v-else-if="previewVideoId(row)" class="field-ok">✓ Vídeo reconhecido</span>
              </label>

              <div class="field">
                <span class="field-label">
                  Imagens de exemplo ({{ row.image_paths.length }}/{{ maxImages }})
                </span>
                <input type="file" accept="image/*" multiple
                  :ref="(el) => setFileInput(row.step_key, el)"
                  :disabled="row.image_paths.length >= maxImages || row._uploading"
                  @change="onPickImages(row, $event)" />
                <span v-if="row._uploading" class="field-info">Enviando imagem(ns)…</span>
                <span v-if="row._uploadError" class="field-error">{{ row._uploadError }}</span>
                <span v-if="row.image_paths.length >= maxImages" class="field-info">
                  Limite de {{ maxImages }} imagens atingido. Remova alguma para adicionar outra.
                </span>
              </div>
            </div>

            <div class="help-previews">
              <div v-if="previewVideoId(row)" class="preview-block">
                <div class="preview-cap">Prévia do vídeo</div>
                <div class="video-wrap">
                  <iframe :src="embedUrl(row) || undefined" title="Prévia do vídeo de ajuda"
                    frameborder="0" allowfullscreen></iframe>
                </div>
              </div>

              <div v-if="row._imageUrls.length" class="preview-block">
                <div class="preview-cap">
                  Imagens ({{ row._imageUrls.length }}) — arraste a ordem não é editável, use remover
                </div>
                <div class="thumb-grid">
                  <div v-for="(url, i) in row._imageUrls" :key="row.image_paths[i] || i" class="thumb">
                    <img :src="url" :alt="`Imagem ${i + 1}`" />
                    <button type="button" class="thumb-remove"
                      :aria-label="`Remover imagem ${i + 1}`"
                      @click="onRemoveImage(row, i)">×</button>
                  </div>
                </div>
              </div>

              <div v-if="!previewVideoId(row) && !row._imageUrls.length" class="preview-empty">
                Sem material configurado ainda.
              </div>
            </div>
          </div>

          <div class="help-card-foot">
            <button class="btn brand sm" :disabled="row._saving" @click="onSave(row)">
              {{ row._saving ? 'Salvando…' : 'Salvar etapa' }}
            </button>
            <span v-if="row._savedAt" class="field-ok">Salvo ✓</span>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { getCurrentUser } from '../services/authService';
import {
  listAllStepHelp, saveStepHelp, uploadStepHelpImage,
  deleteStepHelpImage, resolveImageUrls, STEP_KEYS, STEP_LABELS,
  MAX_IMAGES_PER_STEP, type StepHelp, type StepKey,
} from '../services/stepHelpService';
import { extractYoutubeVideoId, youtubeEmbedUrl } from '../services/youtubeService';

interface HelpRow extends StepHelp {
  _youtubeError: boolean;
  _uploading: boolean;
  _uploadError: string;
  _saving: boolean;
  _savedAt: number | null;
  _imageUrls: string[];   // URLs públicas resolvidas, paralelas a image_paths
}

export default defineComponent({
  name: 'AdminStepHelpView',
  data() {
    return {
      loading: true,
      rows: [] as HelpRow[],
      fileInputs: {} as Record<string, HTMLInputElement | null>,
      maxImages: MAX_IMAGES_PER_STEP,
    };
  },
  computed: {
    currentUserName(): string {
      return getCurrentUser()?.email || '';
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    labelFor(stepKey: string): string {
      return STEP_LABELS[stepKey as StepKey] || stepKey;
    },
    async load() {
      this.loading = true;
      try {
        const existing = await listAllStepHelp();
        const byKey = new Map(existing.map((r) => [r.step_key, r]));
        const rows: HelpRow[] = [];
        for (const key of STEP_KEYS) {
          const base = byKey.get(key);
          rows.push({
            id: base?.id ?? '',
            step_key: key,
            youtube_url: base?.youtube_url ?? null,
            youtube_video_id: base?.youtube_video_id ?? null,
            image_paths: base?.image_paths ? [...base.image_paths] : [],
            image_path: base?.image_path ?? null,
            help_title: base?.help_title ?? null,
            help_description: base?.help_description ?? null,
            enabled: base?.enabled ?? true,
            updated_by: base?.updated_by ?? null,
            updated_at: base?.updated_at ?? '',
            _youtubeError: false,
            _uploading: false,
            _uploadError: '',
            _saving: false,
            _savedAt: null,
            _imageUrls: [],
          });
        }
        this.rows = rows;
        await Promise.all(this.rows.map(async (row) => {
          if (row.image_paths.length) row._imageUrls = await resolveImageUrls(row.image_paths);
        }));
      } finally {
        this.loading = false;
      }
    },
    setFileInput(stepKey: string, el: unknown) {
      this.fileInputs[stepKey] = (el as HTMLInputElement) || null;
    },
    previewVideoId(row: HelpRow): string | null {
      const fromInput = row.youtube_url ? extractYoutubeVideoId(row.youtube_url) : null;
      return fromInput || row.youtube_video_id;
    },
    embedUrl(row: HelpRow): string | null {
      return youtubeEmbedUrl(this.previewVideoId(row));
    },
    validateYoutube(row: HelpRow) {
      if (!row.youtube_url || !row.youtube_url.trim()) {
        row._youtubeError = false;
        return;
      }
      row._youtubeError = extractYoutubeVideoId(row.youtube_url) === null;
    },
    async onPickImages(row: HelpRow, event: Event) {
      const input = event.target as HTMLInputElement;
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      const slotsLeft = this.maxImages - row.image_paths.length;
      if (slotsLeft <= 0) {
        row._uploadError = `Limite de ${this.maxImages} imagens atingido.`;
        return;
      }
      const toUpload = files.slice(0, slotsLeft);
      const ignored = files.length - toUpload.length;

      row._uploading = true;
      row._uploadError = '';
      try {
        for (const file of toUpload) {
          const result = await uploadStepHelpImage(row.step_key, file);
          if (!result.ok || !result.path) {
            row._uploadError = this.friendlyUploadError(result.error);
            continue;
          }
          row.image_paths.push(result.path);
          const urls = await resolveImageUrls([result.path]);
          if (urls[0]) row._imageUrls.push(urls[0]);
        }
        if (ignored > 0) {
          row._uploadError = `${ignored} imagem(ns) ignorada(s): limite de ${this.maxImages}.`;
        }
      } finally {
        row._uploading = false;
        if (this.fileInputs[row.step_key]) this.fileInputs[row.step_key]!.value = '';
      }
    },
    async onRemoveImage(row: HelpRow, index: number) {
      const path = row.image_paths[index];
      if (path) await deleteStepHelpImage(path);
      row.image_paths.splice(index, 1);
      row._imageUrls.splice(index, 1);
    },
    friendlyUploadError(err?: string): string {
      if (err === 'arquivo_nao_e_imagem') return 'Um dos arquivos não é imagem.';
      if (err === 'imagem_maior_que_5mb') return 'Uma imagem é maior que 5MB.';
      if (err === 'supabase_off' || err === 'no_client') return 'Storage indisponível.';
      return `Erro ao enviar: ${err || 'desconhecido'}`;
    },
    async onSave(row: HelpRow) {
      this.validateYoutube(row);
      if (row._youtubeError) return;
      row._saving = true;
      row._savedAt = null;
      try {
        const result = await saveStepHelp({
          step_key: row.step_key,
          youtube_url: row.youtube_url,
          image_paths: row.image_paths,
          help_title: row.help_title,
          help_description: row.help_description,
          enabled: row.enabled,
        });
        if (!result.ok) {
          if (result.error === 'youtube_url_invalida') row._youtubeError = true;
          else alert(`Erro ao salvar: ${result.error}`);
          return;
        }
        row._savedAt = Date.now();
        row.youtube_video_id = this.previewVideoId(row);
        setTimeout(() => {
          if (row._savedAt && Date.now() - row._savedAt >= 2900) row._savedAt = null;
        }, 3000);
      } finally {
        row._saving = false;
      }
    },
  },
});
</script>

<style scoped>
.admin-shell { min-height: 100vh; background: var(--bg, #f7f6f2); }
.admin-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; background: var(--surface);
  border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap;
}
.admin-brand strong { font-size: 16px; }
.admin-user { display: inline-flex; align-items: center; gap: 12px; }
.admin-main { max-width: 1100px; margin: 0 auto; padding: 24px; }
.help-intro { margin: 0 0 20px; max-width: 720px; }
.help-cards { display: flex; flex-direction: column; gap: 20px; }
.help-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
}
.help-card.is-disabled { opacity: 0.7; }
.help-card-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px;
}
.help-card-head h2 { margin: 0; font-size: 17px; letter-spacing: -0.01em; }
.help-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 760px) { .help-grid { grid-template-columns: 1fr; } }
.help-fields { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--fg); }
.field-error { font-size: 12px; color: #b91c1c; }
.field-ok { font-size: 12px; color: #15803d; }
.field-info { font-size: 12px; color: var(--fg-muted, #6b7280); }
.help-previews { display: flex; flex-direction: column; gap: 16px; }
.preview-cap {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-muted, #6b7280); margin-bottom: 6px;
}
.video-wrap {
  position: relative; width: 100%; padding-top: 56.25%;
  border-radius: 8px; overflow: hidden; background: #000;
}
.video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.thumb-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}
.thumb { position: relative; }
.thumb img {
  width: 100%; aspect-ratio: 4/3; object-fit: cover;
  border-radius: 6px; border: 1px solid var(--border); display: block;
}
.thumb-remove {
  position: absolute; top: 4px; right: 4px;
  width: 22px; height: 22px; border-radius: 50%;
  border: 0; background: rgba(0, 0, 0, 0.6); color: #fff;
  font-size: 15px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.thumb-remove:hover { background: rgba(185, 28, 28, 0.9); }
.preview-empty {
  padding: 24px; text-align: center; color: var(--fg-muted, #6b7280);
  font-size: 13px; border: 1px dashed var(--border); border-radius: 8px;
}
.help-card-foot {
  display: flex; align-items: center; gap: 12px; margin-top: 16px;
  padding-top: 16px; border-top: 1px solid var(--border);
}
.filter-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; user-select: none;
}
.empty { padding: 40px; text-align: center; color: var(--fg-muted, #6b7280); }
</style>
