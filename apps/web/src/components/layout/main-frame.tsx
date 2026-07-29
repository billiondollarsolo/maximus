import { cn } from "#/lib/cn";

export function MainFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-bg-app",
        className,
      )}
    >
      {children}
    </main>
  );
}
