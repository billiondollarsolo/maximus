import { Wordmark } from "#/components/layout/wordmark";
import { cn } from "#/lib/cn";

export function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-app px-4">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-border-subtle bg-bg-sidebar p-8 shadow-xl",
          className,
        )}
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Wordmark className="text-base" />
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
