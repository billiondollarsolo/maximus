import { useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { Icon, IconButton, Textarea } from "#/components/ui";
import { cn } from "#/lib/cn";
import { ModelSelect } from "./model-select";

export type PendingAttachment = {
  id: string;
  filename: string;
};

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
  onSend?: (text: string, attachmentIds?: string[]) => void;
  onStop?: () => void;
  initialValue?: string;
}) {
  const [text, setText] = useState(initialValue);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend =
    (text.trim().length > 0 || attachments.length > 0) &&
    !streaming &&
    !uploading;

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
      // Best-effort PUT to presigned URL (RustFS/S3)
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
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="mb-2 flex justify-center">
        <ModelSelect value={modelRef} onChange={onModelChange} />
      </div>
      <div
        className={cn(
          "flex flex-col rounded-[var(--radius-composer)] border border-border-subtle bg-bg-composer shadow-sm",
        )}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-xs text-text-muted"
              >
                {a.filename}
                <button
                  type="button"
                  aria-label={`Remove ${a.filename}`}
                  className="hover:text-text-primary"
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
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,.txt,.pdf,text/plain,application/pdf"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            <IconButton
              icon={Paperclip}
              label="Attach file"
              disabled={streaming || uploading}
              onClick={() => fileRef.current?.click()}
            />
          </div>
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
