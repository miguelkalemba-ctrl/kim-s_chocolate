import type { Item } from "@/lib/types";

export type ItemInput = Partial<Item> & {
  name?: string;
  category?: string;
};

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function validateItemInput(input: unknown): { ok: true; value: ItemInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid payload" };
  const value = input as ItemInput;

  if (!value.name || !value.name.trim()) return { ok: false, error: "Item name is required" };
  if (!value.category || !value.category.trim()) return { ok: false, error: "Item category is required" };

  return {
    ok: true,
    value: {
      ...value,
      name: value.name.trim(),
      category: value.category.trim(),
      price: asNumber(value.price),
      width: asNumber(value.width),
      height: asNumber(value.height),
      depth: asNumber(value.depth),
      year: asNumber(value.year, new Date().getFullYear()),
    },
  };
}
