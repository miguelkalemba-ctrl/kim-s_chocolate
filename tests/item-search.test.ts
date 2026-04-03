import { describe, expect, it } from "vitest";
import {
  getHighlightedParts,
  getItemSuggestionLines,
  getSearchTerms,
  itemMatchesSearch,
} from "../lib/itemSearch";

const baseItem = {
  name: "Oak Dining Table",
  code: "KMC-0101",
  category: "Furniture",
  location: "Warehouse A",
  repairLocation: "Workshop",
  condition: "Good",
  damageDescription: "Minor scratches",
  notes: "Solid wood",
  dateAdded: "2026-02-10",
  brand: "Vintage",
  material: "Wood",
  year: 2022,
  price: 199,
  width: 140,
  height: 75,
  depth: 80,
};

describe("itemSearch", () => {
  it("extracts lowercase search terms", () => {
    expect(getSearchTerms("  Oak   2026  ")).toEqual(["oak", "2026"]);
  });

  it("matches by text fields", () => {
    expect(itemMatchesSearch(baseItem, "oak")).toBe(true);
    expect(itemMatchesSearch(baseItem, "warehouse")).toBe(true);
    expect(itemMatchesSearch(baseItem, "furniture")).toBe(true);
  });

  it("matches by numeric/date-like text", () => {
    expect(itemMatchesSearch(baseItem, "199")).toBe(true);
    expect(itemMatchesSearch(baseItem, "2026-02")).toBe(true);
    expect(itemMatchesSearch(baseItem, "140x75x80")).toBe(true);
  });

  it("returns false when no term matches", () => {
    expect(itemMatchesSearch(baseItem, "sofa")).toBe(false);
  });

  it("returns matching suggestion lines", () => {
    const lines = getItemSuggestionLines(baseItem, "warehouse 199", (value) => `€${value}`);
    expect(lines.some((line) => line.label === "Location")).toBe(true);
    expect(lines.some((line) => line.label === "Price")).toBe(true);
  });

  it("splits highlighted parts for matching terms", () => {
    const parts = getHighlightedParts("Oak Dining Table", "oak table");
    expect(parts.some((part) => part.isMatch && part.text.toLowerCase() === "oak")).toBe(true);
    expect(parts.some((part) => part.isMatch && part.text.toLowerCase() === "table")).toBe(true);
  });
});
