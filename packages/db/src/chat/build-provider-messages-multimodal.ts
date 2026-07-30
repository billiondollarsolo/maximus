import type { ContentPart } from "@maximus/domain";
import { AppError } from "@maximus/domain";
import type { HistoryMsg } from "./build-provider-messages.js";
import { toTree } from "./build-provider-messages.js";
import { listActiveBranch } from "@maximus/domain";

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

export type ResolveImageFn = (
  attachmentId: string,
) => Promise<{ mime: string; dataBase64: string } | null>;

export const VISION_MAX_BYTES_DEFAULT = 10 * 1024 * 1024;

/**
 * Build provider history with real image payloads for vision models.
 * File parts stay as text notes. Inject resolveImage for tests / S3.
 */
export async function buildProviderMessagesMultimodal(
  allMsgs: HistoryMsg[],
  leafId: string,
  resolveImage: ResolveImageFn,
  opts?: { maxBytes?: number },
): Promise<ProviderMessage[]> {
  const maxBytes = opts?.maxBytes ?? VISION_MAX_BYTES_DEFAULT;
  const tree = toTree(allMsgs);
  const branch = listActiveBranch(tree, leafId);
  const out: ProviderMessage[] = [];

  for (const m of branch) {
    const full = allMsgs.find((x) => x.id === m.id)!;
    const parts = (full.content as ContentPart[]) ?? [];
    const hasImage = parts.some((p) => p.type === "image");
    if (!hasImage) {
      const text = partsToText(parts);
      out.push({ role: m.role, content: text });
      continue;
    }

    const content: ProviderContentPart[] = [];
    for (const p of parts) {
      if (p.type === "text") {
        content.push({ type: "text", text: p.text });
      } else if (p.type === "image") {
        const resolved = await resolveImage(p.attachmentId);
        if (!resolved) {
          content.push({
            type: "text",
            text: `[missing image attachment:${p.attachmentId}]`,
          });
          continue;
        }
        const approxBytes = Math.floor((resolved.dataBase64.length * 3) / 4);
        if (approxBytes > maxBytes) {
          throw new AppError(
            "VALIDATION",
            `Image exceeds vision size limit (${maxBytes} bytes)`,
          );
        }
        content.push({
          type: "image",
          mime: resolved.mime || p.mime,
          dataBase64: resolved.dataBase64,
        });
      } else {
        content.push({
          type: "text",
          text: `[file ${p.filename} attachment:${p.attachmentId}]`,
        });
      }
    }
    if (content.length === 0) {
      content.push({ type: "text", text: "" });
    }
    out.push({ role: m.role, content });
  }
  return out;
}

function partsToText(parts: ContentPart[]): string {
  const bits: string[] = [];
  for (const p of parts) {
    if (p.type === "text") bits.push(p.text);
    else if (p.type === "image") {
      bits.push(`[image attachment:${p.attachmentId} mime:${p.mime}]`);
    } else {
      bits.push(`[file ${p.filename} attachment:${p.attachmentId}]`);
    }
  }
  return bits.join("\n");
}
