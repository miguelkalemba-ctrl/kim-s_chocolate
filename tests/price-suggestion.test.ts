import { describe, expect, it } from "vitest";
import { getCameraPriceSuggestion } from "../lib/priceSuggestion";

const sampleItems = [
  {
    category: "Furniture",
    condition: "Good" as const,
    brand: "Ikea",
    material: "Wood",
    dateAdded: "2026-02-20",
    price: 120,
  },
  {
    category: "Furniture",
    condition: "Good" as const,
    brand: "Ikea",
    material: "Wood",
    dateAdded: "2026-02-14",
    price: 140,
  },
  {
    category: "Furniture",
    condition: "Fair" as const,
    brand: "Ikea",
    material: "Wood",
    dateAdded: "2025-12-01",
    price: 90,
  },
  {
    category: "Electronics",
    condition: "Good" as const,
    brand: "Sony",
    material: "Plastic",
    dateAdded: "2026-02-10",
    price: 200,
  },
];

describe("getCameraPriceSuggestion", () => {
  it("returns null when no category matches", () => {
    const result = getCameraPriceSuggestion({
      items: sampleItems,
      category: "Clothes",
      condition: "Good",
      brand: "Ikea",
      material: "Wood",
    });

    expect(result).toBeNull();
  });

  it("returns recommendation and range for matching category", () => {
    const result = getCameraPriceSuggestion({
      items: sampleItems,
      category: "Furniture",
      condition: "Good",
      brand: "Ikea",
      material: "Wood",
    });

    expect(result).not.toBeNull();
    expect(result?.rangeMin).toBe(90);
    expect(result?.rangeMax).toBe(140);
    expect(result?.recommended).toBe(120);
    expect(result?.sampleCount).toBe(3);
    expect(result?.reason).toContain("same condition");
  });
});
