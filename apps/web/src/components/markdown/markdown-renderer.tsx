import { useMemo } from "react";
import { cn } from "#/lib/cn";
import { CodeBlock } from "./code-block";

/**
 * Lightweight streaming-safe markdown: paragraphs, fences, inline code, lists.
 */
export function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) => {
        if (b.type === "code") {
          return <CodeBlock key={i} language={b.lang} code={b.code} />;
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-bg-composer px-1 py-0.5 font-mono text-[0.85em]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

type Block =
  | { type: "text"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "list"; items: string[] };

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      i += 1;
      const code: string[] = [];
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        code.push(lines[i]!);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("- ")) {
        items.push(lines[i]!.trim().slice(2));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i] !== "" &&
      !lines[i]!.startsWith("```") &&
      !lines[i]!.trim().startsWith("- ")
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    if (para.length) blocks.push({ type: "text", text: para.join("\n") });
    while (i < lines.length && lines[i] === "") i += 1;
  }
  return blocks;
}
