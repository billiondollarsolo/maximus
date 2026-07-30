export type ConvRow = { id: string; title: string | null; updatedAt: string };

export type ContentPartUi = {
  type: string;
  text?: string;
  attachmentId?: string;
  mime?: string;
  source?: string;
  prompt?: string;
  filename?: string;
};

export type ServerMsg = {
  id: string;
  role: string;
  parentMessageId: string | null;
  position: number;
  content: ContentPartUi[];
  status: string;
  modelRef?: string | null;
};

export function textFromContent(content: ContentPartUi[]): string {
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
}

export function imagePartsFromContent(content: ContentPartUi[]): ContentPartUi[] {
  return content.filter((p) => p.type === "image" && p.attachmentId);
}
