import { describe, expect, it } from "vitest";
import { createFakeTextAdapter } from "./fake-adapter.js";

describe("createFakeTextAdapter", () => {
  it("yields scripted chunks", async () => {
    const adapter = createFakeTextAdapter({});
    const out: string[] = [];
    for await (const c of adapter.stream([{ role: "user", content: "hi" }])) {
      if (c.type === "text") out.push(c.text);
    }
    expect(out.join("")).toBe("Hello from fake.");
  });

  it("supports abort mid-stream", async () => {
    const adapter = createFakeTextAdapter({
      delayMs: 30,
      chunks: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
        { type: "text", text: "c" },
      ],
    });
    const ac = new AbortController();
    const gen = adapter.stream([{ role: "user", content: "x" }], {
      signal: ac.signal,
    });
    const first = await gen.next();
    expect(first.value).toEqual({ type: "text", text: "a" });
    ac.abort();
    await expect(gen.next()).rejects.toMatchObject({ name: "AbortError" });
  });
});
