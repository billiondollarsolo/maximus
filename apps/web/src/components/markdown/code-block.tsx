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
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-sidebar">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-1.5 text-xs text-text-muted">
        <span>{language || "code"}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-text-primary"
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
      <pre className="overflow-x-auto p-3 font-mono text-xs text-text-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}
