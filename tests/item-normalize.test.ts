import { describe, expect, it } from "vitest";
import { normalizeItem } from "../lib/itemNormalize";

describe("normalizeItem", () => {
  const repairFactory = () => [
    { name: "Intake", done: true },
    { name: "Repair", done: false, state: "none" as const },
  ];

  it("returns null for invalid input", () => {
    expect(normalizeItem(null, repairFactory)).toBeNull();
  });

  it("normalizes partial item data with defaults", () => {
    const item = normalizeItem(
      {
        id: "KMC-9999",
        code: "KMC-9999",
        name: "Test",
        category: "Furniture",
      },
      repairFactory
    );

    expect(item).not.toBeNull();
    expect(item?.id).toBe("KMC-9999");
    expect(item?.condition).toBe("Good");
    expect(item?.repairs.length).toBe(2);
    expect(item?.createdBy).toBe("unknown");
  });
});
