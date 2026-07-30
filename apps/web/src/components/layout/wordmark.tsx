import { cn } from "#/lib/cn";

/** Quiet product wordmark — ChatGPT-density sidebar header style. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none text-[15px] font-semibold tracking-[-0.01em] text-text-primary",
        className,
      )}
    >
      Maximus
    </span>
  );
}
