export const PROVIDER_KINDS = [
  "openai",
  "openai_compatible",
  "anthropic",
  "ollama",
] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export type ModelRef = {
  providerKind: ProviderKind;
  /** `platform` for env credentials, else org connection id */
  connectionId: string;
  modelId: string;
};

const KIND_SET = new Set<string>(PROVIDER_KINDS);

/**
 * Parse canonical model ref: `{providerKind}:{connectionId}:{modelId}`
 * modelId may contain additional colons (e.g. ollama tags).
 */
export function parseModelRef(value: string): ModelRef {
  const first = value.indexOf(":");
  const second = first === -1 ? -1 : value.indexOf(":", first + 1);
  if (first <= 0 || second <= first + 1 || second >= value.length - 1) {
    throw new Error(`Invalid model ref: ${value}`);
  }

  const providerKind = value.slice(0, first);
  const connectionId = value.slice(first + 1, second);
  const modelId = value.slice(second + 1);

  if (!KIND_SET.has(providerKind) || !connectionId || !modelId) {
    throw new Error(`Invalid model ref: ${value}`);
  }

  return {
    providerKind: providerKind as ProviderKind,
    connectionId,
    modelId,
  };
}

export function serializeModelRef(ref: ModelRef): string {
  return `${ref.providerKind}:${ref.connectionId}:${ref.modelId}`;
}

export function isModelRef(value: string): boolean {
  try {
    parseModelRef(value);
    return true;
  } catch {
    return false;
  }
}
