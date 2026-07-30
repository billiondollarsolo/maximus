import type { ProviderKind } from "@maximus/domain";

/** 1×1 PNG */
export const FAKE_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export type GenerateImageInput = {
  providerKind: ProviderKind;
  modelId: string;
  prompt: string;
  apiKey?: string;
  baseUrl?: string;
  size?: string;
  mode?: "live" | "fake";
  fetchImpl?: typeof fetch;
};

export type GenerateImageResult = {
  bytes: Buffer;
  mime: string;
  revisedPrompt?: string;
};

export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const mode = input.mode ?? (process.env.PROVIDER_MODE === "live" ? "live" : "fake");
  if (mode === "fake") {
    return { bytes: FAKE_PNG_BYTES, mime: "image/png" };
  }
  return generateImageOpenAiCompat(input);
}

async function generateImageOpenAiCompat(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const fetchFn = input.fetchImpl ?? fetch;
  const base = (input.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const url = base.endsWith("/images/generations")
    ? base
    : `${base}/images/generations`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: input.modelId,
      prompt: input.prompt,
      size: input.size ?? "1024x1024",
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Image gen error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const first = data.data?.[0];
  if (!first?.b64_json) {
    throw new Error("Image gen response missing b64_json");
  }
  return {
    bytes: Buffer.from(first.b64_json, "base64"),
    mime: "image/png",
    revisedPrompt: first.revised_prompt,
  };
}
