import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routesDir = join(import.meta.dirname, "../../routes");
const chatDir = import.meta.dirname;

describe("chat pathless layout", () => {
  it("mounts ChatWorkspace only in _chat pathless layout", () => {
    const layout = readFileSync(join(routesDir, "_chat.tsx"), "utf8");
    const index = readFileSync(join(routesDir, "_chat.index.tsx"), "utf8");
    const conv = readFileSync(
      join(routesDir, "_chat.c.$conversationId.tsx"),
      "utf8",
    );

    expect(layout).toContain("ChatWorkspace");
    expect(layout).toContain("createFileRoute(\"/_chat\")");
    expect(layout).toContain("conversationIdFromPath");
    expect(layout).toContain("location.pathname");

    expect(index).not.toContain("ChatWorkspace");
    expect(conv).not.toContain("ChatWorkspace");
  });

  it("chat SSE response disables proxy buffering", () => {
    const chat = readFileSync(join(routesDir, "api/chat.ts"), "utf8");
    expect(chat).toContain("text/event-stream");
    expect(chat).toContain("no-transform");
    expect(chat).toContain("X-Accel-Buffering");
  });

  it("empty shell uses treeMsgs not fragile branch projection", () => {
    const ws = readFileSync(join(chatDir, "chat-workspace.tsx"), "utf8");
    expect(ws).toContain("treeMsgs.length === 0");
    expect(ws).not.toMatch(/isEmpty = chat\.displayMessages\.length === 0/);
  });

  it("end-of-turn always reloads conversation from server", () => {
    const hook = readFileSync(join(chatDir, "use-chat-workspace.ts"), "utf8");
    expect(hook).toContain("force: true");
    expect(hook).toContain("syncedRouteRef");
    expect(hook).toContain("resolveLeafId");
  });
});
