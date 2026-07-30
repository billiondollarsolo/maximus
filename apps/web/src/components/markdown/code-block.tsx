import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Icon } from "#/components/ui";

export function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-bg-code">
      <div className="flex items-center justify-between bg-bg-sidebar px-3 py-1.5 text-[12px] text-text-muted">
        <span className="font-medium lowercase tracking-wide">
          {language || "code"}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-bg-sidebar-hover hover:text-text-primary"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Icon icon={copied ? Check : Copy} size="sm" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-text-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}
