import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "#/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select styled to match Input / field-control. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("field-control", className)} {...props}>
        {children}
      </select>
    );
  },
);
