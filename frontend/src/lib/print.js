// Opens a plain popup window and sends it to the printer with the given
// HTML body. Kept deliberately simple — no framework, no Tailwind (the
// popup is outside the app's normal render tree) — just inline styles.
// Shared by Billing.jsx (receipts) and Orders.jsx (revised/edit-history
// print view, Stage 7).
//
// Two visual languages live in the same popup CSS on purpose:
//  - `.receipt …` rules (below) style the narrow, thermal-roll-style
//    customer receipt built by Billing.jsx's buildReceiptHtml().
//  - the older unscoped `table`/`.totals`/`.edit-history` rules are
//    untouched and keep styling Orders.jsx's wider "Revised Receipt"
//    audit view (item table + edit history + refunds), which is a
//    different, more tabular document that doesn't fit a 80mm layout.
export function printReceipt(html) {
  const printWindow = window.open('', '', 'width=420,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Receipt</title>
        <style>
          body { font-family: ui-monospace, monospace; padding: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
          .totals { display: flex; justify-content: space-between; font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; }
          .edit-history { margin-top: 16px; padding-top: 8px; border-top: 2px dashed #999; }
          .edit-history h3 { margin: 0 0 6px; font-size: 14px; }
          .edit-history table { font-size: 12px; }

          /* Narrow thermal-roll-style customer receipt (Billing.jsx) */
          .receipt { max-width: 300px; margin: 0 auto; font-size: 12px; line-height: 1.45; }
          .receipt .shop-name { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 0.5px; }
          .receipt .shop-line { text-align: center; }
          .receipt .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          .receipt .sep-solid { border: none; border-top: 2px solid #000; margin: 6px 0; }
          .receipt .meta-row { display: flex; justify-content: space-between; gap: 8px; }
          .receipt .offline-banner { text-align: center; font-weight: 700; color: #b45309; margin: 4px 0; }
          .receipt table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
          .receipt table.items th, .receipt table.items td { border: none; padding: 1px 0; text-align: right; }
          .receipt table.items th:first-child, .receipt table.items td:first-child { text-align: left; }
          .receipt table.items thead th { border-bottom: 1px dashed #000; padding-bottom: 3px; font-weight: bold; }
          .receipt table.items td.item-name { text-align: left; font-weight: 600; padding-top: 4px; }
          .receipt .totals-row { display: flex; justify-content: space-between; }
          .receipt .totals-row.grand { font-weight: bold; font-size: 13px; }
          .receipt .footer { text-align: center; font-weight: bold; margin-top: 8px; }

          @media print {
            @page { margin: 6mm; }
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
}

// Small local formatters so the printed date/time matches the shop's
// existing paper-receipt style (DD-MM-YYYY, 12-hour clock with seconds)
// instead of the browser's locale-dependent default.
function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatReceiptDate(date) {
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatReceiptTime(date) {
  let hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${pad2(hours)}:${minutes}:${seconds} ${ampm}`;
}

// Builds the narrow, thermal-roll-style customer receipt body (the `html`
// passed to printReceipt above) to match the shop's existing paper
// receipt layout: centered shop header, invoice/date/time/customer meta,
// an Item/Retail/Rate/Qty/Total table (Retail = pre-discount unit price,
// Rate = post-discount unit price, so the discount stays visible per
// line the way the old paper receipts show it), a totals block, and a
// thank-you footer.
export function buildReceiptHtml({ shopName, shopAddress, shopPhone, billId, offline, customerName, customerAddress, items, discountLabel, grandTotalLabel, paidLabel, settlementLabel, settlementAmountLabel }) {
  const now = new Date();
  const itemRows = items
    .map(
      (item) => `
        <tr><td class="item-name" colspan="4">${item.itemName}</td></tr>
        <tr><td></td><td>${item.retailLabel}</td><td>${item.rateLabel}</td><td>${item.qty}</td><td>${item.totalLabel}</td></tr>
      `
    )
    .join('');

  return `
    <div class="receipt">
      <div class="shop-name">${shopName}</div>
      <div class="shop-line">${shopAddress}</div>
      <div class="shop-line">Phone: ${shopPhone}</div>
      <hr class="sep-solid" />
      <div class="meta-row"><span>Invoice: ${billId}</span><span>${formatReceiptDate(now)}</span></div>
      <div class="meta-row"><span>Time: ${formatReceiptTime(now)}</span></div>
      <div>Customer Name: ${customerName}</div>
      ${customerAddress ? `<div>Address: ${customerAddress}</div>` : ''}
      ${offline ? '<div class="offline-banner">OFFLINE — PENDING SYNC (not yet confirmed)</div>' : ''}
      <hr class="sep" />
      <table class="items">
        <thead><tr><th>Item</th><th>Retail</th><th>Rate</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr class="sep" />
      ${discountLabel ? `<div class="totals-row"><span>Discount</span><span>-${discountLabel}</span></div>` : ''}
      <div class="totals-row grand"><span>Grand Total</span><span>${grandTotalLabel}</span></div>
      <div class="totals-row"><span>Paid</span><span>${paidLabel}</span></div>
      <div class="totals-row"><span>${settlementLabel}</span><span>${settlementAmountLabel}</span></div>
      <hr class="sep-solid" />
      <div class="footer">THANK YOU! VISIT AGAIN</div>
    </div>
  `;
}