import type { ModelRef, OrgRole, ProviderKind } from "@maximus/domain";
import type { FakeTextAdapter } from "./adapters/fake-adapter.js";
import type { AllowlistRule } from "./allowlist.js";

export type ResolvedCredentials = {
  apiKey?: string;
  baseUrl?: string;
  source: "platform" | "byok";
};

export type ResolveAdapterInput = {
  modelRef: string | ModelRef;
  role: OrgRole;
  allowlist: AllowlistRule[];
  /** Pre-fetched connection for BYOK (already decrypted by caller or encrypted) */
  connection?: {
    id: string;
    kind: ProviderKind;
    baseUrl: string | null;
    apiKey: string;
    isEnabled: boolean;
  } | null;
  platform?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaBaseUrl?: string;
  };
  allowPrivateBaseUrls?: boolean;
  providerMode?: "live" | "fake";
};

export type ResolvedAdapter = {
  modelRef: string;
  providerKind: ProviderKind;
  modelId: string;
  credentials: ResolvedCredentials;
  adapter: FakeTextAdapter | { kind: ProviderKind; modelId: string; baseUrl?: string; apiKey?: string };
};
