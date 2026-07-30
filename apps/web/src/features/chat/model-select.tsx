import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export type ModelOption = {
  modelRef: string;
  displayName: string;
  capabilities?: Record<string, unknown>;
};

export function ModelSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
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
        if (d.models.length && !d.models.some((m) => m.modelRef === value)) {
          onChange(d.models[0]!.modelRef);
        }
      })
      .catch(() => setError("Could not load models"));
  }, []);

  const selected = models.find((m) => m.modelRef === value);
  const vision = selected?.capabilities?.vision === true;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <label className="relative inline-flex items-center">
        <span className="sr-only">Model</span>
        <select
          aria-label="Model"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border border-border-subtle bg-bg-elevated py-1.5 pl-3 pr-8 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {models.length === 0 ? (
            <option value={value}>{error ?? "Loading models…"}</option>
          ) : (
            models.map((m) => (
              <option key={m.modelRef} value={m.modelRef}>
                {m.displayName}
              </option>
            ))
          )}
        </select>
        <Icon
          icon={ChevronDown}
          size="sm"
          className="pointer-events-none absolute right-2 text-text-muted"
        />
      </label>
      {vision ? (
        <span className="text-[10px] uppercase tracking-wide text-text-muted">
          Vision
        </span>
      ) : null}
    </div>
  );
}
