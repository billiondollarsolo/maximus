import { Download } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export function AttachmentImage({
  attachmentId,
  alt,
  className,
  showDownload,
}: {
  attachmentId: string;
  alt?: string;
  className?: string;
  showDownload?: boolean;
}) {
  const src = `/api/attachments/${attachmentId}`;
  return (
    <div className={cn("relative inline-block max-w-full", className)}>
      <img
        src={src}
        alt={alt ?? "Attachment"}
        className="max-h-72 max-w-full rounded-xl border border-border-subtle object-contain"
        loading="lazy"
      />
      {showDownload ? (
        <a
          href={src}
          download
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-bg-elevated/90 px-2 py-1 text-[11px] text-text-secondary shadow hover:text-text-primary"
        >
          <Icon icon={Download} size="sm" />
          Download
        </a>
      ) : null}
    </div>
  );
}
