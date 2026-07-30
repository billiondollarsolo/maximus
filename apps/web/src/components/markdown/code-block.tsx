import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";
import { textFromReactChildren } from "./stream-markdown";

export function CodeBlock({
  language,
  code,
  children,
  className,
}: {
  language?: string;
  /** Plain source for copy when children are highlighted nodes */
  code?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const plain =
    code ??
    textFromReactChildren(children).replace(/\n$/, "");
  const lang = (language || "code").replace(/^language-/, "");

  return (
    <div className="code-block my-3 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-bg-code">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-bg-sidebar px-3 py-1.5 text-[12px] text-text-muted">
        <span className="font-medium lowercase tracking-wide">{lang}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
          onClick={() => {
            void navigator.clipboard.writeText(plain).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          <Icon icon={copied ? Check : Copy} size="sm" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={cn(
          "m-0 overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-text-primary",
          className,
        )}
      >
        {children ?? <code>{plain}</code>}
      </pre>
    </div>
  );
}

/** Inline `code` chip */
export function InlineCode({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "rounded-md bg-bg-composer px-1.5 py-0.5 font-mono text-[0.88em] text-text-primary",
        className,
      )}
    >
      {children}
    </code>
  );
}
