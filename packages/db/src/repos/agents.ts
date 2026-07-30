import { and, asc, eq } from "drizzle-orm";
import { newId } from "../ids.js";
import type { Db } from "../client.js";
import { agentPresets } from "../schema/index.js";

export async function listAgentPresets(db: Db, orgId: string) {
  return db
    .select()
    .from(agentPresets)
    .where(eq(agentPresets.orgId, orgId))
    .orderBy(asc(agentPresets.sortOrder), asc(agentPresets.name));
}

export async function getAgentPreset(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(agentPresets)
    .where(and(eq(agentPresets.orgId, orgId), eq(agentPresets.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createAgentPreset(
  db: Db,
  input: {
    orgId: string;
    name: string;
    slug: string;
    baseModelRef: string;
    systemPrompt?: string | null;
    params?: Record<string, unknown>;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
  },
) {
  const [row] = await db
    .insert(agentPresets)
    .values({
      id: newId("agent"),
      orgId: input.orgId,
      name: input.name,
      slug: input.slug,
      baseModelRef: input.baseModelRef,
      systemPrompt: input.systemPrompt ?? null,
      params: input.params ?? {},
      isEnabled: input.isEnabled ?? true,
      isVisible: input.isVisible ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function updateAgentPreset(
  db: Db,
  input: {
    id: string;
    orgId: string;
    name?: string;
    baseModelRef?: string;
    systemPrompt?: string | null;
    params?: Record<string, unknown>;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
  },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.baseModelRef !== undefined) patch.baseModelRef = input.baseModelRef;
  if (input.systemPrompt !== undefined) patch.systemPrompt = input.systemPrompt;
  if (input.params !== undefined) patch.params = input.params;
  if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;
  if (input.isVisible !== undefined) patch.isVisible = input.isVisible;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  const [row] = await db
    .update(agentPresets)
    .set(patch)
    .where(and(eq(agentPresets.id, input.id), eq(agentPresets.orgId, input.orgId)))
    .returning();
  return row ?? null;
}

export async function deleteAgentPreset(db: Db, orgId: string, id: string) {
  await db
    .delete(agentPresets)
    .where(and(eq(agentPresets.orgId, orgId), eq(agentPresets.id, id)));
}

/**
 * Resolve agent for chat: fails clearly if base model is disabled/missing.
 */
export function resolveAgentForRun(input: {
  agent: {
    baseModelRef: string;
    systemPrompt: string | null;
    params: Record<string, unknown>;
    isEnabled: boolean;
    name: string;
  };
  baseOffering: { modelRef: string; isEnabled: boolean } | null;
}): {
  ok: true;
  baseModelRef: string;
  systemPrompt: string | null;
  params: Record<string, unknown>;
} | { ok: false; error: string } {
  if (!input.agent.isEnabled) {
    return { ok: false, error: `Agent “${input.agent.name}” is disabled` };
  }
  if (!input.baseOffering) {
    return {
      ok: false,
      error: `Base model ${input.agent.baseModelRef} is not available for agent “${input.agent.name}”`,
    };
  }
  if (!input.baseOffering.isEnabled) {
    return {
      ok: false,
      error: `Base model ${input.agent.baseModelRef} is disabled; enable it or repoint agent “${input.agent.name}”`,
    };
  }
  return {
    ok: true,
    baseModelRef: input.agent.baseModelRef,
    systemPrompt: input.agent.systemPrompt,
    params: input.agent.params ?? {},
  };
}
