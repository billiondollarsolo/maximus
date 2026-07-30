import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "#/lib/cn";
import { Icon, type IconSize } from "./icon";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  iconSize?: IconSize;
};

export function IconButton({
  icon,
  label,
  iconSize = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors",
        "hover:bg-bg-sidebar-hover hover:text-text-primary",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Icon icon={icon} size={iconSize} />
    </button>
  );
}
