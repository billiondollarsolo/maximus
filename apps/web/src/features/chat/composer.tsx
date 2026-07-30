import { useRef, useState } from "react";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";
import { ModelSelect } from "./model-select";

export type PendingAttachment = {
  id: string;
  filename: string;
};

/**
 * Expanded, squarer composer with model selector in the toolbar.
 * Layout: wide text area on top · tools + model + send on bottom row.
 */
export function Composer({
  modelRef,
  onModelChange,
  streaming = false,
  onSend,
  onStop,
  initialValue = "",
  disabled,
  centered,
}: {
  modelRef: string;
  onModelChange: (value: string) => void;
  streaming?: boolean;
  onSend?: (text: string, attachmentIds?: string[]) => void;
  onStop?: () => void;
  initialValue?: string;
  disabled?: boolean;
  /** Under empty hero — still full-width field */
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
        "mx-auto w-full max-w-[var(--content-max)] px-4",
        centered ? "pb-0 pt-6" : "pb-4 md:pb-5",
      )}
    >
      <div
        className={cn(
          "flex flex-col bg-bg-composer shadow-[var(--shadow-composer)]",
          "rounded-[var(--radius-composer)]",
          "min-h-[7.5rem]",
        )}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3.5 pt-3">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-app px-2.5 py-1 text-[12px] text-text-secondary"
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

        {/* Expanded multi-line text area */}
        <div className="flex-1 px-3.5 pt-3.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask anything"
            rows={3}
            disabled={disabled}
            className={cn(
              "composer-input w-full max-h-[220px] min-h-[4.5rem]",
              "text-[15.5px] leading-relaxed text-text-primary",
              "placeholder:text-text-faint disabled:opacity-50",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>

        {/* Toolbar: attach · model · send */}
        <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
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
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary disabled:opacity-40"
          >
            <Icon icon={Plus} size="sm" />
          </button>

          <ModelSelect
            value={modelRef}
            onChange={onModelChange}
            className="min-w-0 flex-1"
          />

          {streaming ? (
            <button
              type="button"
              aria-label="Stop generating"
              onClick={onStop}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-btn-primary text-btn-primary-fg"
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
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                canSend
                  ? "bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover"
                  : "bg-btn-send-disabled text-text-faint",
              )}
            >
              <Icon icon={ArrowUp} size="sm" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {!centered ? (
        <p className="mt-2 text-center text-[11px] text-text-faint">
          Maximus can make mistakes. Check important info.
        </p>
      ) : null}
    </div>
  );
}
