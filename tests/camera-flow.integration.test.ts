import { describe, expect, it } from "vitest";
import { buildCameraCreatePayload } from "../lib/cameraCapture";
import { createAuditMetadata, getUpdatedAuditMetadata } from "../lib/itemAudit";
import { buildLabelDocumentHtml } from "../lib/labelPrint";
import { buildInvoiceDocumentHtml } from "../lib/invoice";

describe("camera -> create -> print integration", () => {
  it("builds a camera-created item payload and printable docs", () => {
    const payload = buildCameraCreatePayload({
      name: "",
      category: "Furniture",
      price: "99",
      location: "Warehouse A",
      conditionTap: "Good",
      notes: "Captured in intake",
      brand: "Ikea",
      material: "Wood",
      photos: ["data:image/jpeg;base64,abc"],
      year: 2026,
      at: new Date("2026-02-26T10:00:00Z"),
    });

    const createdAudit = createAuditMetadata("alice", "2026-02-26T10:00:00Z");
    const updatedAudit = getUpdatedAuditMetadata(createdAudit, "alice", "printed-label", "2026-02-26T10:01:00Z");

    const label = buildLabelDocumentHtml([
      {
        code: "KMC-0100",
        dateAdded: "2026-02-26",
        name: payload.name,
        category: payload.category,
        condition: payload.condition,
        price: Number(payload.price),
      },
    ]);

    const invoice = buildInvoiceDocumentHtml(
      [
        {
          code: "KMC-0100",
          dateAdded: "2026-02-26",
          name: payload.name,
          category: payload.category,
          condition: payload.condition,
          location: payload.location,
          width: 0,
          height: 0,
          depth: 0,
          price: Number(payload.price),
        },
      ],
      {
        companyName: "Kim's Chocolate",
        companyAddress: "Leuvensesteenweg 12",
        companyEmail: "info@kimschocolate.be",
        companyPhone: "+32 11 123 456",
        companyVAT: "BE 0123.456.789",
        invoiceLogoUrl: "",
        invoiceBankAccount: "123",
        invoiceIban: "BE00",
        invoiceBic: "BIC",
        invoicePaymentTerms: "14 days",
        invoiceFooterNote: "Thanks",
      }
    );

    expect(payload.name).toBe("Unnamed item");
    expect(updatedAudit.revision).toBe(2);
    expect(label).toContain("KMC-0100");
    expect(invoice).toContain("INVOICE");
  });
});
