const mongoose = require('mongoose');
const { roundMoney } = require('../lib/money');

// Sub-schema for customer orders — enriched in Stage 5 with enough of the
// financial shape (totalAmount/amountPaid/balanceDue) that a specific
// order's own payment history is queryable directly from this document,
// without a join back to Order. These fields are a point-in-time,
// per-order historical record only (what THIS order still owed, as of
// its last edit/refund) — they are display/receipt data, not the
// customer's current standing. See accountBalance below for that.
const customerOrderSchema = new mongoose.Schema({
    orderNo: { type: String, required: true },
    orderDate: { type: Date, required: true, default: Date.now },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0, default: 0 },
    // Stage 5 — mirrors Supplier.purchases' creditApplied/creditGenerated.
    // creditApplied: how much of this order was covered by credit the
    // customer already had at checkout. creditGenerated: how much new
    // credit this order's own edit/refund history produced. Both purely
    // informational (receipt display) — see accountBalance below for the
    // customer's actual current standing.
    creditApplied: { type: Number, min: 0, default: 0 },
    creditGenerated: { type: Number, min: 0, default: 0 }
}, { _id: false }); // disable _id for subdocuments if not needed

const customerSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        unique: true,
        set: value => value.trim().replace(/\s+/g, ' ')
    },
    mobileNo: {
        type: String,
        required: false,
        set: value => value ? value.trim() : ''
    },
    emergencyMobile: {
        type: String,
        required: false,
        set: value => value ? value.trim() : ''
    },
    email: {
        type: String,
        required: false,
        set: value => value ? value.trim() : ''
    },
    address: {
        type: String,
        required: false,
        set: value => value ? value.trim() : ''
    },
    orders: [customerOrderSchema], // Array of orders, one entry per order placed
    // Single running ledger for this customer's standing with the
    // business: positive = the customer currently owes us this much;
    // negative = we owe the customer this much (store credit); zero =
    // settled. This replaced two separately-maintained numbers
    // (creditBalance, and a totalBalanceDue computed by summing every
    // order's own balanceDue) that could never be reconciled against each
    // other — a refund/overpayment that generated credit had no way to
    // pay down a balance sitting on a *different* order, and the two
    // figures were shown side by side as if unrelated. Every checkout,
    // edit, and refund now applies a signed delta to this one field
    // (see lib/customerAccount.js's applyCustomerAccountDelta — the only
    // place this field is ever written) instead of touching two separate
    // buckets, so it can't drift out of sync with itself by definition.
    accountBalance: { type: Number, default: 0 }
});

// Optional: virtual to get orders sorted by date descending
customerSchema.virtual('sortedOrders').get(function() {
    return this.orders.sort((a, b) => b.orderDate - a.orderDate);
});

// totalBalanceDue / creditBalance are the two non-negative "faces" of the
// single accountBalance number above — read-only views for existing
// callers/display code that still expect a separate "how much do they
// owe" vs. "how much credit do they have" figure (e.g. Suppliers.jsx's
// identical net-balance pattern, which this now mirrors). Because both
// are *derived* from accountBalance rather than stored independently,
// they can never disagree with each other or with accountBalance itself.
customerSchema.virtual('totalBalanceDue').get(function() {
    return Math.max(0, roundMoney(this.accountBalance || 0));
});
customerSchema.virtual('creditBalance').get(function() {
    return Math.max(0, roundMoney(-(this.accountBalance || 0)));
});

customerSchema.set('toObject', { virtuals: true });
customerSchema.set('toJSON', { virtuals: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
