const ORIGIN = 'https://harshguptaindex1210-dot.github.io';
const GAME_PATH = '/kill-enemy/';

/** Set at build time (deploy.yml) so shared links bust stale index.html caches. */
export const GAME_CACHE_BUST =
  typeof import.meta.env.VITE_CACHE_BUST === 'string' && import.meta.env.VITE_CACHE_BUST
    ? import.meta.env.VITE_CACHE_BUST.slice(0, 7)
    : '';

function withCacheBust(path: string): string {
  if (!GAME_CACHE_BUST) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}v=${GAME_CACHE_BUST}`;
}

/** Canonical GitHub Pages URL (repo: kill-enemy). */
export const GAME_PLAY_URL = `${ORIGIN}${withCacheBust(GAME_PATH)}`;

/** Keep in-product links on direct game URL (no root redirect). */
export const GAME_SHARE_URL = GAME_PLAY_URL;

export const GAME_SHARE_TEXT = `Play Kill Enemy — free browser battle royale: ${GAME_SHARE_URL}`;
