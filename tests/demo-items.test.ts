import { describe, expect, it } from "vitest";
import { createDemoItems } from "../lib/demoItems";

describe("createDemoItems", () => {
  it("creates a demo dataset with consistent metadata", () => {
    const repairFactory = () => [
      { name: "Intake", done: true },
      { name: "Repair", done: false, state: "none" as const },
    ];

    const items = createDemoItems(repairFactory);

    expect(items.length).toBe(50);
    expect(items[0].code).toBe("KMC-0001");
    expect(items[0].repairs.length).toBe(2);
    expect(items[0].createdBy).toBe("system");
    expect(items[0].auditTrail[0].action).toBe("created");
  });
});
