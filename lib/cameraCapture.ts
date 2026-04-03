export type CameraConditionTap = "Good" | "OK" | "Poor";
export type CameraCondition = "Excellent" | "Good" | "Fair" | "Poor";

export type CameraCreatePayload = {
  name: string;
  category: string;
  price: number | string;
  location: string;
  repairLocation: string;
  width: number | string;
  height: number | string;
  depth: number | string;
  condition: CameraCondition;
  damageDescription: string;
  notes: string;
  brand: string;
  year: number;
  material: string;
  photos?: string[];
};

export function mapConditionTapToCondition(tap: CameraConditionTap): CameraCondition {
  if (tap === "Good") return "Good";
  if (tap === "OK") return "Fair";
  return "Poor";
}

export function buildCameraFallbackName(category: string, at = new Date()) {
  void category;
  void at;
  return "Unnamed item";
}

export function buildCameraCreatePayload(input: {
  name: string;
  category: string;
  price: number | string;
  location: string;
  conditionTap: CameraConditionTap;
  notes: string;
  brand: string;
  material: string;
  photos: string[];
  year?: number;
  at?: Date;
}): CameraCreatePayload {
  return {
    name: input.name.trim() || buildCameraFallbackName(input.category, input.at),
    category: input.category,
    price: input.price,
    location: input.location,
    repairLocation: "",
    width: "",
    height: "",
    depth: "",
    condition: mapConditionTapToCondition(input.conditionTap),
    damageDescription: "",
    notes: input.notes,
    brand: input.brand,
    year: input.year ?? new Date().getFullYear(),
    material: input.material,
    photos: input.photos,
  };
}
