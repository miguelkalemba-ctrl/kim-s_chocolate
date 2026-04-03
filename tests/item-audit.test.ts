import { describe, expect, it } from "vitest";
import { createAuditMetadata, getUpdatedAuditMetadata } from "../lib/itemAudit";

describe("itemAudit helpers", () => {
  it("creates initial audit metadata", () => {
    const now = "2026-02-26T10:00:00.000Z";
    const result = createAuditMetadata("alice", now);

    expect(result.createdBy).toBe("alice");
    expect(result.updatedBy).toBe("alice");
    expect(result.revision).toBe(1);
    expect(result.auditTrail).toHaveLength(1);
    expect(result.auditTrail[0].action).toBe("created");
  });

  it("increments revision and appends audit trail on update", () => {
    const previous = createAuditMetadata("alice", "2026-02-26T10:00:00.000Z");
    const updated = getUpdatedAuditMetadata(previous, "bob", "edited", "2026-02-26T11:00:00.000Z");

    expect(updated.createdBy).toBe("alice");
    expect(updated.updatedBy).toBe("bob");
    expect(updated.revision).toBe(2);
    expect(updated.auditTrail).toHaveLength(2);
    expect(updated.auditTrail[1].action).toBe("edited");
    expect(updated.auditTrail[1].revision).toBe(2);
  });
});
