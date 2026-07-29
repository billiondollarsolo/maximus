import { cn } from "#/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-sm font-semibold tracking-tight text-text-primary",
        className,
      )}
    >
      Maximus
    </span>
  );
}
