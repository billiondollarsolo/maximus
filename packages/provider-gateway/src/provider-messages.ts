export type ProviderTextPart = { type: "text"; text: string };
export type ProviderImagePart = {
  type: "image";
  mime: string;
  dataBase64: string;
};
export type ProviderContentPart = ProviderTextPart | ProviderImagePart;

export type ProviderMessage = {
  role: string;
  content: string | ProviderContentPart[];
};

/** Map ProviderMessage[] → OpenAI-compatible chat message bodies. */
export function toOpenAiChatMessages(
  messages: ProviderMessage[],
): Array<{ role: string; content: unknown }> {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role === "system" ? "system" : m.role, content: m.content };
    }
    const content = m.content.map((p) => {
      if (p.type === "text") {
        return { type: "text", text: p.text };
      }
      return {
        type: "image_url",
        image_url: {
          url: `data:${p.mime};base64,${p.dataBase64}`,
        },
      };
    });
    return {
      role: m.role === "system" ? "system" : m.role,
      content,
    };
  });
}

/** Map for Anthropic messages API (non-system roles). */
export function toAnthropicUserContent(
  content: string | ProviderContentPart[],
): unknown {
  if (typeof content === "string") {
    return content;
  }
  return content.map((p) => {
    if (p.type === "text") return { type: "text", text: p.text };
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: p.mime,
        data: p.dataBase64,
      },
    };
  });
}

/** Flatten multimodal for Ollama content + images array. */
export function toOllamaMessage(m: ProviderMessage): {
  role: string;
  content: string;
  images?: string[];
} {
  if (typeof m.content === "string") {
    return { role: m.role, content: m.content };
  }
  const texts: string[] = [];
  const images: string[] = [];
  for (const p of m.content) {
    if (p.type === "text") texts.push(p.text);
    else images.push(p.dataBase64);
  }
  return {
    role: m.role,
    content: texts.join("\n"),
    ...(images.length ? { images } : {}),
  };
}
