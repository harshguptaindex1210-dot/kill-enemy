/** Nakama endpoint + online fallback policy (build-time via Vite env). */

export interface NakamaConfig {
  host: string;
  port: string;
  useSSL: boolean;
  serverKey: string;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function envOrDefault(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key];
  return value && value.length > 0 ? value : fallback;
}

export function getNakamaConfig(): NakamaConfig {
  return {
    host: envOrDefault('VITE_NAKAMA_HOST', '127.0.0.1'),
    port: envOrDefault('VITE_NAKAMA_PORT', '7350'),
    useSSL: import.meta.env.VITE_NAKAMA_SSL === 'true',
    serverKey: envOrDefault('VITE_NAKAMA_KEY', 'defaultkey'),
  };
}

export function isLocalNakamaEndpoint(config: NakamaConfig = getNakamaConfig()): boolean {
  return LOCAL_HOSTS.has(config.host);
}

/** True when the page is served from a dev machine (not GitHub Pages / static host). */
export function isLocalBrowserHost(hostname = globalThis.location?.hostname ?? ''): boolean {
  return LOCAL_HOSTS.has(hostname);
}

/**
 * When Nakama is unreachable, fall back to in-browser demo online (LocalServer +
 * OnlineMatchGame) instead of blocking the lobby. Enabled for static deploys that
 * point at localhost Nakama, or when VITE_ONLINE_DEMO=true.
 */
export function allowDemoOnlineFallback(
  config: NakamaConfig = getNakamaConfig(),
  hostname = globalThis.location?.hostname ?? ''
): boolean {
  if (import.meta.env.VITE_ONLINE_DEMO === 'true') return true;
  return isLocalNakamaEndpoint(config) && !isLocalBrowserHost(hostname);
}

export function onlineUnavailableMessage(
  err: unknown,
  config: NakamaConfig = getNakamaConfig(),
  hostname = globalThis.location?.hostname ?? ''
): string {
  if (isLocalBrowserHost(hostname) && isLocalNakamaEndpoint(config)) {
    return 'Nakama not running — run: docker compose up -d, then Play Online';
  }
  const detail = err instanceof Error ? err.message : String(err);
  const trimmed = detail.replace(/\s+/g, ' ').slice(0, 120);
  return `Could not reach online server (${config.host}:${config.port})${trimmed ? ` — ${trimmed}` : ''}`;
}
