export type ItemAuditEntry = {
  ts: string;
  user: string;
  action: string;
  revision: number;
};

export type ItemAuditMetadata = {
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
  auditTrail: ItemAuditEntry[];
};

export function createAuditMetadata(user: string, nowIso = new Date().toISOString()): ItemAuditMetadata {
  return {
    createdBy: user,
    updatedBy: user,
    updatedAt: nowIso,
    revision: 1,
    auditTrail: [
      {
        ts: nowIso,
        user,
        action: "created",
        revision: 1,
      },
    ],
  };
}

export function getUpdatedAuditMetadata(
  previous: Pick<ItemAuditMetadata, "createdBy" | "revision" | "auditTrail">,
  user: string,
  action: string,
  nowIso = new Date().toISOString()
): ItemAuditMetadata {
  const nextRevision = (previous.revision || 1) + 1;

  return {
    createdBy: previous.createdBy || user,
    updatedBy: user,
    updatedAt: nowIso,
    revision: nextRevision,
    auditTrail: [
      ...(Array.isArray(previous.auditTrail) ? previous.auditTrail : []),
      {
        ts: nowIso,
        user,
        action,
        revision: nextRevision,
      },
    ],
  };
}
