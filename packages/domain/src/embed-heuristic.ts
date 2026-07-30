/**
 * Heuristic: is this model id / name an embedding model (not for chat)?
 */
export function isEmbeddingModelName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (n.includes("embed")) return true;
  if (n.includes("bge-") || n.startsWith("bge")) return true;
  if (n.includes("e5-") || n.includes("gte-")) return true;
  if (n.includes("nomic-embed")) return true;
  if (n.includes("mxbai-embed")) return true;
  if (n.includes("all-minilm")) return true;
  if (n.includes("sentence-transform")) return true;
  if (/\bembedding\b/.test(n)) return true;
  return false;
}
