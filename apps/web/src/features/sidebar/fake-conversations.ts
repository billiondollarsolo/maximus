export type FakeConversation = {
  id: string;
  title: string;
  updatedAt: string; // ISO
};

/** Static demo data for WP1 shell — replaced by Query/repos later. */
export const FAKE_CONVERSATIONS: FakeConversation[] = [
  {
    id: "c1",
    title: "Summarize Q3 roadmap",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "c2",
    title: "Draft API design for chat gateway",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "c3",
    title: "Explain multi-tenant authz",
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: "c4",
    title: "Postgres message tree patterns",
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: "c5",
    title: "Ollama vs OpenAI-compatible endpoints",
    updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
];
