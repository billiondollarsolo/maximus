import { useEffect, useMemo, useRef, useState } from "react";
import { modelIdFromRef } from "@maximus/domain";
import { ChevronDown } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

export type ModelOption = {
  modelRef: string;
  displayName: string;
  capabilities?: Record<string, unknown>;
  connectionName?: string | null;
  providerKind?: string;
};

/** Searchable model control for the composer toolbar. */
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "model-select-listbox";

  useEffect(() => {
    void fetch("/api/models", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("models");
        return r.json() as Promise<{
          models: ModelOption[];
          defaultModelRef?: string | null;
        }>;
      })
      .then((d) => {
        setModels(d.models);
        if (!value && d.models.length) {
          const preferred =
            d.defaultModelRef &&
            d.models.some((m) => m.modelRef === d.defaultModelRef)
              ? d.defaultModelRef
              : d.models[0]!.modelRef;
          onChange(preferred);
        }
      })
      .catch(() => setError("Could not load models"));
  }, []);

  const selected = models.find((m) => m.modelRef === value);
  const options =
    value && !selected
      ? [{ modelRef: value, displayName: value }, ...models]
      : models;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.modelRef.toLowerCase().includes(q) ||
        (m.connectionName ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const m of filtered) {
      const key =
        m.connectionName ||
        (m.modelRef.includes(":platform:")
          ? "Platform"
          : m.providerKind || "Models");
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = useMemo(() => groups.flatMap(([, ms]) => ms), [groups]);

  const vision = selected?.capabilities?.vision === true;
  const imageGen = selected?.capabilities?.imageGen === true;

  useEffect(() => {
    onCapabilities?.({ vision, imageGen });
  }, [vision, imageGen, onCapabilities, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(ref: string) {
    onChange(ref);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = flat[activeIdx];
      if (m) pick(m.modelRef);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex min-w-0 items-center gap-1.5", className)}
    >
      <div className="relative min-w-0 max-w-[16rem] sm:max-w-[22rem]">
        <button
          type="button"
          aria-label="Model"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          title={selected?.displayName ?? value}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={cn(
            "flex w-full min-w-[8rem] items-center justify-between gap-1 truncate rounded-lg border border-border-subtle bg-bg-app",
            "py-1 pl-2.5 pr-7 text-left text-[12.5px] font-medium text-text-secondary",
            "hover:bg-bg-sidebar-hover hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          )}
        >
          <span className="truncate">
            {options.length === 0
              ? (error ?? "No models — Admin → Providers")
              : (selected?.displayName ?? value) || "Select model"}
          </span>
          <Icon
            icon={ChevronDown}
            size="sm"
            className="pointer-events-none absolute right-1.5 text-text-faint"
          />
        </button>

        {open ? (
          <div
            className="absolute bottom-full left-0 z-50 mb-1 w-[min(22rem,90vw)] overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-lg"
            role="presentation"
          >
            <div className="border-b border-border-subtle p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search models…"
                aria-autocomplete="list"
                aria-controls={listId}
                aria-activedescendant={
                  flat[activeIdx]
                    ? `model-opt-${flat[activeIdx]!.modelRef}`
                    : undefined
                }
                className="w-full rounded-md border border-border-subtle bg-bg-app px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label="Models"
              className="max-h-64 overflow-y-auto py-1"
            >
              {flat.length === 0 ? (
                <li className="px-3 py-3 text-sm text-text-muted">
                  {options.length === 0
                    ? "No models configured — Admin → Providers"
                    : "No matches"}
                </li>
              ) : (
                groups.map(([group, ms]) => (
                  <li key={group} role="presentation">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                      {group}
                    </div>
                    <ul role="group" aria-label={group}>
                      {ms.map((m) => {
                        const idx = flat.findIndex(
                          (x) => x.modelRef === m.modelRef,
                        );
                        const active = idx === activeIdx;
                        const isSel = m.modelRef === value;
                        return (
                          <li key={m.modelRef} role="presentation">
                            <button
                              type="button"
                              id={`model-opt-${m.modelRef}`}
                              role="option"
                              aria-selected={isSel}
                              className={cn(
                                "flex w-full flex-col items-start px-3 py-1.5 text-left text-sm",
                                active || isSel
                                  ? "bg-accent/15 text-text-primary"
                                  : "text-text-secondary hover:bg-bg-hover",
                              )}
                              onMouseEnter={() => setActiveIdx(idx)}
                              onClick={() => pick(m.modelRef)}
                            >
                              <span className="truncate font-medium">
                                {m.displayName}
                              </span>
                              {(() => {
                                const id = modelIdFromRef(m.modelRef);
                                return m.displayName !== id ? (
                                  <span className="truncate font-mono text-[10px] text-text-faint">
                                    {id}
                                  </span>
                                ) : null;
                              })()}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
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
