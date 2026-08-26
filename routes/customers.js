// Stage 3 — split out of main.js verbatim, no logic changes.
const express = require('express');
const Customer = require('../models/Customers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex, parsePagination, sortAndPaginate } = require('../lib/query');
const { roundMoney } = require('../lib/money');
const { logAudit } = require('../lib/auditLog');
const { isValidEmail, isValidPhone } = require('../lib/validators');

const router = express.Router();


router.get('/api/customers', requireAuth, asyncHandler(async (req, res) => {
  const { search = '', sortBy = 'customerName', sortDir = 'asc' } = req.query;
  const { page, limit } = parsePagination(req.query);

  const filter = search
    ? {
        $or: [
          { customerName: { $regex: escapeRegex(search), $options: 'i' } },
          { mobileNo: { $regex: escapeRegex(search), $options: 'i' } },
          { email: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      }
    : {};

  const data = await Customer.find(filter, 'customerName mobileNo emergencyMobile email address orders creditBalance');
  const mapped = data.map((c) => ({
    _id: c._id,
    customerName: c.customerName,
    mobileNo: c.mobileNo,
    emergencyMobile: c.emergencyMobile,
    email: c.email,
    address: c.address,
    orders: c.orders,
    totalBalanceDue: roundMoney(c.orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0)),
    // Stage 5 — scope extended from routes/customers.js (not listed in
    // production.md's Stage 5 Affected areas) so the store-credit ledger
    // is actually visible somewhere in the app, mirroring Suppliers.jsx.
    creditBalance: roundMoney(c.creditBalance || 0),
  }));

  const { data: customers, total } = sortAndPaginate(mapped, { sortBy, sortDir, page, limit });
  res.json({ success: true, customers, total, page, limit });
}));

// Stage 14 — upsert-style creation, distinct from updateCustomer (which
// 404s if the customer doesn't exist). Needed so a walk-in order can be
// converted to a real customer inline during an exchange without a
// separate "create customer first" round trip elsewhere in the app.
// If a customer with this name already exists, it's returned as-is
// (existing details are never silently overwritten here).
router.post('/customer/create', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  let { customerName, mobileNo, emergencyMobile, email, address } = req.body;

  if (!customerName || customerName.trim() === '') {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  customerName = customerName.trim().replace(/\s+/g, ' ');
  mobileNo = mobileNo ? mobileNo.trim() : '';
  emergencyMobile = emergencyMobile ? emergencyMobile.trim() : '';
  email = email ? email.trim() : '';
  address = address ? address.trim() : '';

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'That email address doesn\'t look right.' });
  }
  if (!isValidPhone(mobileNo) || !isValidPhone(emergencyMobile)) {
    return res.status(400).json({ success: false, message: 'That phone number doesn\'t look right.' });
  }

  let customer = await Customer.findOne({ customerName });
  let created = false;
  if (!customer) {
    customer = await Customer.create({ customerName, mobileNo, emergencyMobile, email, address });
    created = true;
    await logAudit({
      action: 'customer.created',
      actor: { username: req.user.username, role: req.user.role },
      targetType: 'customer',
      targetId: customerName,
      before: null,
      after: customer.toObject(),
    });
  }

  res.status(created ? 201 : 200).json({ success: true, created, customer });
}));

router.post('/customer/updateCustomer', requireAuth, asyncHandler(async (req, res) => {
  let { customerName, mobileNo, emergencyMobile, email, address } = req.body;

  if (!customerName || customerName.trim() === '') {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  customerName = customerName.trim().replace(/\s+/g, ' ');
  mobileNo = mobileNo ? mobileNo.trim() : '';
  emergencyMobile = emergencyMobile ? emergencyMobile.trim() : '';
  email = email ? email.trim() : '';
  address = address ? address.trim() : '';

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'That email address doesn\'t look right.' });
  }
  if (!isValidPhone(mobileNo) || !isValidPhone(emergencyMobile)) {
    return res.status(400).json({ success: false, message: 'That phone number doesn\'t look right.' });
  }

  const beforeCustomer = await Customer.findOne({ customerName });
  const updatedCustomer = await Customer.findOneAndUpdate(
    { customerName },
    { $set: { mobileNo, emergencyMobile, email, address } },
    { new: true }
  );

  if (!updatedCustomer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  await logAudit({
    action: 'customer.updated',
    actor: { username: req.user.username, role: req.user.role },
    targetType: 'customer',
    targetId: customerName,
    before: beforeCustomer ? beforeCustomer.toObject() : null,
    after: updatedCustomer.toObject(),
  });

  res.status(200).json({ success: true, message: 'Customer updated successfully', customer: updatedCustomer });
}));

router.post('/customer/deleteCustomer', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { customerName, force } = req.body;
  if (!customerName || customerName.trim() === '') {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  const customer = await Customer.findOne({
    customerName: { $regex: new RegExp(`^${customerName.trim()}$`, 'i') },
  });
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  const totalBalanceDue = roundMoney(customer.orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0));
  if (totalBalanceDue > 0 && force !== true) {
    return res.status(409).json({
      success: false,
      message: `This customer has an outstanding balance of ${totalBalanceDue}. Pass force: true to delete anyway.`,
      totalBalanceDue,
      requiresForce: true,
    });
  }

  const deletedCustomer = await Customer.findOneAndDelete({ _id: customer._id });

  await logAudit({
    action: 'customer.deleted',
    actor: { username: req.user.username, role: req.user.role },
    targetType: 'customer',
    targetId: deletedCustomer.customerName,
    before: deletedCustomer.toObject(),
    after: null,
  });

  res.status(200).json({ success: true, message: 'Customer deleted successfully', customer: deletedCustomer });
}));

router.post('/customer/undoCustomer', requireAuth, asyncHandler(async (req, res) => {
  const { customerName, mobileNo, emergencyMobile, email, address } = req.body;

  const existing = await Customer.findOne({ customerName });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Customer already exists.' });
  }

  const newCustomer = new Customer({ customerName, mobileNo, emergencyMobile, email, address });
  await newCustomer.save();

  await logAudit({
    action: 'customer.restored',
    actor: { username: req.user.username, role: req.user.role },
    targetType: 'customer',
    targetId: customerName,
    before: null,
    after: newCustomer.toObject(),
  });

  res.status(200).json({ success: true, message: 'Customer restored successfully' });
}));

module.exports = router;
