import { AppError } from "./errors.js";
import {
  contentHasImages,
  modelAcceptsImages,
  type ModelCapabilities,
} from "./model-capabilities.js";

/**
 * Reject chat turns that attach images when the model cannot accept them.
 */
export function assertVisionAllowed(
  caps: ModelCapabilities,
  parts: Array<{ type: string }>,
): void {
  if (!contentHasImages(parts)) return;
  if (!modelAcceptsImages(caps)) {
    throw new AppError(
      "VALIDATION",
      "This model cannot see images. Switch to a Vision-capable model.",
    );
  }
}
