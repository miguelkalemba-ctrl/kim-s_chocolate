import type { ItemAuditEntry } from "@/lib/itemAudit";

export type DemoRepairStep = {
  name: string;
  done: boolean;
  state?: "none" | "noNeed" | "inProgress" | "repaired" | "sold";
};

export type DemoItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  location: string;
  repairLocation: string;
  width: number;
  height: number;
  depth: number;
  repairs: DemoRepairStep[];
  photos: string[];
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  damageDescription: string;
  notes: string;
  dateAdded: string;
  brand: string;
  year: number;
  material: string;
  sold: boolean;
  soldAt?: string | null;
  soldBy?: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
  auditTrail: ItemAuditEntry[];
  stockCount: number;
  stockLimit: number;
  stockUnit: string;
  stockHistory: Array<{ date: string; count: number }>;
};

export function createDemoItems(purchaseStatusFactory: () => DemoRepairStep[]): DemoItem[] {
  const packingMaterials = [
    // Containers - Primary Packaging
    "Cardboard Gift Boxes - Small (8x8x3cm) - Guylian Style",
    "Cardboard Gift Boxes - Medium (12x12x4cm) - Côte d'Or Style",
    "Cardboard Gift Boxes - Large (16x16x6cm) - Premium Collection",
    "Cardboard Gift Boxes - Heart Shaped (14x14x4cm) - Valentine's Special",
    "Cardboard Gift Boxes - Round (12cm diameter x 5cm) - Ballotin Style",
    "Plastic Window Boxes - Clear Lid (10x10x8cm) - Display Ready",
    "Plastic Window Boxes - Hinged (15x10x6cm) - Reusable",
    "Metal Tins - Round (8cm diameter x 4cm) - Classic Design",
    "Metal Tins - Square (10x10x5cm) - Modern Look",
    "Metal Tins - Heart Shaped (12x12x4cm) - Special Occasions",

    // Sealing Materials
    "Aluminum Foil Rolls (300m x 30cm) - Food Grade",
    "Plastic Wrap Rolls (500m x 40cm) - PVC Free",
    "Heat Seal Film Rolls (200m x 50cm) - Barrier Properties",
    "Shrink Wrap Film (100m x 60cm) - High Clarity",
    "Adhesive Tape - Clear (50mm x 66m) - Food Safe",
    "Adhesive Tape - Brown (50mm x 66m) - Kraft Paper",
    "Hot Melt Glue Sticks (11mm x 200mm) - Food Contact Approved",
    "Sealing Wax - Red (500g) - Traditional Finish",
    "Sealing Wax - Gold (500g) - Premium Look",

    // Labels and Branding
    "Self-Adhesive Labels (50x30mm) - Ingredient Declaration",
    "Self-Adhesive Labels (80x50mm) - Brand Logo",
    "Self-Adhesive Labels (40x20mm) - Best Before Date",
    "Self-Adhesive Labels (60x40mm) - Batch Number",
    "Holographic Stickers (25mm diameter) - Security Seals",
    "Tamper-Evident Seals (20x15mm) - Pull Tab",
    "Barcode Labels (30x20mm) - EAN-13 Format",
    "QR Code Labels (25x25mm) - Digital Integration",

    // Protection and Padding
    "Bubble Wrap Sheets (50x100cm x 5mm) - Anti-Static",
    "Foam Padding Sheets (40x60cm x 2mm) - Recyclable",
    "Corrugated Cardboard Sheets (100x70cm) - Double Wall",
    "Void Fill Peanuts (25L bags) - Biodegradable",
    "Air Pillows (20x30cm) - Inflatable Protection",
    "Corner Protectors (5x5x80cm) - Cardboard",
    "Edge Protectors (2x2x100cm) - Plastic",
    "Tissue Paper Sheets (50x70cm) - Colored Assortment",

    // Specialty Chocolate Packaging
    "Chocolate Bar Wrappers (20x10cm) - Aluminum Lined",
    "Praline Cups (4cm diameter) - Paper Based",
    "Box Liners - Wax Paper (25x35cm) - Grease Resistant",
    "Box Liners - Aluminum Foil (20x30cm) - Light Barrier",
    "Ribbon Rolls - Satin (10mm x 100m) - Gold",
    "Ribbon Rolls - Grosgrain (15mm x 100m) - Red",
    "Ribbon Rolls - Organza (20mm x 50m) - Silver",
    "Gift Tags (5x3cm) - Cardstock with String",
    "Cellophane Bags (15x20cm) - Clear with Header",
    "Organza Bags (10x15cm) - Drawstring Closure",

    // Shipping and Transport
    "Shipping Boxes - Single Wall (30x20x15cm)",
    "Shipping Boxes - Double Wall (40x30x25cm)",
    "Pallet Wrap Film (500m x 50cm) - Stretch Film",
    "Plastic Strapping Bands (12mm x 1000m) - PP Material",
    "Steel Strapping Bands (12mm x 100m) - High Tension",
    "Shipping Labels (10x15cm) - Weather Resistant",
    "Fragile Warning Stickers (7x5cm) - International Symbols",
    "Address Labels (8x4cm) - Self-Adhesive",

    // Sustainable/Eco-Friendly Options
    "Recycled Cardboard Boxes (25x15x10cm) - FSC Certified",
    "Biodegradable Wrap (100m x 30cm) - Plant-Based",
    "Compostable Bags (20x25cm) - Corn Starch Based",
    "Recycled Tissue Paper (50x70cm) - Mixed Colors",
    "Bamboo Fiber Wrap (50m x 40cm) - Sustainable Source",
  ];

  return Array.from({ length: 50 }).map((_, i) => {
    const code = `KMC-${String(i + 1).padStart(4, "0")}`;
    const conditions: Array<"Excellent" | "Good" | "Fair" | "Poor"> = [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
    ];
    const suppliers = [
      "Amcor Belgium", "Huhtamaki Belgium", "Smurfit Kappa", "DS Smith Packaging",
      "Mondi Group", "Tetra Pak", "SIG Combibloc", "Crown Holdings",
      "Ball Corporation", "Ardagh Group", "Rexam", "WestRock",
      "International Paper", "Stora Enso", "UPM", "Billerud",
      "Mayr-Melnhof", "Ahlstrom", "Metsä Board", "Klabin",
      "Belgian Packaging Co", "Packaging Solutions BE", "Flemish Pack",
      "Brussels Wrap & Seal", "Antwerp Box Makers"
    ];
    const locations = ["Warehouse A", "Storage Room B", "Production Line 1", "Quality Control"];
    const itemDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Determine category based on material type
    const materialName = packingMaterials[i % packingMaterials.length];
    let category = "Packaging";
    if (materialName.includes("Box") || materialName.includes("Tin") || materialName.includes("Bag") || materialName.includes("Cup")) {
      category = "Containers";
    } else if (materialName.includes("Tape") || materialName.includes("Wrap") || materialName.includes("Seal") || materialName.includes("Glue") || materialName.includes("Wax")) {
      category = "Sealing";
    } else if (materialName.includes("Label") || materialName.includes("Sticker") || materialName.includes("Tag")) {
      category = "Labels";
    } else if (materialName.includes("Foam") || materialName.includes("Bubble") || materialName.includes("Padding") || materialName.includes("Protector") || materialName.includes("Pillow")) {
      category = "Protection";
    } else if (materialName.includes("Shipping") || materialName.includes("Strapping") || materialName.includes("Pallet")) {
      category = "Transport";
    }

    return {
      id: code,
      code,
      name: materialName,
      category,
      price: Math.round((0.5 + Math.random() * 25) * 100) / 100, // €0.50 to €25 range
      location: locations[i % locations.length],
      repairLocation: "N/A", // Not applicable for packing materials
      width: 10 + (i % 30),
      height: 5 + (i % 20),
      depth: 2 + (i % 10),
      repairs: purchaseStatusFactory(),
      photos: [],
      condition: conditions[i % conditions.length],
      damageDescription: i % 8 === 0 ? "Slight wear on edges" : "None",
      notes: i % 6 === 0 ? "Bulk purchase discount applied" : "Standard stock item",
      dateAdded: itemDate,
      brand: suppliers[i % suppliers.length],
      year: 2023 + (i % 2), // Recent purchases
      material: materialName.includes("Plastic") || materialName.includes("PVC") ? "Plastic" :
                materialName.includes("Cardboard") || materialName.includes("Paper") || materialName.includes("Tissue") ? "Paper/Cardboard" :
                materialName.includes("Aluminum") || materialName.includes("Metal") || materialName.includes("Tin") ? "Metal" :
                materialName.includes("Foam") || materialName.includes("Bubble") ? "Foam/Plastic" :
                materialName.includes("Ribbon") || materialName.includes("Organza") ? "Fabric" :
                materialName.includes("Cellophane") ? "Cellophane" :
                materialName.includes("Bamboo") ? "Natural Fiber" :
                materialName.includes("Biodegradable") || materialName.includes("Compostable") ? "Bio-based" : "Mixed Materials",
      sold: false, // Packing materials aren't "sold" in the traditional sense
      soldAt: null,
      soldBy: null,
      createdBy: "system",
      updatedBy: "system",
      updatedAt: itemDate,
      revision: 1,
      auditTrail: [
        {
          ts: itemDate,
          user: "system",
          action: "created",
          revision: 1,
        },
      ],
      stockCount: Math.floor(20 + Math.random() * 200),
      stockLimit: Math.floor(10 + Math.random() * 30),
      stockUnit: ["units", "boxes", "pallets", "rolls", "sheets"][Math.floor(Math.random() * 5)],
      stockHistory: Array.from({ length: 15 }, (_, dayIdx) => {
        const historyDate = new Date(Date.now() - (14 - dayIdx) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const baseCount = Math.floor(20 + Math.random() * 200);
        return {
          date: historyDate,
          count: Math.max(0, baseCount + Math.floor((Math.random() - 0.5) * 50)),
        };
      }),
    };
  });
}
