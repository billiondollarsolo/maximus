import type { TextareaHTMLAttributes } from "react";
import { cn } from "#/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[44px] w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
