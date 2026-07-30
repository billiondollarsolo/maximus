import type { TextareaHTMLAttributes } from "react";
import { cn } from "#/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated px-3 py-2 text-[15px] text-text-primary placeholder:text-text-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}
