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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg-app px-4">
      <div
        className={cn(
          "w-full max-w-[400px] rounded-[var(--radius-lg)] border border-border-subtle bg-bg-sidebar p-8 shadow-[var(--shadow-soft)]",
          className,
        )}
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Wordmark className="text-lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-[13.5px] leading-snug text-text-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
