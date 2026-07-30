import type { LabelHTMLAttributes } from "react";
import { cn } from "#/lib/cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[12.5px] font-medium text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}
