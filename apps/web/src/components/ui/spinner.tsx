import { LoaderCircle } from "lucide-react";
import { cn } from "#/lib/cn";
import { Icon } from "./icon";

export function Spinner({ className }: { className?: string }) {
  return (
    <Icon
      icon={LoaderCircle}
      className={cn("animate-spin text-text-muted", className)}
      size="md"
    />
  );
}
