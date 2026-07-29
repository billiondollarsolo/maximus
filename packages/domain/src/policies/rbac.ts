export type OrgRole = "owner" | "admin" | "member";

const rank: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 };

export function hasMinRole(role: OrgRole, min: OrgRole): boolean {
  return rank[role] >= rank[min];
}

export function canAdminOrg(role: OrgRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageMembers(role: OrgRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageProviders(role: OrgRole): boolean {
  return hasMinRole(role, "admin");
}

export function canChat(role: OrgRole): boolean {
  return hasMinRole(role, "member");
}

export function canExportConversation(
  role: OrgRole,
  isOwner: boolean,
): boolean {
  return isOwner && canChat(role);
}

export function canViewUsage(role: OrgRole): boolean {
  return hasMinRole(role, "admin");
}

export function canViewAudit(role: OrgRole): boolean {
  return hasMinRole(role, "admin");
}

export function canDeleteOrg(role: OrgRole): boolean {
  return role === "owner";
}
