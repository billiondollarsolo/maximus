/**
 * Rough token estimate (chars/4). Good enough for refuse-path budgets.
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessagesTokens(
  messages: Array<{ content?: string | unknown }>,
): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === "string") {
      total += estimateTokensFromText(m.content);
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && typeof part === "object" && "text" in part) {
          total += estimateTokensFromText(String((part as { text?: string }).text ?? ""));
        }
      }
    }
    total += 4; // role overhead
  }
  return total;
}

export type ContextBudgetInput = {
  estimatedInputTokens: number;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  /** Reserve for system/tools; default 512 */
  headroom?: number;
  /** Full model id or display label (e.g. gemma3:4b) for error copy */
  modelLabel?: string | null;
};

/**
 * Whether to refuse before calling the provider.
 * Only refuses when contextWindow is configured.
 */
export function shouldRefuseForContext(input: ContextBudgetInput): {
  refuse: boolean;
  reason?: string;
  budget?: number;
} {
  const window = input.contextWindow;
  if (window == null || window <= 0) {
    return { refuse: false };
  }
  const maxOut = input.maxOutputTokens ?? 4096;
  const headroom = input.headroom ?? 512;
  const budget = Math.max(1, window - maxOut - headroom);
  if (input.estimatedInputTokens > budget) {
    const modelBit = input.modelLabel?.trim()
      ? ` model “${input.modelLabel.trim()}”`
      : " this model";
    return {
      refuse: true,
      budget,
      reason: `Prompt too long for${modelBit} (~${input.estimatedInputTokens} tokens estimated; budget ${budget} of contextWindow ${window} after reserving maxOutput ${maxOut}). Start a new chat or raise the model context window.`,
    };
  }
  return { refuse: false, budget };
}
