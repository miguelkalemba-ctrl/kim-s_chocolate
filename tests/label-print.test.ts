import { describe, expect, it } from "vitest";
import { buildLabelDocumentHtml } from "../lib/labelPrint";

describe("buildLabelDocumentHtml", () => {
  it("renders label fields for provided items", () => {
    const html = buildLabelDocumentHtml([
      {
        code: "KWT-0001",
        dateAdded: "2026-02-26",
        name: "Oak Chair",
        category: "Furniture",
        condition: "Good",
        price: 45,
      },
    ]);

    expect(html).toContain("KWT-0001");
    expect(html).toContain("Oak Chair");
    expect(html).toContain("Furniture");
    expect(html).toContain("Item Labels");
  });
});
