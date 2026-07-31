/**
 * Product version shown in the UI (sidebar, About).
 * Injected at image build via VITE_APP_VERSION; falls back for local dev.
 */
export const APP_VERSION: string =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_APP_VERSION as string | undefined)) ||
  "0.1.6-alpha";

export const PRODUCT_NAME = "Maximus";

export const SOCIAL_LINKS = {
  mjtechguy: {
    label: "mjtechguy",
    href: "https://x.com/mjtechguy",
  },
  billiondollarsolo: {
    label: "billiondollarsolo",
    href: "https://x.com/billiondollarsolo",
  },
} as const;
