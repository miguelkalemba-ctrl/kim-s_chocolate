import { describe, expect, it } from "vitest";
import {
  buildCameraCreatePayload,
  buildCameraFallbackName,
  mapConditionTapToCondition,
} from "../lib/cameraCapture";

describe("cameraCapture helpers", () => {
  it("maps condition tap values", () => {
    expect(mapConditionTapToCondition("Good")).toBe("Good");
    expect(mapConditionTapToCondition("OK")).toBe("Fair");
    expect(mapConditionTapToCondition("Poor")).toBe("Poor");
  });

  it("builds neutral fallback name", () => {
    const value = buildCameraFallbackName("Furniture", new Date("2026-02-26T10:05:00"));
    expect(value).toBe("Unnamed item");
  });

  it("builds camera create payload with defaults", () => {
    const payload = buildCameraCreatePayload({
      name: "",
      category: "Electronics",
      price: "120",
      location: "Warehouse A",
      conditionTap: "OK",
      notes: "note",
      brand: "Sony",
      material: "Plastic",
      photos: ["img"],
      year: 2026,
      at: new Date("2026-02-26T09:30:00"),
    });

    expect(payload.category).toBe("Electronics");
    expect(payload.condition).toBe("Fair");
    expect(payload.photos).toHaveLength(1);
    expect(payload.name.length).toBeGreaterThan(0);
  });
});
