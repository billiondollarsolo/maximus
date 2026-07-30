export type PriceRow = {
  inputUsdPer1m: number;
  outputUsdPer1m: number;
};

export type PriceCandidate = {
  orgId: string | null;
  providerKind: string;
  modelIdPattern: string;
  inputUsdPer1m: number;
  outputUsdPer1m: number;
};

/**
 * Compute micro-USD cost from token counts and per-1M USD prices.
 * Returns null when tokens or price missing.
 */
export function computeCostMicros(input: {
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
  price: PriceRow | null | undefined;
}): number | null {
  if (
    input.price == null ||
    input.inputTokens == null ||
    input.outputTokens == null
  ) {
    return null;
  }
  const dollars =
    (input.inputTokens / 1_000_000) * input.price.inputUsdPer1m +
    (input.outputTokens / 1_000_000) * input.price.outputUsdPer1m;
  return Math.round(dollars * 1_000_000);
}

function patternSpecificity(pattern: string, modelId: string): number | null {
  if (pattern === modelId) return 3;
  if (pattern !== "*" && modelId.includes(pattern)) return 2;
  if (pattern === "*") return 1;
  return null;
}

/**
 * Pick best price row: exact model id > longer substring > `*`;
 * within equal specificity, org rows beat platform (orgId null).
 */
export function matchPriceRow(
  candidates: PriceCandidate[],
  input: { orgId: string; providerKind: string; modelId: string },
): PriceCandidate | null {
  let best: PriceCandidate | null = null;
  let bestSpec = -1;
  let bestScope = -1;
  let bestPatternLen = -1;

  for (const row of candidates) {
    if (row.providerKind !== input.providerKind) continue;
    if (row.orgId != null && row.orgId !== input.orgId) continue;

    const spec = patternSpecificity(row.modelIdPattern, input.modelId);
    if (spec == null) continue;

    const scope = row.orgId === input.orgId ? 2 : 1;
    const patternLen =
      row.modelIdPattern === "*" ? 0 : row.modelIdPattern.length;

    const better =
      spec > bestSpec ||
      (spec === bestSpec && scope > bestScope) ||
      (spec === bestSpec &&
        scope === bestScope &&
        patternLen > bestPatternLen);

    if (better) {
      best = row;
      bestSpec = spec;
      bestScope = scope;
      bestPatternLen = patternLen;
    }
  }

  return best;
}
