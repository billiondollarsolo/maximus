import { cn } from "#/lib/cn";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border-subtle bg-bg-elevated px-1.5 py-0.5 text-xs text-text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
