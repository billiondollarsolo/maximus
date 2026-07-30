import { useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export type PendingAttachment = {
  id: string;
  filename: string;
};

/**
 * ChatGPT-class composer: single elevated pill, tools inside, neutral send disc.
 * Model picker lives in the main header (not stacked above the field).
 */
export function Composer({
  streaming = false,
  onSend,
  onStop,
  initialValue = "",
  disabled,
}: {
  streaming?: boolean;
  onSend?: (text: string, attachmentIds?: string[]) => void;
  onStop?: () => void;
  initialValue?: string;
  disabled?: boolean;
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
    <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-3 md:px-5">
      <div
        className={cn(
          "flex flex-col bg-bg-composer shadow-[var(--shadow-composer)]",
          "rounded-[var(--radius-composer)]",
        )}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-app px-2.5 py-1 text-[12px] text-text-secondary"
              >
                {a.filename}
                <button
                  type="button"
                  aria-label={`Remove ${a.filename}`}
                  className="text-text-muted hover:text-text-primary"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                >
                  <Icon icon={X} size="sm" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-1 px-3 py-3">
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
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary disabled:opacity-40"
          >
            <Icon icon={Paperclip} size="sm" />
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message Maximus"
            rows={1}
            disabled={disabled}
            className="composer-input max-h-[200px] min-h-[28px] flex-1 bg-transparent text-text-primary placeholder:text-text-faint disabled:opacity-50"
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
              className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn-primary text-btn-primary-fg"
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
                "mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                canSend
                  ? "bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover"
                  : "bg-btn-send-disabled text-bg-app opacity-70",
              )}
            >
              <Icon icon={ArrowUp} size="sm" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] leading-snug text-text-faint">
        Maximus can make mistakes. Check important info.
      </p>
    </div>
  );
}
