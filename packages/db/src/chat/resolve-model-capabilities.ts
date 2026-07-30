import {
  parseCapabilities,
  platformSeedModels,
  type ModelCapabilities,
} from "@maximus/domain";
import type { Db } from "../client.js";
import * as providerRepo from "../repos/providers.js";

export async function resolveModelCapabilities(
  db: Db,
  orgId: string,
  modelRef: string,
): Promise<ModelCapabilities> {
  const orgModels = await providerRepo.listModels(db, orgId);
  const orgHit = orgModels.find((m) => m.modelRef === modelRef);
  if (orgHit) {
    return parseCapabilities(
      (orgHit.capabilities ?? {}) as Record<string, unknown>,
    );
  }
  const platform = platformSeedModels().find((m) => m.modelRef === modelRef);
  if (platform) {
    return parseCapabilities(
      (platform.capabilities ?? {}) as Record<string, unknown>,
    );
  }
  return { streaming: true };
}
