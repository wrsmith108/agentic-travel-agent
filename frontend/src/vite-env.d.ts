/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEMO_MODE_ENABLED: string;
  readonly VITE_SHOW_DEMO_TOGGLE: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEFAULT_CURRENCY: string;
  readonly VITE_DEFAULT_TIMEZONE: string;
  readonly VITE_NOTIFICATION_OPTIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}