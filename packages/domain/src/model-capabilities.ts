export type ModelCapabilities = {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
};

export function parseCapabilities(
  raw: Record<string, unknown> | null | undefined,
): ModelCapabilities {
  if (!raw || typeof raw !== "object") {
    return { streaming: true };
  }
  return {
    streaming: raw.streaming !== false,
    vision: raw.vision === true,
    imageGen: raw.imageGen === true,
    tools: raw.tools === true,
  };
}

export function modelAcceptsImages(caps: ModelCapabilities): boolean {
  return caps.vision === true;
}

export function modelCanGenerateImages(caps: ModelCapabilities): boolean {
  return caps.imageGen === true;
}

/** True if content parts include at least one image. */
export function contentHasImages(
  parts: Array<{ type: string }>,
): boolean {
  return parts.some((p) => p.type === "image");
}
