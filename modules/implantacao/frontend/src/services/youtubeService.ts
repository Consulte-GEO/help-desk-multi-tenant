// services/youtubeService.ts · v5.22.36
// Normalização de URLs do YouTube → videoId canônico + embed.

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeVideoId(input: string): string | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const vParam = url.searchParams.get('v');
    if (vParam && VIDEO_ID_RE.test(vParam)) return vParam;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['embed', 'shorts', 'v'].includes(parts[0])) {
      const id = parts[1];
      return VIDEO_ID_RE.test(id) ? id : null;
    }
  }
  return null;
}

export function youtubeEmbedUrl(videoId: string | null): string | null {
  if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function youtubeThumbnailUrl(videoId: string | null): string | null {
  if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string | null): string | null {
  if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
