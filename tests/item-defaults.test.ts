import { describe, expect, it } from "vitest";
import { getNextCounterFromItems, normalizeSettings } from "../lib/itemDefaults";

describe("itemDefaults helpers", () => {
  it("normalizes settings with boolean defaults", () => {
    const defaults = {
      companyName: "A",
      confirmBeforeDelete: true,
      autoOpenActivityLog: true,
    };

    const result = normalizeSettings(
      {
        companyName: "B",
        confirmBeforeDelete: false,
        autoOpenActivityLog: "invalid",
      },
      defaults
    );

    expect(result.companyName).toBe("B");
    expect(result.confirmBeforeDelete).toBe(false);
    expect(result.autoOpenActivityLog).toBe(true);
  });

  it("computes next counter from KWT codes", () => {
    const result = getNextCounterFromItems([
      { code: "KMC-0007" },
      { code: "KMC-0042" },
      { code: "INVALID" },
    ]);

    expect(result).toBe(43);
  });
});
