const SUGGESTIONS = [
  { title: "Explain a concept", subtitle: "Multi-tenant RBAC for chat apps" },
  {
    title: "Draft a design",
    subtitle: "Streaming LLM API architecture",
  },
  {
    title: "Compare options",
    subtitle: "Ollama vs OpenAI-compatible gateways",
  },
  {
    title: "Write tests",
    subtitle: "Acceptance cases for message trees",
  },
];

export function EmptyState({
  onSuggestion,
}: {
  onSuggestion?: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6">
      <h1 className="text-center text-[28px] font-semibold tracking-tight text-text-primary md:text-[32px]">
        What can I help with?
      </h1>

      <div className="mt-10 grid w-full max-w-[42rem] gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onSuggestion?.(`${s.title}: ${s.subtitle}`)}
            className="rounded-[var(--radius-lg)] border border-border-subtle bg-transparent px-4 py-3.5 text-left transition-colors hover:bg-bg-sidebar-hover"
          >
            <div className="text-[14px] font-medium text-text-primary">
              {s.title}
            </div>
            <div className="mt-0.5 text-[13px] text-text-muted">
              {s.subtitle}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
