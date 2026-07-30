/**
 * ChatGPT empty canvas: centered headline only (composer is sibling below).
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <h1 className="text-center text-[28px] font-normal tracking-tight text-text-primary md:text-[32px]">
        Ready when you are.
      </h1>
    </div>
  );
}
