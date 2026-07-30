import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "#/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-btn-primary" : "bg-bg-sidebar-hover border-border-subtle",
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-4 w-4 translate-x-0.5 rounded-full bg-bg-app shadow transition-transform",
          checked && "translate-x-[1.125rem] bg-btn-primary-fg",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
