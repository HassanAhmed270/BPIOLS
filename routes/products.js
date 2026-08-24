// Stage 3 — split out of main.js verbatim, no logic changes.
const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { roundMoney } = require('../lib/money');
const { getLatestSellingPrice, getLatestBuyingPrice } = require('../lib/pricing');
const { escapeRegex, parsePagination, sortAndPaginate } = require('../lib/query');
const { logAudit } = require('../lib/auditLog');
const { isValidProductId } = require('../lib/validators');

const router = express.Router();

// Stage 20: the sentinel supplier value for stock the business bought
// itself, with no external supplier involved — see CLAUDE.md Stage 20.
const NO_SUPPLIER = 'NoSupplier';

// Defaults to 10 (matches the Product schema default) for missing/invalid input.
function parseThreshold(value) {
  if (value === undefined || value === null || value === '') return 10;
  const n = parseInt(value);
  return Number.isInteger(n) && n >= 0 ? n : 10;
}

// Stage 20: resolves whatever the Product/restock forms submit for
// "supplier" into either a real Supplier _id or null (self-purchased /
// NoSupplier). Rejects anything that isn't a valid, *existing* Supplier
// id — per Stage 20's exit criteria, an arbitrary/stale id must 400, not
// be silently accepted or silently coerced to null.
async function resolveSupplierId(rawSupplierId) {
  if (!rawSupplierId || rawSupplierId === NO_SUPPLIER) return { ok: true, value: null };
  if (!mongoose.Types.ObjectId.isValid(rawSupplierId)) return { ok: false };
  const exists = await Supplier.exists({ _id: rawSupplierId });
  return exists ? { ok: true, value: rawSupplierId } : { ok: false };
}

router.get('/api/products', requireAuth, asyncHandler(async (req, res) => {
  const { search = '', sortBy = 'productID', sortDir = 'asc' } = req.query;
  const { page, limit } = parsePagination(req.query);

  const filter = search
    ? {
        $or: [
          { productID: { $regex: escapeRegex(search), $options: 'i' } },
          { productName: { $regex: escapeRegex(search), $options: 'i' } },
          { category: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      }
    : {};

  const data = await Product.find(
    filter,
    'productID productName category sellingPriceHistory buyingPriceHistory quantity reserved lowStockThreshold supplierID'
  ).populate('supplierID', 'supplierName');
  const mapped = data.map((p) => {
    const available = p.quantity - p.reserved;
    return {
      _id: p._id,
      productID: p.productID,
      productName: p.productName,
      category: p.category,
      quantity: p.quantity,
      reserved: p.reserved,
      available,
      lowStockThreshold: p.lowStockThreshold,
      lowStock: available <= p.lowStockThreshold,
      // Stage 20: p.supplierID is populated to {_id, supplierName} when
      // set, or null for self-purchased/no-supplier products — surfaced
      // as two plain fields so the frontend combobox doesn't need to know
      // about Mongoose population shapes.
      supplierId: p.supplierID?._id || null,
      supplierName: p.supplierID?.supplierName || null,
      sellingPriceHistory: p.sellingPriceHistory,
      price: roundMoney(getLatestSellingPrice(p)),
      costPrice: roundMoney(getLatestBuyingPrice(p)),
    };
  });

  const { data: products, total } = sortAndPaginate(mapped, { sortBy, sortDir, page, limit });
  res.json({ success: true, products, total, page, limit });
}));

// Stage 15 — Low-Stock Notifications. Admin-only: returns every product
// currently at-or-below its lowStockThreshold, unpaginated (this feeds a
// header bell/badge, not a browsable list — Products.jsx already has the
// paginated view with the same per-row highlighting). Sorted so the most
// depleted stock (lowest available) surfaces first.
router.get('/api/products/low-stock', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const data = await Product.find(
    {},
    'productID productName category quantity reserved lowStockThreshold'
  );
  const products = data
    .map((p) => ({
      productID: p.productID,
      productName: p.productName,
      category: p.category,
      quantity: p.quantity,
      reserved: p.reserved,
      available: p.quantity - p.reserved,
      lowStockThreshold: p.lowStockThreshold,
    }))
    .filter((p) => p.available <= p.lowStockThreshold)
    .sort((a, b) => a.available - b.available || a.productID.localeCompare(b.productID));

  res.json({ success: true, count: products.length, products });
}));

// ── Mutating routes — all require a valid JWT ───────────────
// (requireAdmin is available in middleware/auth.js for role-gating
// specific actions like edits/refunds in a later stage.)

router.post('/api/product', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { productId, productName, category, price, stock, supplierId, already, lowStockThreshold } = req.body;

  if (!isValidProductId(productId)) {
    return res.status(400).json({ success: false, message: 'Product ID must look like #0001.' });
  }
  if (!productName || !productName.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }
  const resolvedSupplier = await resolveSupplierId(supplierId);
  if (!resolvedSupplier.ok) {
    return res.status(400).json({ success: false, message: 'Invalid supplier selected.' });
  }

  const submittedPrice = roundMoney(price);
  const threshold = parseThreshold(lowStockThreshold);
  const existingProduct = await Product.findOne({ productID: productId });
  // Stage 14: snapshot before any mutation, for the audit entry below.
  const beforeSnapshot = existingProduct ? existingProduct.toObject() : null;

  if (existingProduct) {
    const updatedStock =
      (isNaN(parseInt(stock)) ? 0 : parseInt(stock)) + (isNaN(parseInt(already)) ? 0 : parseInt(already));
    existingProduct.quantity = updatedStock;
    existingProduct.productName = productName;
    existingProduct.category = category;
    existingProduct.supplierID = resolvedSupplier.value;
    if (lowStockThreshold !== undefined) existingProduct.lowStockThreshold = threshold;

    // Only record a new price-history entry if the price actually moved —
    // this is what makes getLatestSellingPrice() meaningful instead of the
    // array just growing with the same number forever.
    const latestPrice = roundMoney(getLatestSellingPrice(existingProduct));
    if (submittedPrice > 0 && submittedPrice !== latestPrice) {
      existingProduct.sellingPriceHistory.push({ price: submittedPrice, date: new Date() });
    }
    await existingProduct.save();
    await logAudit({
      action: 'product.updated',
      actor: { username: req.user.username, role: req.user.role },
      targetType: 'product',
      targetId: productId,
      before: beforeSnapshot,
      after: existingProduct.toObject(),
    });
  } else {
    const newProduct = new Product({
      productID: productId,
      productName,
      category,
      sellingPriceHistory: [{ price: submittedPrice }],
      quantity: isNaN(parseInt(stock)) ? 0 : parseInt(stock),
      reserved: 0,
      lowStockThreshold: threshold,
      supplierID: resolvedSupplier.value,
    });
    await newProduct.save();
    await logAudit({
      action: 'product.created',
      actor: { username: req.user.username, role: req.user.role },
      targetType: 'product',
      targetId: productId,
      before: null,
      after: newProduct.toObject(),
    });
  }

  res.status(200).json({ success: true, message: 'Product saved successfully' });
}));

router.delete('/product/:productID', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { productID } = req.params;
  const deleted = await Product.findOneAndDelete({ productID });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  await logAudit({
    action: 'product.deleted',
    actor: { username: req.user.username, role: req.user.role },
    targetType: 'product',
    targetId: productID,
    before: deleted.toObject(),
    after: null,
  });

  return res.status(200).json({ success: true, message: 'Product deleted successfully' });
}));

router.post('/product/undo', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { productId, productName, category, price, stock, supplierId, lowStockThreshold } = req.body;
  if (!isValidProductId(productId)) {
    return res.status(400).json({ success: false, message: 'Product ID must look like #0001.' });
  }
  const threshold = parseThreshold(lowStockThreshold);
  const resolvedSupplier = await resolveSupplierId(supplierId);
  if (!resolvedSupplier.ok) {
    return res.status(400).json({ success: false, message: 'Invalid supplier selected.' });
  }

  const existingProduct = await Product.findOne({ productID: productId });
  const beforeSnapshot = existingProduct ? existingProduct.toObject() : null;
  let restoredProduct;
  if (existingProduct) {
    existingProduct.productName = productName;
    existingProduct.category = category;
    existingProduct.sellingPriceHistory = [{ price: roundMoney(price) }];
    existingProduct.quantity = isNaN(parseInt(stock)) ? 0 : parseInt(stock);
    existingProduct.reserved = 0; // a restored product starts with nothing held in any open cart
    existingProduct.lowStockThreshold = threshold;
    existingProduct.supplierID = resolvedSupplier.value;
    await existingProduct.save();
    restoredProduct = existingProduct;
  } else {
    const newProduct = new Product({
      productID: productId,
      productName,
      category,
      sellingPriceHistory: [{ price: roundMoney(price) }],
      quantity: isNaN(parseInt(stock)) ? 0 : parseInt(stock),
      reserved: 0,
      lowStockThreshold: threshold,
      supplierID: resolvedSupplier.value,
    });
    await newProduct.save();
    restoredProduct = newProduct;
  }

  await logAudit({
    action: 'product.restored',
    actor: { username: req.user.username, role: req.user.role },
    targetType: 'product',
    targetId: productId,
    before: beforeSnapshot,
    after: restoredProduct.toObject(),
  });

  res.status(201).json({ ok: true, message: 'Product restored successfully!' });
}));

module.exports = router;
