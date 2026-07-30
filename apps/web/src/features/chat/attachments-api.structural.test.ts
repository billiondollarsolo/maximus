import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("attachment GET authz in source", () => {
  it("scopes by org via getAttachmentForOrg", () => {
    const src = readFileSync(
      join(import.meta.dirname, "../../routes/api/attachments.$id.ts"),
      "utf8",
    );
    expect(src).toContain("getAttachmentForOrg");
    expect(src).toContain("requireAuth");
    expect(src).toContain("NOT_FOUND");
  });
});
