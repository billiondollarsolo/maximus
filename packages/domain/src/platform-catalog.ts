import type { CatalogModel } from "./models-for-user.js";

/** Default platform models when org has no custom catalog rows. */
export function defaultPlatformCatalog(): CatalogModel[] {
  return [
    {
      modelRef: "openai:platform:gpt-4.1",
      displayName: "GPT-4.1",
      providerKind: "openai",
      isEnabled: true,
      capabilities: { streaming: true, vision: true, tools: true },
    },
    {
      modelRef: "anthropic:platform:claude-sonnet-4",
      displayName: "Claude Sonnet 4",
      providerKind: "anthropic",
      isEnabled: true,
      capabilities: { streaming: true, vision: true, tools: true },
    },
    {
      modelRef: "ollama:platform:llama3.2",
      displayName: "Llama 3.2 (Ollama)",
      providerKind: "ollama",
      isEnabled: true,
      capabilities: { streaming: true },
    },
  ];
}

/** First enabled platform model ref — single source for UI/API fallbacks. */
export function defaultPlatformModelRef(): string {
  const catalog = defaultPlatformCatalog();
  const enabled = catalog.find((m) => m.isEnabled);
  return (enabled ?? catalog[0])!.modelRef;
}
