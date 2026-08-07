/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NAKAMA_HOST?: string;
  readonly VITE_NAKAMA_PORT?: string;
  readonly VITE_NAKAMA_SSL?: string;
  readonly VITE_NAKAMA_KEY?: string;
  readonly VITE_ONLINE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
