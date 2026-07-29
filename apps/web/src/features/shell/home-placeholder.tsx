/**
 * Temporary landing until AppShell + chat land in WP1.
 * Uses global token utilities only — no page-local CSS.
 */
export function HomePlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-app px-6 text-text-primary">
      <p className="text-sm font-medium tracking-wide text-accent">Maximus</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Enterprise chat workspace
      </h1>
      <p className="mt-3 max-w-md text-center text-text-muted">
        Scaffold is live. ChatGPT-class shell, multi-provider streaming, and
        org admin ship in upcoming work packages.
      </p>
    </main>
  );
}
