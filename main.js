require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const path = require('path');
const fs = require('fs');

const Product = require('./models/Product');
const PendingBill = require('./models/PendingBill');

const logger = require('./lib/logger');
const authRoutes = require('./routes/auth');
const { errorHandler } = require('./middleware/errorHandler');
const exportRoutes = require('./routes/export');
const syncRoutes = require('./routes/sync');
const productsRoutes = require('./routes/products');
const customersRoutes = require('./routes/customers');
const billingRoutes = require('./routes/billing');
const suppliersRoutes = require('./routes/suppliers');
const ordersRoutes = require('./routes/orders');
const auditRoutes = require('./routes/audit');

const app = express();
const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_system';
// How long an untouched draft (no autosave, no commit) sits before its
// reserved stock is released and it's marked abandoned — see the sweep at
// the bottom of this file and CLAUDE.md Stage 4.
const DRAFT_IDLE_TIMEOUT_MS = parseInt(process.env.DRAFT_IDLE_TIMEOUT_MS) || 15 * 60 * 1000; // 15 min
const DRAFT_SWEEP_INTERVAL_MS = parseInt(process.env.DRAFT_SWEEP_INTERVAL_MS) || 60 * 1000; // 1 min

// ── Core middleware ─────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/dashboard/load' } }));

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    logger.info('MongoDB connected');
    // Order commit (POST /billing/orderDetails) uses a multi-document
    // transaction (see CLAUDE.md Stage 3) — those only work against a
    // replica set (or mongos), never a plain standalone mongod. Warn loudly
    // at boot rather than let every checkout fail with a cryptic Mongo error.
    try {
      await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
    } catch (err) {
      logger.warn(
        { err: err.message },
        'MongoDB does not appear to be running as a replica set — order checkout (transactions) will fail. ' +
          'For local dev: run mongod with --replSet rs0, then run rs.initiate() once in mongosh.'
      );
    }
  })
  .catch((err) => logger.error({ err: err.message }, 'MongoDB connection failed'));

// ── Auth ─────────────────────────────────────────────────────
// POST /auth/login issues the JWT; see routes/auth.js and
// scripts/createUser.js (there is no public signup route).
app.use('/auth', authRoutes);

// Stage 10 — CSV export module. Toggleable via ENABLE_EXPORTS; set to
// "false" in .env to disable/remove the feature without touching
// anything else here. See routes/export.js and lib/reports.js.
if (process.env.ENABLE_EXPORTS !== 'false') {
  app.use('/api/export', exportRoutes);
} else {
  logger.info('Export module disabled (ENABLE_EXPORTS=false)');
}

// Stage 11 — Offline Sync module. Optional, off by default (unlike
// exports, which default on) — set ENABLE_OFFLINE_SYNC=true in .env to
// turn it on. See routes/sync.js and lib/offlineSync.js.
if (process.env.ENABLE_OFFLINE_SYNC === 'true') {
  app.use('/api/sync', syncRoutes);
} else {
  logger.info('Offline sync module disabled (set ENABLE_OFFLINE_SYNC=true to enable)');
}

// Stage 3 — domain route modules. Each mounts at '/' since the routes
// inside keep their original full paths (/api/products, /product/:id,
// /customer/*, /billing/*, /supplier/*, /api/orders, /api/order/*,
// /dashboard/load, /api/audit-log) unchanged from before the split — see
// CLAUDE.md Stage 3 and production-progress.md for the file-by-file
// route inventory.
app.use('/', productsRoutes);
app.use('/', customersRoutes);
app.use('/', billingRoutes);
app.use('/', suppliersRoutes);
app.use('/', ordersRoutes);
app.use('/', auditRoutes);

// ── Serve the built React frontend (MERN — no server-rendered
//    views anymore; see progress.md "EJS removal") ──────────────
// Registered last, after every real API route, so an unmatched
// /api/* or /auth/* request still 404s as JSON (a typo'd API call
// failing loudly beats it silently getting back an HTML page), while
// every other unmatched GET — the client-side routes React Router
// owns, like /billing or /orders/123 — gets the SPA shell and lets
// the frontend decide what to render.
app.use(['/api', '/auth'], (req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

const frontendDist = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  logger.warn(
    'frontend/dist not found — run `npm run build` inside /frontend to serve the React app from this server. ' +
      'API routes still work; only the UI is unavailable until it is built.'
  );
}

// ── Centralized error handler — must be registered last ─────
app.use(errorHandler);

// ── Abandoned-draft sweep (Stage 4) ─────────────────────────
// Closes the gap Stage 3 flagged: a cart nobody explicitly cancelled (tab
// killed, laptop died, network dropped before the beforeunload release
// landed) would otherwise hold its reservation forever. This runs
// periodically and releases anything idle past DRAFT_IDLE_TIMEOUT_MS.
async function sweepAbandonedDrafts() {
  if (mongoose.connection.readyState !== 1) return; // not connected yet/anymore — skip this tick

  const cutoff = new Date(Date.now() - DRAFT_IDLE_TIMEOUT_MS);
  const stale = await PendingBill.find({ status: 'active', updatedAt: { $lt: cutoff }, 'items.0': { $exists: true } });

  for (const draft of stale) {
    try {
      await Promise.all(
        draft.items.map((it) =>
          Product.findOneAndUpdate(
            { productID: it.productID, reserved: { $gte: it.quantity } },
            { $inc: { reserved: -it.quantity } }
          )
        )
      );
      draft.status = 'abandoned';
      draft.items = [];
      draft.updatedAt = new Date();
      await draft.save();
      logger.info({ cashier: draft.cashier, billID: draft.billID }, 'Released stock for an abandoned draft bill');
    } catch (err) {
      logger.error({ err: err.message, cashier: draft.cashier }, 'Failed to sweep an abandoned draft');
    }
  }
}

setInterval(() => {
  sweepAbandonedDrafts().catch((err) => logger.error({ err: err.message }, 'Draft sweep tick failed'));
}, DRAFT_SWEEP_INTERVAL_MS);

app.listen(port, () => {
  logger.info(`🚀 Server running at http://localhost:${port}`);
});