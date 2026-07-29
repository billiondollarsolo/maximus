import { ChevronDown } from "lucide-react";
import { Icon } from "#/components/ui";
import { cn } from "#/lib/cn";

const MODELS = [
  { id: "openai:platform:gpt-4.1", label: "GPT-4.1" },
  { id: "anthropic:platform:claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "ollama:local:llama3.2", label: "Llama 3.2 (Ollama)" },
];

export function ModelSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Model</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border-subtle bg-bg-elevated py-1.5 pl-3 pr-8 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <Icon
        icon={ChevronDown}
        size="sm"
        className="pointer-events-none absolute right-2 text-text-muted"
      />
    </label>
  );
}
