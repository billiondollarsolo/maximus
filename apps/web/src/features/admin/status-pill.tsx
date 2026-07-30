import type { ComponentStatus } from "@maximus/domain";
import { overallLabel } from "@maximus/domain";
import { cn } from "#/lib/cn";

const tone: Record<ComponentStatus, string> = {
  ok: "status-pill status-pill-ok",
  degraded: "status-pill status-pill-degraded",
  error: "status-pill status-pill-error",
  unknown: "status-pill status-pill-unknown",
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: ComponentStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn(tone[status] ?? tone.unknown, className)}>
      <span className="status-pill-dot" aria-hidden />
      {label ?? overallLabel(status)}
    </span>
  );
}

export function LiveIndicator({
  status,
}: {
  status: "connecting" | "live" | "reconnecting" | "offline";
}) {
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting"
        ? "Reconnecting…"
        : status === "connecting"
          ? "Connecting…"
          : "Offline";
  const cls =
    status === "live"
      ? "live-indicator live-indicator-on"
      : status === "offline"
        ? "live-indicator live-indicator-off"
        : "live-indicator live-indicator-wait";
  return (
    <span className={cls} role="status" aria-live="polite">
      <span className="live-indicator-dot" aria-hidden />
      {label}
    </span>
  );
}
