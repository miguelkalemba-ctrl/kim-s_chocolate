import { describe, expect, it } from "vitest";
import { buildInvoiceDocumentHtml } from "../lib/invoice";

describe("buildInvoiceDocumentHtml", () => {
  it("renders invoice html with item and company data", () => {
    const html = buildInvoiceDocumentHtml(
      [
        {
          code: "KWT-0042",
          dateAdded: "2026-02-26",
          name: "Vintage Lamp",
          category: "Decor",
          condition: "Good",
          location: "Shop Floor",
          width: 25,
          height: 50,
          depth: 25,
          price: 65,
        },
      ],
      {
        companyName: "Kim's Chocolate",
        companyAddress: "Leuvensesteenweg 12, 3300 Tienen",
        companyEmail: "info@kimschocolate.be",
        companyPhone: "+32 11 123 456",
        companyVAT: "BE 0123.456.789",
        invoiceLogoUrl: "",
        invoiceBankAccount: "123-4567890-12",
        invoiceIban: "BE68539007547034",
        invoiceBic: "KREDBEBB",
        invoicePaymentTerms: "14 days",
        invoiceFooterNote: "Thank you",
      }
    );

    expect(html).toContain("INVOICE");
    expect(html).toContain("KWT-0042");
    expect(html).toContain("Vintage Lamp");
    expect(html).toContain("Kim's Chocolate");
    expect(html).toContain("Payment Details");
  });
});
