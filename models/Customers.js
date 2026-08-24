const mongoose = require('mongoose');

// Sub-schema for customer orders — enriched in Stage 5 with enough of the
// financial shape (totalAmount/amountPaid/balanceDue) that a customer's
// outstanding balance is queryable directly from this document, without
// a join back to Order.
const customerOrderSchema = new mongoose.Schema({
    orderNo: { type: String, required: true },
    orderDate: { type: Date, required: true, default: Date.now },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0, default: 0 },
    // Stage 5 — mirrors Supplier.purchases' creditApplied/creditGenerated.
    // creditApplied: how much of this order was covered by credit the
    // customer already had at checkout. creditGenerated: how much new
    // credit this order's own edit/refund history produced.
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
    // Stage 5 — running store credit this customer is owed from a past
    // refund/edit-down settled as credit instead of cash. Always >= 0.
    // Auto-applied to reduce what's owed on this customer's next order
    // (POST /billing/orderDetails), mirroring Supplier.creditBalance.
    creditBalance: { type: Number, min: 0, default: 0 }
});

// Optional: virtual to get orders sorted by date descending
customerSchema.virtual('sortedOrders').get(function() {
    return this.orders.sort((a, b) => b.orderDate - a.orderDate);
});

// Sum of every order's balanceDue — the customer's total outstanding
// credit, queryable straight off the document (Stage 5 exit criteria).
customerSchema.virtual('totalBalanceDue').get(function() {
    return this.orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0);
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;