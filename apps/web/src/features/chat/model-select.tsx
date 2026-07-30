import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export type ModelOption = {
  modelRef: string;
  displayName: string;
  capabilities?: Record<string, unknown>;
};

/** Compact model control for inside the composer toolbar. */
export function ModelSelect({
  value,
  onChange,
  className,
  onCapabilities,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  onCapabilities?: (caps: {
    vision: boolean;
    imageGen: boolean;
  }) => void;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/models", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("models");
        return r.json() as Promise<{ models: ModelOption[] }>;
      })
      .then((d) => {
        setModels(d.models);
        // Only auto-pick when nothing selected yet — never clobber a sticky conv model
        if (!value && d.models.length) {
          onChange(d.models[0]!.modelRef);
        }
      })
      .catch(() => setError("Could not load models"));
  }, []);

  const selected = models.find((m) => m.modelRef === value);
  const options =
    value && !selected
      ? [{ modelRef: value, displayName: value }, ...models]
      : models;
  const vision = selected?.capabilities?.vision === true;
  const imageGen = selected?.capabilities?.imageGen === true;

  useEffect(() => {
    onCapabilities?.({ vision, imageGen });
  }, [vision, imageGen, onCapabilities, value]);

  return (
    <div className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <label className="relative inline-flex min-w-0 max-w-[11rem] items-center sm:max-w-[14rem]">
        <span className="sr-only">Model</span>
        <select
          aria-label="Model"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none truncate rounded-lg border border-border-subtle bg-bg-app",
            "py-1 pl-2.5 pr-7 text-[12.5px] font-medium text-text-secondary",
            "hover:bg-bg-sidebar-hover hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            "cursor-pointer",
          )}
        >
          {options.length === 0 ? (
            <option value={value}>{error ?? "Loading…"}</option>
          ) : (
            options.map((m) => (
              <option key={m.modelRef} value={m.modelRef}>
                {m.displayName}
              </option>
            ))
          )}
        </select>
        <Icon
          icon={ChevronDown}
          size="sm"
          className="pointer-events-none absolute right-1.5 text-text-faint"
        />
      </label>
      {vision ? (
        <span className="hidden rounded-md bg-bg-sidebar-hover px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint sm:inline">
          Vision
        </span>
      ) : null}
      {imageGen ? (
        <span className="hidden rounded-md bg-bg-sidebar-hover px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint sm:inline">
          Image
        </span>
      ) : null}
    </div>
  );
}
