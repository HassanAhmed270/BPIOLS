// Stage 3 — split out of main.js verbatim, no logic changes.
const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Refund = require('../models/Refunds');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../lib/errors');
const { roundMoney } = require('../lib/money');
const { deriveCostSource, restoreConsumption } = require('../lib/costing');
const { escapeRegex, parsePagination, sortAndPaginate } = require('../lib/query');
const { getDashboardSummary } = require('../lib/reports');
const { logAudit } = require('../lib/auditLog');
const { isValidOrderId, isValidDiscount } = require('../lib/validators');

const router = express.Router();

// How long after orderDate an admin can still edit an order's line items
// (Stage 7). Refunds are NOT subject to this window — only edits are.
const ORDER_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

// ── Dashboard summary (Stage 9/12) — kept alongside orders since it
// reads order data via lib/reports.js's getDashboardSummary. No
// dedicated dashboard route file was called for in production.md's
// Stage 3 file list, and this is the closest domain fit — flagged in
// production-progress.md.


router.get('/dashboard/load', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { range = 'month' } = req.query;
  const result = await getDashboardSummary(range);
  res.json({ success: true, dashboard: result });
}));

router.get('/api/orders', requireAuth, asyncHandler(async (req, res) => {
  const { search = '', sortBy = 'orderDate', sortDir = 'desc' } = req.query;
  const { page, limit } = parsePagination(req.query);

  const filter = search
    ? {
        $or: [
          { orderID: { $regex: escapeRegex(search), $options: 'i' } },
          { customerName: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      }
    : {};

  const data = await Order.find(filter);
  const mapped = data.map((o) => {
    const avgPayment =
      o.payments && o.payments.length > 0
        ? roundMoney(o.payments.reduce((sum, p) => sum + p.amount, 0) / o.payments.length)
        : 0;
    return {
      _id: o._id,
      orderID: o.orderID,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      balanceDue: o.balanceDue,
      paymentStatus: o.paymentStatus,
      status: o.status,
      displayStatus: o.status === 'refunded' ? 'refunded' : o.paymentStatus,
      avgPayment,
      cashier: o.cashier,
      orderDate: o.orderDate,
      products: o.products,
      editHistory: o.editHistory,
    };
  });

  const { data: orders, total } = sortAndPaginate(mapped, { sortBy, sortDir, page, limit });
  res.json({ success: true, orders, total, page, limit });
}));

router.get('/api/orders/:orderID', requireAuth, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderID: req.params.orderID });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  const refunds = await Refund.find({ orderID: req.params.orderID }).sort({ refundDate: -1 });
  res.json({ success: true, order, refunds });
}));

// ── Admin bill editing & refunds (Stage 7) ──────────────────
// Edit and refund share the same core operation — reduce/remove a line
// item, restore the matching stock atomically, log an audit entry, and
// recompute the order's totals from what's left. Refunds additionally
// write a Refund record and permanently mark the order 'refunded'; edits
// don't, and are time-boxed to ORDER_EDIT_WINDOW_MS. Both are
// requireAdmin — this is the first real use of that middleware beyond
// the manual stock-correction route from Stage 3.

function recomputeOrderTotals(order) {
  order.totalAmount = roundMoney(order.products.reduce((sum, p) => sum + p.amount, 0));
  order.balanceDue = roundMoney(Math.max(0, order.totalAmount - order.amountPaid));
  order.paymentStatus = order.amountPaid <= 0 ? 'unpaid' : order.balanceDue > 0 ? 'partial' : 'paid';
}

// Reduces (or removes, if newQty === 0) one line item's quantity,
// proportionally recomputing its $ amount from what that line was
// *actually sold at* (not today's price — an edit/refund reflects the
// original sale), restores the freed stock atomically, and appends one
// editHistory entry. Returns the quantity restored to stock.
async function applyLineReduction(order, productID, newQty, reason, action, editedBy, session) {
  const line = order.products.find((p) => p.productID === productID);
  if (!line) {
    throw new AppError(400, `Order ${order.orderID} has no line item for ${productID}.`);
  }
  if (!Number.isInteger(newQty) || newQty < 0 || newQty > line.quantity) {
    throw new AppError(400, `Invalid new quantity for ${productID}.`);
  }
  if (newQty === line.quantity) {
    return 0; // nothing changed — don't log a no-op
  }

  const originalQty = line.quantity;
  const restoreQty = originalQty - newQty;
  const unitNetPrice = originalQty > 0 ? line.amount / originalQty : 0;
  const unitDiscountAmount = originalQty > 0 ? (line.discountAmount || 0) / originalQty : 0;

  // Stage 22: give back exactly the batch stock (and cost basis) this
  // reduction undoes, before the line's own fields are mutated below —
  // restoreConsumption needs the line's *original* quantity/consumption
  // to know which batches to credit. This keeps the batches usable for a
  // later sale and keeps the dashboard's profit figure from
  // double-counting a line that's been edited down or refunded.
  const { remainingConsumption, costRestored, knownQtyRestored } = await restoreConsumption(
    line.batchConsumption,
    originalQty,
    restoreQty,
    session
  );

  if (newQty === 0) {
    order.products = order.products.filter((p) => p.productID !== productID);
  } else {
    line.quantity = newQty;
    line.amount = roundMoney(unitNetPrice * newQty);
    line.discountAmount = roundMoney(unitDiscountAmount * newQty);
    line.batchConsumption = remainingConsumption;
    line.costAmount = roundMoney(Math.max(0, (line.costAmount || 0) - costRestored));
    line.costQuantity = Math.max(0, (line.costQuantity || 0) - knownQtyRestored);
    line.costSource = deriveCostSource(line.costQuantity, newQty);
  }

  order.editHistory.push({ editedBy, editedAt: new Date(), productID, originalQty, newQty, reason, action });

  const updated = await Product.findOneAndUpdate(
    { productID },
    { $inc: { quantity: restoreQty } },
    { session, new: true }
  );
  if (!updated) {
    throw new AppError(400, `Product ${productID} no longer exists — stock could not be restored.`);
  }

  return restoreQty;
}

router.post('/api/order/:orderID/edit', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { productID, newQty, reason } = req.body;
  const { orderID } = req.params;

  if (!isValidOrderId(orderID)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }
  if (!isValidProductId(productID)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required for every edit.' });
  }
  const qty = parseInt(newQty);
  if (!Number.isInteger(qty) || qty < 0) {
    return res.status(400).json({ success: false, message: 'Invalid new quantity.' });
  }

  const session = await mongoose.startSession();
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderID }).session(session);
      if (!order) {
        throw new AppError(404, 'Order not found.');
      }
      if (order.status === 'refunded') {
        throw new AppError(400, 'This order has already been refunded and can no longer be edited.');
      }
      const ageMs = Date.now() - new Date(order.orderDate).getTime();
      if (ageMs > ORDER_EDIT_WINDOW_MS) {
        throw new AppError(403, 'The 72-hour edit window for this order has expired.');
      }

      const beforeOrder = order.toObject();
      await applyLineReduction(order, productID, qty, reason.trim(), 'edit', req.user.username, session);
      recomputeOrderTotals(order);
      await order.save({ session });

      // Keep the customer's embedded order summary (Stage 5) in sync.
      await Customer.updateOne(
        { customerName: order.customerName, 'orders.orderNo': order.orderID },
        { $set: { 'orders.$.totalAmount': order.totalAmount, 'orders.$.balanceDue': order.balanceDue } },
        { session }
      );

      await logAudit(
        {
          action: 'order.edited',
          actor: { username: req.user.username, role: req.user.role },
          targetType: 'order',
          targetId: order.orderID,
          before: beforeOrder,
          after: order.toObject(),
        },
        session
      );

      updatedOrder = order;
    });
  } finally {
    await session.endSession();
  }

  res.status(200).json({ success: true, message: 'Order updated.', order: updatedOrder });
}));

router.post('/api/order/:orderID/refund', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { items, reason } = req.body;
  const { orderID } = req.params;

  if (!isValidOrderId(orderID)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items selected to refund.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required for every refund.' });
  }
  for (const item of items) {
    if (!isValidProductId(item.productID) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid refund item.' });
    }
  }

  const session = await mongoose.startSession();
  let refund;
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderID }).session(session);
      if (!order) {
        throw new AppError(404, 'Order not found.');
      }
      if (order.status === 'refunded') {
        throw new AppError(400, 'This order has already been refunded.');
      }

      const beforeOrder = order.toObject();
      const refundedItems = [];
      let refundAmount = 0;

      for (const item of items) {
        const line = order.products.find((p) => p.productID === item.productID);
        if (!line) {
          throw new AppError(400, `Order ${orderID} has no line item for ${item.productID}.`);
        }
        if (item.quantity > line.quantity) {
          throw new AppError(400, `Cannot refund more than was ordered for ${item.productID}.`);
        }
        const unitNetPrice = line.quantity > 0 ? line.amount / line.quantity : 0;
        const lineRefundAmount = roundMoney(unitNetPrice * item.quantity);
        refundedItems.push({ productID: item.productID, quantity: item.quantity, amount: lineRefundAmount });
        refundAmount += lineRefundAmount;

        await applyLineReduction(order, item.productID, line.quantity - item.quantity, reason.trim(), 'refund', req.user.username, session);
      }

      refundAmount = roundMoney(refundAmount);
      recomputeOrderTotals(order);

      // Refunding always finalizes the order — no partial-refund status,
      // per spec ("mark order status: refunded, don't delete").
      order.status = 'refunded';
      await order.save({ session });

      const created = await Refund.create(
        [
          {
            orderID,
            customerName: order.customerName,
            refundAmount,
            refundedItems,
            reason: reason.trim(),
            processedBy: req.user.username,
          },
        ],
        { session }
      );
      refund = created[0];

      await Customer.updateOne(
        { customerName: order.customerName, 'orders.orderNo': order.orderID },
        { $set: { 'orders.$.totalAmount': order.totalAmount, 'orders.$.balanceDue': order.balanceDue } },
        { session }
      );

      await logAudit(
        {
          action: 'order.refunded',
          actor: { username: req.user.username, role: req.user.role },
          targetType: 'order',
          targetId: order.orderID,
          before: beforeOrder,
          after: order.toObject(),
        },
        session
      );

      updatedOrder = order;
    });
  } finally {
    await session.endSession();
  }

  res.status(200).json({ success: true, message: 'Refund processed.', refund, order: updatedOrder });
}));

module.exports = router;
