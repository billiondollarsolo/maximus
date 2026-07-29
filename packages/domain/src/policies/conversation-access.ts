import type { OrgRole } from "./rbac.js";

export type ConversationAccessInput = {
  conversationOrgId: string;
  conversationUserId: string;
  actorOrgId: string;
  actorUserId: string;
  actorRole: OrgRole;
};

/**
 * D12: only conversation owner can read/write content.
 * Admins get usage/audit only — not message bodies.
 * Cross-org: deny (caller maps to 404).
 */
export function canReadConversation(input: ConversationAccessInput): boolean {
  if (input.conversationOrgId !== input.actorOrgId) return false;
  return input.conversationUserId === input.actorUserId;
}

export function canWriteConversation(input: ConversationAccessInput): boolean {
  return canReadConversation(input);
}
