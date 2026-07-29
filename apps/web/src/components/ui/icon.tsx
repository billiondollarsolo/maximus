import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "#/lib/cn";

const sizeMap = {
  sm: 16,
  md: 18,
  lg: 20,
} as const;

export type IconSize = keyof typeof sizeMap;

export type IconProps = Omit<LucideProps, "size" | "ref"> & {
  icon: LucideIcon;
  size?: IconSize | number;
  /** Decorative icons should be hidden from AT */
  decorative?: boolean;
  className?: string;
};

/**
 * Sole Lucide entrypoint — features must not import lucide icons raw for size/a11y consistency.
 */
export function Icon({
  icon: Lucide,
  size = "md",
  decorative = true,
  className,
  strokeWidth = 1.75,
  ...rest
}: IconProps) {
  const px = typeof size === "number" ? size : sizeMap[size];
  return (
    <Lucide
      size={px}
      strokeWidth={strokeWidth}
      aria-hidden={decorative ? true : undefined}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}
