// Sequential invoice/order IDs — "INV-0001", "INV-0002", ... counting up
// forever (never truncated past INV-9999 — the digit count just grows).
//
// Mirrors routes/products.js's nextProductId(): a single Counter doc
// (models/Counter.js) incremented atomically via $inc, so two cashiers
// hitting "Preview" at the same instant can never be handed the same
// number — Mongo's atomic update guarantees each caller gets a distinct
// seq. Deliberately not seeded from any existing order's ID: legacy
// orders use the old random "#dddd" format (a different namespace
// entirely — see lib/validators.js's ORDER_ID_RE, which still accepts
// both formats so old records keep validating on re-save), so counting
// starts fresh at INV-0001 rather than trying to parse/continue from
// them.
const Counter = require('../models/Counter');

async function nextInvoiceId(session) {
  const opts = session ? { session } : {};

  let counter = await Counter.findById('invoiceId', null, opts);

  if (!counter) {
    counter = await Counter.findOneAndUpdate(
      { _id: 'invoiceId' },
      { $setOnInsert: { seq: 0 } },
      { new: true, upsert: true, ...opts }
    );
  }

  const updated = await Counter.findOneAndUpdate(
    { _id: 'invoiceId' },
    { $inc: { seq: 1 } },
    { new: true, ...opts }
  );

  return `INV-${String(updated.seq).padStart(4, '0')}`;
}

module.exports = { nextInvoiceId };
