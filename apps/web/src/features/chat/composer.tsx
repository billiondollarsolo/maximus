import { useRef, useState } from "react";
import { ArrowUp, Plus, Square } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export type PendingAttachment = {
  id: string;
  filename: string;
};

/**
 * ChatGPT-style single-row pill: + · Ask anything · send/stop
 */
export function Composer({
  streaming = false,
  onSend,
  onStop,
  initialValue = "",
  disabled,
  centered,
}: {
  streaming?: boolean;
  onSend?: (text: string, attachmentIds?: string[]) => void;
  onStop?: () => void;
  initialValue?: string;
  disabled?: boolean;
  /** When true, tighter vertically under empty hero (chatgpt.com empty) */
  centered?: boolean;
}) {
  const [text, setText] = useState(initialValue);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend =
    (text.trim().length > 0 || attachments.length > 0) &&
    !streaming &&
    !uploading &&
    !disabled;

  function submit() {
    if (!canSend) return;
    onSend?.(
      text.trim(),
      attachments.length ? attachments.map((a) => a.id) : undefined,
    );
    setText("");
    setAttachments([]);
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const intent = await fetch("/api/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!intent.ok) return;
      const data = (await intent.json()) as {
        attachmentId: string;
        uploadUrl: string;
      };
      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      }).catch(() => undefined);
      setAttachments((prev) => [
        ...prev,
        { id: data.attachmentId, filename: file.name },
      ]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[48rem] px-4",
        centered ? "pb-0 pt-6" : "pb-4 md:pb-5",
      )}
    >
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-1 text-[12px] text-text-secondary"
            >
              {a.filename}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-1 bg-bg-composer px-2 py-2",
          "rounded-[var(--radius-composer)] shadow-[var(--shadow-composer)]",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.txt,.pdf,text/plain,application/pdf"
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          aria-label="Attach file"
          disabled={streaming || uploading || disabled}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary disabled:opacity-40"
        >
          <Icon icon={Plus} size="sm" />
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything"
          rows={1}
          disabled={disabled}
          className="composer-input max-h-[120px] min-h-[28px] flex-1 py-1.5 text-text-primary placeholder:text-text-faint disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />

        {streaming ? (
          <button
            type="button"
            aria-label="Stop generating"
            onClick={onStop}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn-primary text-btn-primary-fg"
          >
            <Icon icon={Square} size="sm" className="fill-current" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send message"
            disabled={!canSend}
            onClick={submit}
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              canSend
                ? "bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover"
                : "bg-btn-send-disabled text-text-faint",
            )}
          >
            <Icon icon={ArrowUp} size="sm" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {!centered ? (
        <p className="mt-2 text-center text-[11px] text-text-faint">
          Maximus can make mistakes. Check important info.
        </p>
      ) : null}
    </div>
  );
}
