import type { ItemAuditEntry } from "@/lib/itemAudit";

export type NormalizeRepairStep = {
  name: string;
  done: boolean;
  state?: "none" | "noNeed" | "inProgress" | "repaired" | "sold";
};

export type NormalizeItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  location: string;
  repairLocation: string;
  width: number;
  height: number;
  depth: number;
  repairs: NormalizeRepairStep[];
  photos: string[];
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  damageDescription: string;
  notes: string;
  dateAdded: string;
  brand: string;
  year: number;
  material: string;
  sold: boolean;
  soldAt?: string | null;
  soldBy?: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
  auditTrail: ItemAuditEntry[];
  stockCount: number;
  stockLimit: number;
  stockUnit: string;
  stockHistory: Array<{ date: string; count: number }>;
};

export function normalizeItem(
  input: unknown,
  repairFactory: () => NormalizeRepairStep[]
): NormalizeItem | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Partial<NormalizeItem>;

  const condition: NormalizeItem["condition"] =
    source.condition === "Excellent" ||
    source.condition === "Good" ||
    source.condition === "Fair" ||
    source.condition === "Poor"
      ? source.condition
      : "Good";

  const repairs = Array.isArray(source.repairs)
    ? source.repairs
        .filter((step): step is NormalizeRepairStep => !!step && typeof step === "object")
        .map((step) => ({
          name: typeof step.name === "string" ? step.name : "Step",
          done: Boolean(step.done),
          ...(step.state ? { state: step.state } : {}),
        }))
    : repairFactory();

  return {
    id: typeof source.id === "string" ? source.id : `KMC-${Date.now()}`,
    code: typeof source.code === "string" ? source.code : `KMC-${Date.now()}`,
    name: typeof source.name === "string" ? source.name : "Unnamed Item",
    category: typeof source.category === "string" ? source.category : "Unknown",
    price: typeof source.price === "number" ? source.price : Number(source.price) || 0,
    location: typeof source.location === "string" ? source.location : "",
    repairLocation: typeof source.repairLocation === "string" ? source.repairLocation : "",
    width: typeof source.width === "number" ? source.width : Number(source.width) || 0,
    height: typeof source.height === "number" ? source.height : Number(source.height) || 0,
    depth: typeof source.depth === "number" ? source.depth : Number(source.depth) || 0,
    repairs: repairs.length > 0 ? repairs : repairFactory(),
    photos: Array.isArray(source.photos)
      ? source.photos.filter((photo): photo is string => typeof photo === "string")
      : [],
    condition,
    damageDescription:
      typeof source.damageDescription === "string" ? source.damageDescription : "",
    notes: typeof source.notes === "string" ? source.notes : "",
    dateAdded:
      typeof source.dateAdded === "string"
        ? source.dateAdded
        : new Date().toISOString().split("T")[0],
    brand: typeof source.brand === "string" ? source.brand : "",
    year:
      typeof source.year === "number"
        ? source.year
        : Number(source.year) || new Date().getFullYear(),
    material: typeof source.material === "string" ? source.material : "",
    sold: Boolean(source.sold),
    soldAt:
      source.soldAt === null
        ? null
        : typeof source.soldAt === "string" && source.soldAt.trim()
        ? source.soldAt
        : null,
    soldBy:
      source.soldBy === null
        ? null
        : typeof source.soldBy === "string" && source.soldBy.trim()
        ? source.soldBy
        : null,
    createdBy:
      typeof source.createdBy === "string" && source.createdBy.trim()
        ? source.createdBy
        : "unknown",
    updatedBy:
      typeof source.updatedBy === "string" && source.updatedBy.trim()
        ? source.updatedBy
        : "unknown",
    updatedAt:
      typeof source.updatedAt === "string" && source.updatedAt.trim()
        ? source.updatedAt
        : new Date().toISOString(),
    revision: typeof source.revision === "number" && source.revision > 0 ? source.revision : 1,
    auditTrail: Array.isArray(source.auditTrail)
      ? source.auditTrail
          .filter((entry): entry is ItemAuditEntry => !!entry && typeof entry === "object")
          .map((entry) => ({
            ts: typeof entry.ts === "string" ? entry.ts : new Date().toISOString(),
            user: typeof entry.user === "string" ? entry.user : "unknown",
            action: typeof entry.action === "string" ? entry.action : "updated",
            revision:
              typeof entry.revision === "number" && entry.revision > 0
                ? entry.revision
                : 1,
          }))
      : [],
    stockCount: typeof source.stockCount === "number" ? Math.max(0, source.stockCount) : 0,
    stockLimit: typeof source.stockLimit === "number" ? Math.max(0, source.stockLimit) : 10,
    stockUnit: typeof source.stockUnit === "string" ? source.stockUnit : "units",
    stockHistory: Array.isArray(source.stockHistory)
      ? source.stockHistory
          .filter((h): h is { date: string; count: number } => 
            h && typeof h === "object" && typeof (h as any).date === "string" && typeof (h as any).count === "number"
          )
      : [],
  };
}
