export type PriceRow = {
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
