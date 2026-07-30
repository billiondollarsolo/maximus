import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { assertVisionAllowed } from "./assert-vision.js";

describe("assertVisionAllowed", () => {
  it("allows text-only on any model", () => {
    expect(() =>
      assertVisionAllowed({ streaming: true }, [{ type: "text" }]),
    ).not.toThrow();
  });

  it("allows images on vision model", () => {
    expect(() =>
      assertVisionAllowed({ vision: true }, [
        { type: "text" },
        { type: "image" },
      ]),
    ).not.toThrow();
  });

  it("rejects images on non-vision model", () => {
    expect(() =>
      assertVisionAllowed({ streaming: true }, [{ type: "image" }]),
    ).toThrow(AppError);
    try {
      assertVisionAllowed({}, [{ type: "image" }]);
    } catch (e) {
      expect(e).toMatchObject({ code: "VALIDATION" });
    }
  });
});
