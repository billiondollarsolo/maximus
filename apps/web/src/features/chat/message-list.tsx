import { Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { IconButton } from "#/components/ui";
import { MarkdownRenderer } from "#/components/markdown/markdown-renderer";
import { cn } from "#/lib/cn";

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: string;
};

export function MessageList({
  messages,
  onRegenerate,
  onFeedback,
}: {
  messages: UiMessage[];
  onRegenerate?: (id: string) => void;
  onFeedback?: (id: string, rating: "up" | "down") => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "group flex flex-col gap-2",
            m.role === "user" ? "items-end" : "items-start",
          )}
        >
          <div
            className={cn(
              "max-w-[90%] rounded-2xl px-4 py-3",
              m.role === "user"
                ? "bg-bg-composer text-text-primary"
                : "bg-transparent text-text-primary",
            )}
          >
            {m.role === "assistant" ? (
              <MarkdownRenderer content={m.content} />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            )}
          </div>
          {m.role === "assistant" ? (
            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton
                icon={Copy}
                label="Copy"
                iconSize="sm"
                onClick={() => navigator.clipboard.writeText(m.content)}
              />
              <IconButton
                icon={RefreshCw}
                label="Regenerate"
                iconSize="sm"
                onClick={() => onRegenerate?.(m.id)}
              />
              <IconButton
                icon={ThumbsUp}
                label="Good response"
                iconSize="sm"
                onClick={() => onFeedback?.(m.id, "up")}
              />
              <IconButton
                icon={ThumbsDown}
                label="Bad response"
                iconSize="sm"
                onClick={() => onFeedback?.(m.id, "down")}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
