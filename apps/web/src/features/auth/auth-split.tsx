import { BrandMark } from "#/components/layout/brand-mark";
import { cn } from "#/lib/cn";

/**
 * Two-pane auth layout branded for Maximus.
 * Left: product pitch. Right: credentials form.
 */
export function AuthSplit({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-dvh bg-black lg:grid-cols-2", className)}>
      <div className="auth-pane-glow relative hidden overflow-hidden lg:flex lg:flex-col">
        <div className="auth-pane-grid pointer-events-none absolute inset-0 opacity-80" />

        <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-14">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-black shadow-lg shadow-black/30">
              <BrandMark className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-white">
                Maximus
              </div>
              <div className="text-[11px] text-white/40">
                self-hosted AI workspace
              </div>
            </div>
          </div>

          <div className="my-auto max-w-lg py-16">
            <h1 className="text-[2.35rem] font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
              Your AI workspace,{" "}
              <span className="text-accent">on your terms</span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/55">
              Streaming multi-provider chat on infrastructure you operate.
              Invite-only orgs, encrypted API keys, and live admin controls —
              built for teams that care about ownership.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Multi-provider chat
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Invite-only orgs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Self-host ready
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center bg-black px-6 py-12 sm:px-10 lg:px-14">
        <div className="mb-10 flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
            <BrandMark className="h-4.5 w-4.5" />
          </span>
          <span className="text-sm font-semibold text-white">Maximus</span>
        </div>
        <div className="mx-auto w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}

export function AuthFormTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[1.65rem] font-semibold tracking-tight text-white">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[13.5px] leading-snug text-white/50">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-white/80">
      {label}
      {children}
    </label>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  type = "submit",
  disabled,
}: {
  children: React.ReactNode;
  loading?: boolean;
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full",
        "bg-white text-[14px] font-medium text-black transition-colors",
        "hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function authInputClassName(extra?: string) {
  return cn(
    "h-11 w-full rounded-full border border-white/15 bg-transparent px-4",
    "text-[14px] text-white placeholder:text-white/30",
    "focus-visible:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15",
    extra,
  );
}
