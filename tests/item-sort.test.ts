import { describe, expect, it } from "vitest";
import { sortItemsSoldLast } from "../lib/itemSort";

type TestItem = {
  id: string;
  name: string;
  sold: boolean;
  dateAdded: string;
  price: number;
  repairs?: Array<{
    name: string;
    done: boolean;
    state?: "none" | "noNeed" | "inProgress" | "repaired" | "sold";
  }>;
  updatedAt?: string;
  auditTrail?: Array<{
    ts: string;
    action: string;
  }>;
};

const items: TestItem[] = [
  {
    id: "1",
    name: "Beta",
    sold: false,
    dateAdded: "2026-02-11",
    price: 100,
    repairs: [
      { name: "Intake", done: true },
      { name: "Check", done: true },
      { name: "Repair", done: true, state: "noNeed" },
      { name: "Quality Control", done: false },
      { name: "Ready for Sale", done: false },
    ],
  },
  {
    id: "2",
    name: "Alpha",
    sold: true,
    dateAdded: "2026-02-13",
    price: 50,
    auditTrail: [{ ts: "2026-02-14T10:00:00.000Z", action: "marked-sold" }],
  },
  {
    id: "3",
    name: "Gamma",
    sold: false,
    dateAdded: "2026-02-12",
    price: 75,
    repairs: [
      { name: "Intake", done: true },
      { name: "Check", done: true },
      { name: "Repair", done: true, state: "repaired" },
      { name: "Quality Control", done: true },
      { name: "Ready for Sale", done: true },
    ],
  },
  {
    id: "5",
    name: "Epsilon",
    sold: false,
    dateAdded: "2026-02-14",
    price: 95,
    repairs: [
      { name: "Intake", done: true },
      { name: "Check", done: true },
      { name: "Repair", done: true, state: "repaired" },
      { name: "Quality Control", done: true },
      { name: "Ready for Sale", done: true },
    ],
  },
  {
    id: "4",
    name: "Delta",
    sold: true,
    dateAdded: "2026-02-10",
    price: 125,
    auditTrail: [{ ts: "2026-02-11T10:00:00.000Z", action: "marked-sold" }],
  },
];

describe("sortItemsSoldLast", () => {
  it("defaults to ready-for-sale newest-added, then normal newest-added, then sold newest-sold", () => {
    const sorted = sortItemsSoldLast(items, "", "asc");
    expect(sorted.map((item) => item.id)).toEqual(["5", "3", "1", "2", "4"]);
    expect(sorted.slice(0, 2).every((item) => !item.sold && item.repairs?.some((s) => s.name === "Ready for Sale" && s.done))).toBe(true);
    expect(sorted[2].sold).toBe(false);
    expect(sorted.slice(3).every((item) => item.sold)).toBe(true);
  });

  it("keeps sold items at the bottom when sorting by price", () => {
    const sorted = sortItemsSoldLast(items, "price", "asc");
    expect(sorted.slice(0, 2).every((item) => !item.sold && item.repairs?.some((s) => s.name === "Ready for Sale" && s.done))).toBe(true);
    expect(sorted[2].sold).toBe(false);
    expect(sorted.slice(3).every((item) => item.sold)).toBe(true);
  });

  it("sorts dateAdded descending within active and sold groups", () => {
    const sorted = sortItemsSoldLast(items, "dateAdded", "desc");
    const ready = sorted.filter((item) => !item.sold && item.repairs?.some((s) => s.name === "Ready for Sale" && s.done));
    const normal = sorted.filter((item) => !item.sold && !item.repairs?.some((s) => s.name === "Ready for Sale" && s.done));
    const sold = sorted.filter((item) => item.sold);

    expect(ready.map((item) => item.id)).toEqual(["5", "3"]);
    expect(normal.map((item) => item.id)).toEqual(["1"]);
    expect(sold.map((item) => item.id)).toEqual(["2", "4"]);
  });

  it("sort by status respects ready-normal-sold hierarchy", () => {
    const sorted = sortItemsSoldLast(items, "status", "desc");
    expect(sorted.map((item) => item.id)).toEqual(["5", "3", "1", "2", "4"]);
    expect(sorted.slice(0, 2).every((item) => !item.sold && item.repairs?.some((s) => s.name === "Ready for Sale" && s.done))).toBe(true);
    expect(sorted[2].id).toBe("1");
    expect(sorted.slice(3).every((item) => item.sold)).toBe(true);
  });
});
