export type ConvRow = { id: string; title: string | null; updatedAt: string };

export type ServerMsg = {
  id: string;
  role: string;
  parentMessageId: string | null;
  position: number;
  content: Array<{ type: string; text?: string }>;
  status: string;
};

export function textFromContent(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
}
