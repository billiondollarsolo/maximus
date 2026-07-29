import { describe, expect, it } from "vitest";
import { createStorageClient } from "./s3.js";

describe("storage key layout", () => {
  it("builds org-scoped attachment keys", () => {
    const s = createStorageClient({
      endpoint: "http://localhost:9000",
      accessKey: "a",
      secretKey: "b",
      bucket: "maximus-uploads",
    });
    expect(s.attachmentKey("org1", "att1")).toBe("org/org1/att/att1");
  });
});
