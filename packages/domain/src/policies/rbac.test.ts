import { describe, expect, it } from "vitest";
import {
  canAdminOrg,
  canChat,
  canDeleteOrg,
  canManageMembers,
  canManageProviders,
  canViewAudit,
  canViewUsage,
} from "./rbac.js";
import {
  canReadConversation,
  canWriteConversation,
} from "./conversation-access.js";

describe("rbac", () => {
  it("member can chat but not admin", () => {
    expect(canChat("member")).toBe(true);
    expect(canAdminOrg("member")).toBe(false);
    expect(canManageMembers("member")).toBe(false);
    expect(canManageProviders("member")).toBe(false);
    expect(canViewUsage("member")).toBe(false);
    expect(canViewAudit("member")).toBe(false);
    expect(canDeleteOrg("member")).toBe(false);
  });

  it("admin can manage but not delete org", () => {
    expect(canAdminOrg("admin")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageProviders("admin")).toBe(true);
    expect(canViewUsage("admin")).toBe(true);
    expect(canDeleteOrg("admin")).toBe(false);
  });

  it("owner can delete org", () => {
    expect(canDeleteOrg("owner")).toBe(true);
  });
});

describe("conversation-access D12", () => {
  const base = {
    conversationOrgId: "org1",
    conversationUserId: "user1",
    actorOrgId: "org1",
    actorUserId: "user1",
    actorRole: "member" as const,
  };

  it("owner of conversation can read/write", () => {
    expect(canReadConversation(base)).toBe(true);
    expect(canWriteConversation(base)).toBe(true);
  });

  it("admin cannot read others’ bodies", () => {
    expect(
      canReadConversation({
        ...base,
        actorUserId: "admin1",
        actorRole: "admin",
      }),
    ).toBe(false);
  });

  it("cross-org denied", () => {
    expect(
      canReadConversation({ ...base, actorOrgId: "org2" }),
    ).toBe(false);
  });
});
