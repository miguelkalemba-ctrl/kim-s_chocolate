export type SortDirection = "asc" | "desc";

export type SortableItem = {
  sold: boolean;
  name: string;
  dateAdded: string;
  updatedAt?: string;
  repairs?: Array<{
    name?: string;
    done?: boolean;
    state?: string;
  }>;
  auditTrail?: Array<{
    ts?: string;
    action?: string;
  }>;
  [key: string]: unknown;
};

function toTimestamp(value: unknown): number {
  if (typeof value !== "string") return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function getLatestSoldTimestamp<T extends SortableItem>(item: T): number {
  const auditTs = Array.isArray(item.auditTrail)
    ? item.auditTrail
        .filter((entry) => entry?.action === "marked-sold")
        .reduce((maxTs, entry) => Math.max(maxTs, toTimestamp(entry?.ts)), 0)
    : 0;

  if (auditTs > 0) return auditTs;
  return Math.max(toTimestamp(item.updatedAt), toTimestamp(item.dateAdded));
}

function isReadyForSale<T extends SortableItem>(item: T): boolean {
  if (item.sold) return false;
  if (!Array.isArray(item.repairs)) return false;
  return item.repairs.some((step) => step?.name === "Ready for Sale" && Boolean(step.done));
}

function getHierarchyRank<T extends SortableItem>(item: T): 0 | 1 | 2 {
  if (item.sold) return 2;
  if (isReadyForSale(item)) return 0;
  return 1;
}

function getWorkflowStatusRank<T extends SortableItem>(item: T): number {
  if (item.sold) return 99;
  if (!Array.isArray(item.repairs)) return 0;

  const byName = new Map(item.repairs.map((step) => [step?.name, step]));
  const intake = byName.get("Intake");
  const check = byName.get("Check");
  const quality = byName.get("Quality Control");
  const ready = byName.get("Ready for Sale");
  const repair = byName.get("Repair");
  const repairState = typeof repair?.state === "string" ? repair.state : repair?.done ? "noNeed" : "none";

  if (ready?.done) return 80;
  if (quality?.done) return 70;
  if (repairState === "repaired") return 60;
  if (repairState === "inProgress") return 50;
  if (repairState === "noNeed") return 40;
  if (check?.done) return 30;
  if (intake?.done) return 20;
  return 10;
}

function compareWithinHierarchy<T extends SortableItem>(a: T, b: T, sortField: string, sortDir: SortDirection): number {
  const rank = getHierarchyRank(a);

  if (rank === 0 || rank === 1) {
    if (sortField === "status") {
      const statusDiff = sortDir === "asc"
        ? getWorkflowStatusRank(a) - getWorkflowStatusRank(b)
        : getWorkflowStatusRank(b) - getWorkflowStatusRank(a);
      if (statusDiff !== 0) return statusDiff;
    } else if (sortField) {
      const v1 = a[sortField];
      const v2 = b[sortField];

      if (typeof v1 === "string" && typeof v2 === "string") {
        if (sortField === "dateAdded") {
          const t1 = toTimestamp(v1);
          const t2 = toTimestamp(v2);
          const diff = sortDir === "asc" ? t1 - t2 : t2 - t1;
          if (diff !== 0) return diff;
        } else {
          const diff = sortDir === "asc" ? v1.localeCompare(v2) : v2.localeCompare(v1);
          if (diff !== 0) return diff;
        }
      }

      if (typeof v1 === "number" && typeof v2 === "number") {
        const diff = sortDir === "asc" ? v1 - v2 : v2 - v1;
        if (diff !== 0) return diff;
      }
    }

    const dateDiff = toTimestamp(b.dateAdded) - toTimestamp(a.dateAdded);
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name);
  }

  const soldDiff = getLatestSoldTimestamp(b) - getLatestSoldTimestamp(a);
  if (soldDiff !== 0) return soldDiff;

  const addedDiff = toTimestamp(b.dateAdded) - toTimestamp(a.dateAdded);
  if (addedDiff !== 0) return addedDiff;

  return a.name.localeCompare(b.name);
}

export function sortItemsSoldLast<T extends SortableItem>(
  items: T[],
  sortField: string,
  sortDir: SortDirection
): T[] {
  const list = [...items];
  return list.sort((a, b) => {
    const rankDiff = getHierarchyRank(a) - getHierarchyRank(b);
    if (rankDiff !== 0) return rankDiff;
    return compareWithinHierarchy(a, b, sortField, sortDir);
  });
}
