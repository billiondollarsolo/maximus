import { cn } from "#/lib/cn";
import { BrandMark } from "./brand-mark";

/** Product wordmark: mark + Maximus. */
export function Wordmark({
  className,
  markClassName,
  showText = true,
}: {
  className?: string;
  markClassName?: string;
  showText?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-text-primary",
        className,
      )}
    >
      <BrandMark
        className={cn("h-[1.2em] w-[1.2em] text-text-primary", markClassName)}
      />
      {showText ? <span>Maximus</span> : null}
    </span>
  );
}
