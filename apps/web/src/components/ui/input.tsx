import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "#/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  );
});
