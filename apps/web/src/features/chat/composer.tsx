import { useState } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { Icon, IconButton, Textarea } from "#/components/ui";
import { cn } from "#/lib/cn";
import { ModelSelect } from "./model-select";

export function Composer({
  modelRef,
  onModelChange,
  streaming = false,
  onSend,
  onStop,
  initialValue = "",
}: {
  modelRef: string;
  onModelChange: (value: string) => void;
  streaming?: boolean;
  onSend?: (text: string) => void;
  onStop?: () => void;
  initialValue?: string;
}) {
  const [text, setText] = useState(initialValue);
  const canSend = text.trim().length > 0 && !streaming;

  function submit() {
    if (!canSend) return;
    onSend?.(text.trim());
    setText("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="mb-2 flex justify-center">
        <ModelSelect value={modelRef} onChange={onModelChange} />
      </div>
      <div
        className={cn(
          "flex flex-col rounded-[var(--radius-composer)] border border-border-subtle bg-bg-composer shadow-sm",
        )}
      >
        <div className="px-3 pt-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message Maximus…"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <IconButton icon={Paperclip} label="Attach file" />
          {streaming ? (
            <button
              type="button"
              aria-label="Stop generating"
              onClick={onStop}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-bg-app"
            >
              <Icon icon={Square} size="sm" className="text-bg-app" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
              onClick={submit}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                canSend
                  ? "bg-accent text-accent-fg hover:brightness-110"
                  : "bg-bg-elevated text-text-muted",
              )}
            >
              <Icon icon={ArrowUp} size="sm" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">
        Maximus can make mistakes. Verify important information.
      </p>
    </div>
  );
}
