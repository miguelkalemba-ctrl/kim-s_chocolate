// Invoice generation utilities
import { jsPDF } from "jspdf";

export interface Item {
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
  condition: string;
  damageDescription: string;
  notes: string;
  dateAdded: string;
  brand: string;
  year: number;
  material: string;
}

export interface InvoiceSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  invoiceTemplate: string;
}

export function formatInvoiceTemplate(
  template: string,
  item: Item,
  companyName: string,
  companyEmail: string,
  companyPhone: string
): string {
  return template
    .replace(/{companyName}/g, companyName)
    .replace(/{companyEmail}/g, companyEmail)
    .replace(/{companyPhone}/g, companyPhone)
    .replace(/{itemName}/g, item.name)
    .replace(/{itemCode}/g, item.code)
    .replace(/{itemPrice}/g, `€${item.price.toFixed(2)}`)
    .replace(/{itemLocation}/g, item.location)
    .replace(/{itemRepairLocation}/g, item.repairLocation)
    .replace(/{itemCondition}/g, item.condition)
    .replace(/{itemDate}/g, item.dateAdded)
    .replace(/{itemCategory}/g, item.category)
    .replace(/{itemBrand}/g, item.brand)
    .replace(/{itemYear}/g, String(item.year))
    .replace(/{itemMaterial}/g, item.material)
    .replace(/{itemDimensions}/g, `${item.width} × ${item.height} × ${item.depth} cm`)
    .replace(/{itemDamage}/g, item.damageDescription)
    .replace(/{itemNotes}/g, item.notes);
}

export function generateInvoicePDF(
  item: Item,
  settings: InvoiceSettings
): jsPDF {
  const doc = new jsPDF();
  const invoiceText = formatInvoiceTemplate(
    settings.invoiceTemplate,
    item,
    settings.companyName,
    settings.companyEmail,
    settings.companyPhone
  );

  // Simple PDF generation with text
  doc.setFontSize(12);
  doc.text(invoiceText, 10, 10);
  
  return doc;
}

export type InvoicePrintItem = {
  code: string;
  dateAdded: string;
  name: string;
  category: string;
  condition: string;
  location: string;
  width: number;
  height: number;
  depth: number;
  price: number;
};

export type InvoicePrintSettings = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyVAT: string;
  invoiceLogoUrl: string;
  invoiceBankAccount: string;
  invoiceIban: string;
  invoiceBic: string;
  invoicePaymentTerms: string;
  invoiceFooterNote: string;
};

function valueOrPlaceholder(value: string, placeholder: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : placeholder;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function buildInvoiceCardHtml(item: InvoicePrintItem, settings: InvoicePrintSettings) {
  const model = {
    companyName: valueOrPlaceholder(settings.companyName, "ADD COMPANY NAME"),
    companyAddress: valueOrPlaceholder(settings.companyAddress, "ADD COMPANY ADDRESS"),
    companyEmail: valueOrPlaceholder(settings.companyEmail, "ADD COMPANY EMAIL"),
    companyPhone: valueOrPlaceholder(settings.companyPhone, "ADD COMPANY PHONE"),
    companyVAT: valueOrPlaceholder(settings.companyVAT, "ADD VAT NUMBER"),
    logoUrl: settings.invoiceLogoUrl.trim(),
    bankAccount: valueOrPlaceholder(settings.invoiceBankAccount, "ADD BANK ACCOUNT"),
    iban: valueOrPlaceholder(settings.invoiceIban, "ADD IBAN"),
    bic: valueOrPlaceholder(settings.invoiceBic, "ADD BIC/SWIFT"),
    paymentTerms: valueOrPlaceholder(settings.invoicePaymentTerms, "ADD PAYMENT TERMS"),
    footerNote: valueOrPlaceholder(settings.invoiceFooterNote, "ADD INVOICE FOOTER NOTE"),
    invoiceNumber: `INV-${item.code}`,
    issueDate: item.dateAdded,
    itemName: item.name,
    itemCode: item.code,
    itemCategory: item.category,
    itemCondition: item.condition,
    itemLocation: item.location,
    itemDimensions: `${item.width} × ${item.height} × ${item.depth} cm`,
    itemPrice: formatEuro(item.price),
  };

  return `
    <section class="invoice-page">
      <header class="invoice-head">
        <div>
          <h1 class="invoice-title">INVOICE</h1>
          <div class="invoice-meta">Invoice # ${escapeHtml(model.invoiceNumber)}</div>
          <div class="invoice-meta">Date: ${escapeHtml(model.issueDate)}</div>
        </div>
        <div class="logo-box">${model.logoUrl ? `<img src="${escapeHtml(model.logoUrl)}" alt="Company Logo" class="logo-img"/>` : "IMAGE / ADD LOGO URL"}</div>
      </header>

      <div class="company-grid">
        <div>
          <h2>From</h2>
          <p>${escapeHtml(model.companyName)}</p>
          <p>${escapeHtml(model.companyAddress)}</p>
          <p>${escapeHtml(model.companyEmail)}</p>
          <p>${escapeHtml(model.companyPhone)}</p>
          <p>VAT: ${escapeHtml(model.companyVAT)}</p>
        </div>
        <div>
          <h2>Bill To</h2>
          <p>ADD CUSTOMER NAME</p>
          <p>ADD CUSTOMER ADDRESS</p>
          <p>ADD CUSTOMER EMAIL</p>
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr><th>Item</th><th>Category</th><th>Condition</th><th>Location</th><th>Dimensions</th><th class="ta-right">Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(model.itemName)}<div class="small">${escapeHtml(model.itemCode)}</div></td>
            <td>${escapeHtml(model.itemCategory)}</td>
            <td>${escapeHtml(model.itemCondition)}</td>
            <td>${escapeHtml(model.itemLocation)}</td>
            <td>${escapeHtml(model.itemDimensions)}</td>
            <td class="ta-right">${escapeHtml(model.itemPrice)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="5" class="ta-right">Total</td><td class="ta-right total">${escapeHtml(model.itemPrice)}</td></tr>
        </tfoot>
      </table>

      <div class="payment-box">
        <h2>Payment Details</h2>
        <p>Bank Account: ${escapeHtml(model.bankAccount)}</p>
        <p>IBAN: ${escapeHtml(model.iban)}</p>
        <p>BIC/SWIFT: ${escapeHtml(model.bic)}</p>
        <p>Payment Terms: ${escapeHtml(model.paymentTerms)}</p>
      </div>

      <footer class="invoice-footer">${escapeHtml(model.footerNote)}</footer>
    </section>
  `;
}

export function buildInvoiceDocumentHtml(
  invoiceItems: InvoicePrintItem[],
  settings: InvoicePrintSettings
) {
  const pages = invoiceItems
    .map((item) => buildInvoiceCardHtml(item, settings))
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice</title>
  <style>
    body { margin: 0; background: #e5e7eb; font-family: Arial, sans-serif; }
    .invoice-page { width: 210mm; min-height: 297mm; box-sizing: border-box; margin: 12mm auto; background: #fff; color: #111827; padding: 14mm; border: 1px solid #d4d4d8; page-break-after: always; }
    .invoice-page:last-child { page-break-after: auto; }
    .invoice-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .invoice-title { margin: 0; font-size: 28px; letter-spacing: 0.04em; }
    .invoice-meta { color: #4b5563; margin-top: 4px; font-size: 12px; }
    .logo-box { width: 160px; height: 88px; border: 1px dashed #9ca3af; color: #6b7280; display: flex; align-items: center; justify-content: center; font-size: 12px; text-align: center; background: #f9fafb; }
    .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .company-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .company-grid h2, .payment-box h2 { margin: 0 0 6px; font-size: 13px; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; }
    .company-grid p, .payment-box p { margin: 3px 0; font-size: 13px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .invoice-table th, .invoice-table td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; vertical-align: top; }
    .invoice-table th { background: #f3f4f6; text-align: left; }
    .small { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .ta-right { text-align: right !important; }
    .total { font-weight: 700; font-size: 13px; }
    .payment-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #fafafa; }
    .invoice-footer { margin-top: 14px; font-size: 12px; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  </style>
</head>
<body>${pages}</body>
</html>`;
}
