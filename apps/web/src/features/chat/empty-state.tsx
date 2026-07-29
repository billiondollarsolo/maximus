import { Button } from "#/components/ui";

const SUGGESTIONS = [
  "Explain multi-tenant RBAC for chat apps",
  "Draft a system design for streaming LLM APIs",
  "Compare Ollama and OpenAI-compatible gateways",
  "Help me write acceptance tests for message trees",
];

export function EmptyState({
  onSuggestion,
}: {
  onSuggestion?: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
        What can I help with?
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-text-muted">
        Maximus — multi-provider chat for teams. Pick a model and start a
        conversation.
      </p>
      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((text) => (
          <Button
            key={text}
            variant="secondary"
            className="h-auto justify-start whitespace-normal px-3 py-3 text-left font-normal"
            onClick={() => onSuggestion?.(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}
