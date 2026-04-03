export type LabelPrintItem = {
  code: string;
  dateAdded: string;
  name: string;
  category: string;
  condition: string;
  price: number;
};

function formatEuro(v: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildLabelCardHtml(item: LabelPrintItem) {
  return `
    <section class="label-card">
      <div class="label-top">
        <div class="label-code">${escapeHtml(item.code)}</div>
        <div class="label-date">${escapeHtml(item.dateAdded)}</div>
      </div>
      <h1 class="label-name">${escapeHtml(item.name)}</h1>
      <div class="label-row"><span>Category</span><strong>${escapeHtml(item.category)}</strong></div>
      <div class="label-row"><span>Condition</span><strong>${escapeHtml(item.condition)}</strong></div>
      <div class="label-row"><span>Price</span><strong>${escapeHtml(formatEuro(item.price))}</strong></div>
    </section>
  `;
}

export function buildLabelDocumentHtml(labelItems: LabelPrintItem[]) {
  const pages = labelItems
    .map((item) => buildLabelCardHtml(item))
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Item Labels</title>
  <style>
    body { margin: 0; background: #f4f4f5; font-family: Arial, sans-serif; padding: 16px; }
    .labels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
    .label-card { background: #fff; border: 1px solid #d4d4d8; border-radius: 8px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
    .label-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .label-code { font-size: 12px; font-weight: 700; color: #111827; }
    .label-date { font-size: 11px; color: #6b7280; }
    .label-name { font-size: 15px; line-height: 1.2; margin: 0 0 8px 0; color: #111827; }
    .label-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 2px 0; color: #374151; }
    .label-row strong { color: #111827; font-weight: 700; }
    @media print {
      body { background: #fff; padding: 6mm; }
      .labels-grid { gap: 6mm; grid-template-columns: repeat(auto-fill, minmax(60mm, 1fr)); }
      .label-card { border-color: #a1a1aa; border-radius: 0; }
    }
  </style>
</head>
<body>
  <main class="labels-grid">${pages}</main>
</body>
</html>`;
}
