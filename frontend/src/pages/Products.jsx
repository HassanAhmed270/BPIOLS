import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import { api } from '../lib/api';
import { formatMoney } from '../lib/money';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';

// Stage 20: the self-purchased/no-supplier sentinel — must match
// NO_SUPPLIER in main.js exactly, since this string is sent straight
// through as `supplierId` (main.js's resolveSupplierId() treats it the
// same as an empty value: stored as null, no Supplier record required).
const NO_SUPPLIER = 'NoSupplier';
const emptyForm = { productId: '', productName: '', category: '', price: '', stock: '', cost: '', supplierId: NO_SUPPLIER, lowStockThreshold: '' };
// final.md Stage 9 — Add Stock and Deduct Stock are separate dedicated
// actions now, each with their own small form, distinct from `form`
// (Add/Update Product, name+price only as of this stage).
const emptyStockForm = { productId: '', productName: '', cost: '', quantity: '' };
const REASON_OPTIONS = [
  { value: 'expired', label: 'Expired' },
  { value: 'returned_to_supplier', label: 'Returned to Supplier' },
  { value: 'damaged_lost', label: 'Damaged / Lost' },
  { value: 'discontinued', label: 'Discontinued' },
];
const emptyDeductForm = { productId: '', productName: '', available: 0, quantity: '', reason: '', supplierId: '', note: '' };
// final.md Stage 9c — hard delete now opens the same reason form as
// Deduct Stock, only reachable once quantity is already 0.
const emptyDeleteForm = { productId: '', productName: '', category: '', price: 0, supplierId: NO_SUPPLIER, lowStockThreshold: 10, reason: '', note: '' };
const PAGE_SIZE = 10;

export default function Products() {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Full, unpaginated supplier list — used only to populate the Supplier
  // combobox below (Stage 20), same pattern as Suppliers.jsx's
  // allSuppliers/allProducts dropdown data.
  const [allSuppliers, setAllSuppliers] = useState([]);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortBy, setSortBy] = useState('productID');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('add'); // 'add' | 'update' | 'addstock' | 'deductstock' | 'delete'
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [deductForm, setDeductForm] = useState(emptyDeductForm);
  const [deleteForm, setDeleteForm] = useState(emptyDeleteForm);
  // Previous selling price for the product currently being edited (Stage
  // 13, admin-only) — shown next to the new-price input so an admin can
  // see what it was vs. what they're about to set it to. null in 'add'
  // mode since there's no previous price yet.
  const [previousPrice, setPreviousPrice] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [showUndo, setShowUndo] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({ search: debouncedSearch, sortBy, sortDir, page, limit: PAGE_SIZE });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await api.getSuppliers({ limit: 1000 });
      setAllSuppliers(data.suppliers || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err.message);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, sortDir, page]);

  // A new search or sort invalidates the current page — go back to page 1
  // rather than showing an empty "page 4 of 1" after narrowing results.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setStockForm(emptyStockForm);
    setDeductForm(emptyDeductForm);
    setDeleteForm(emptyDeleteForm);
    setPreviousPrice(null);
    setMode('add');
    setSelectedId(null);
  };

  const handleSelectForUpdate = (p) => {
    setSelectedId(p.productID);
    setMode('update');
    setForm({
      productId: p.productID,
      productName: p.productName,
      category: p.category,
      price: p.price ?? '',
      stock: '',
      cost: '',
      supplierId: p.supplierId || NO_SUPPLIER,
      lowStockThreshold: p.lowStockThreshold ?? 10,
    });
    setPreviousPrice(p.price ?? null);
  };

  const handleSelectForAddStock = (p) => {
    setSelectedId(p.productID);
    setMode('addstock');
    setStockForm({ productId: p.productID, productName: p.productName, cost: '', quantity: '' });
  };

  const handleSelectForDeductStock = (p) => {
    setSelectedId(p.productID);
    setMode('deductstock');
    const available = p.available ?? p.quantity - (p.reserved || 0);
    setDeductForm({ productId: p.productID, productName: p.productName, available, quantity: '', reason: '', supplierId: '', note: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((mode === 'update' && !form.productId) || !form.productName) {
      toast.error('Product Name is required.');
      return;
    }
    if (mode === 'add' && (form.cost === '' || isNaN(Number(form.cost)) || Number(form.cost) < 0)) {
      toast.error('Cost is required.');
      return;
    }
    try {
      const result = await api.saveProduct(form);
      await loadProducts();
      resetForm();
      if (mode === 'add' && result?.productId) {
        toast.success(`Product added successfully as ${result.productId}.`);
      }
    } catch (err) {
      toast.error('Error saving product: ' + err.message);
    }
  };

  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(stockForm.quantity);
    if (stockForm.cost === '' || isNaN(Number(stockForm.cost)) || Number(stockForm.cost) < 0) {
      toast.error('Cost is required.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Enter a valid quantity.');
      return;
    }
    try {
      const data = await api.addStock(stockForm.productId, { cost: stockForm.cost, quantity: qty });
      toast.success(data.disabled === false ? `Stock added. ${stockForm.productName} is now enabled again.` : 'Stock added.');
      await loadProducts();
      resetForm();
    } catch (err) {
      toast.error('Failed to add stock: ' + err.message);
    }
  };

  const handleDeductStockSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(deductForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Enter a valid quantity.');
      return;
    }
    if (!deductForm.reason) {
      toast.error('Select a reason.');
      return;
    }
    if (deductForm.reason === 'returned_to_supplier' && !deductForm.supplierId) {
      toast.error('Select the supplier this stock is being returned to.');
      return;
    }
    if (!deductForm.note.trim()) {
      toast.error('A note is required.');
      return;
    }
    if (!(await confirm(`Deduct ${qty} unit(s) of ${deductForm.productName}?`))) return;
    try {
      const data = await api.deductStock(deductForm.productId, {
        quantity: qty,
        reason: deductForm.reason,
        note: deductForm.note.trim(),
        ...(deductForm.reason === 'returned_to_supplier' ? { supplierId: deductForm.supplierId } : {}),
      });
      toast.success(data.disabled ? 'Stock deducted. Product is now disabled (zero stock).' : 'Stock deducted.');
      await loadProducts();
      resetForm();
    } catch (err) {
      toast.error('Failed to deduct stock: ' + err.message);
    }
  };

  const handleDeleteClick = (p) => {
    if (p.quantity > 0) {
      toast.error(`Deduct all remaining stock (${p.quantity} unit(s)) before deleting this product.`);
      return;
    }
    setSelectedId(p.productID);
    setMode('delete');
    setDeleteForm({
      productId: p.productID,
      productName: p.productName,
      category: p.category,
      price: p.price ?? 0,
      supplierId: p.supplierId || NO_SUPPLIER,
      lowStockThreshold: p.lowStockThreshold ?? 10,
      reason: '',
      note: '',
    });
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!deleteForm.reason) {
      toast.error('Select a reason.');
      return;
    }
    if (!deleteForm.note.trim()) {
      toast.error('A note is required.');
      return;
    }
    if (!(await confirm(`Permanently delete ${deleteForm.productId} — ${deleteForm.productName}? This cannot be undone.`))) return;
    try {
      await api.deleteProduct(deleteForm.productId, { reason: deleteForm.reason, note: deleteForm.note.trim() });
      setUndoStack((s) => [
        ...s,
        {
          productId: deleteForm.productId,
          productName: deleteForm.productName,
          category: deleteForm.category,
          price: deleteForm.price,
          stock: 0,
          supplierId: deleteForm.supplierId,
          lowStockThreshold: deleteForm.lowStockThreshold,
        },
      ]);
      await loadProducts();
      setShowUndo(true);
      setTimeout(() => setShowUndo(false), 5000);
      resetForm();
    } catch (err) {
      toast.error('Failed to delete product: ' + err.message);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    try {
      await api.undoProduct(last);
      setUndoStack((s) => s.slice(0, -1));
      setShowUndo(false);
      await loadProducts();
    } catch (err) {
      toast.error('Failed to undo: ' + err.message);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Topbar title="Product Management" />
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          <div className="flex justify-between items-center mb-6">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded px-3 py-2 w-full sm:w-64"
            />
          </div>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="bg-white border rounded-lg w-full">
            <div className="flex flex-col lg:flex-row lg:h-[560px]">
              <div className={`w-full ${isAdmin ? 'lg:w-2/3' : ''} flex flex-col`}>
                <div className="overflow-x-auto lg:overflow-y-auto px-4 flex-1">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-gray-100">
                        <SortableHeader label="Product ID" field="productID" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Name" field="productName" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Category" field="category" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Price" field="price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Available" field="available" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <th className="py-3 px-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="py-6 text-center text-gray-400">Loading…</td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan={6} className="py-6 text-center text-gray-400">No products found</td></tr>
                      ) : (
                        products.map((p) => {
                          const available = p.available ?? p.quantity - (p.reserved || 0);
                          const lowStock = p.lowStock ?? available <= (p.lowStockThreshold ?? 10);
                          return (
                            <tr
                              key={p.productID}
                              className={`border-b hover:bg-gray-50 ${selectedId === p.productID ? 'bg-blue-50' : ''} ${lowStock ? 'bg-red-50' : ''} ${p.disabled ? 'opacity-50' : ''}`}
                            >
                              <td className="py-2 px-3">{p.productID}</td>
                              <td className="py-2 px-3">
                                {p.productName}
                                {p.disabled && <span className="ml-2 text-xs font-semibold text-gray-500">Disabled</span>}
                              </td>
                              <td className="py-2 px-3">{p.category}</td>
                              <td className="py-2 px-3">{formatMoney(p.price ?? 0)}</td>
                              <td className={`py-2 px-3 ${lowStock ? 'text-red-700 font-semibold' : ''}`}>
                                {available}
                                {p.reserved > 0 && <span className="text-xs text-gray-400"> ({p.reserved} held)</span>}
                                {lowStock && <span className="ml-1 text-xs font-normal">⚠ low</span>}
                              </td>
                              <td className="py-2 px-3 flex gap-2">
                                {isAdmin ? (
                                  <>
                                    <button onClick={() => handleSelectForUpdate(p)} className="text-blue-600 hover:text-blue-800" title="Edit">✏️</button>
                                    <button onClick={() => handleSelectForAddStock(p)} className="text-green-600 hover:text-green-800" title="Add Stock">➕</button>
                                    <button onClick={() => handleSelectForDeductStock(p)} className="text-orange-600 hover:text-orange-800" title="Deduct Stock">➖</button>
                                    <button onClick={() => handleDeleteClick(p)} className="text-red-600 hover:text-red-800" title="Delete">🗑️</button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>

              {isAdmin && (mode === 'add' || mode === 'update') && (
              <div className="w-full lg:w-1/3 p-4 sm:p-8 border-t-4 lg:border-t-0 lg:border-l-4 border-gray-300 lg:overflow-y-auto">
                <h2 className="text-2xl flex justify-center text-blue-600 font-bold mb-4">
                  {mode === 'add' ? 'New Product' : 'Update Product'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                  {mode === 'update' && (
                    <div>
                      <label className="block mb-1 font-medium">Product ID</label>
                      <input
                        type="text"
                        value={form.productId}
                        disabled
                        className="border rounded px-3 py-2 bg-gray-100 w-full disabled:opacity-70"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block mb-1 font-medium">Product Name</label>
                    <input
                      type="text"
                      value={form.productName}
                      onChange={(e) => setForm({ ...form, productName: e.target.value })}
                      placeholder="Enter product name"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Category</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Enter category"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Selling Price</label>
                    {isAdmin && mode === 'update' && (
                      <p className="text-xs text-gray-500 mb-1">
                        Previous selling price: <span className="font-medium text-gray-700">{formatMoney(previousPrice ?? 0)}</span>
                      </p>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="Enter selling price"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  {mode === 'add' && (
                    <>
                      <div>
                        <label className="block mb-1 font-medium">Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.cost}
                          onChange={(e) => setForm({ ...form, cost: e.target.value })}
                          placeholder="Enter cost"
                          className="border rounded px-3 py-2 w-full"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-medium">Stock</label>
                        <input
                          type="number"
                          value={form.stock}
                          onChange={(e) => setForm({ ...form, stock: e.target.value })}
                          placeholder="Enter stock"
                          className="border rounded px-3 py-2 w-full"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block mb-1 font-medium">Supplier</label>
                    <select
                      value={form.supplierId}
                      onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                      className="border rounded px-3 py-2 w-full"
                    >
                      <option value={NO_SUPPLIER}>Buy Myself / Self Purchased</option>
                      {allSuppliers.map((s) => (
                        <option key={s._id} value={s._id}>{s.supplierName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="0"
                      value={form.lowStockThreshold}
                      onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                      placeholder="10"
                      className="border rounded px-3 py-2 w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Row highlights red once available stock drops to this number or below.</p>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-green-700">
                      {mode === 'add' ? 'Add Product' : 'Update Product'}
                    </button>
                    {mode === 'update' && (
                      <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
              )}

              {isAdmin && mode === 'addstock' && (
              <div className="w-full lg:w-1/3 p-4 sm:p-8 border-t-4 lg:border-t-0 lg:border-l-4 border-gray-300 lg:overflow-y-auto">
                <h2 className="text-2xl flex justify-center text-green-600 font-bold mb-4">Add Stock</h2>
                <form onSubmit={handleAddStockSubmit} className="space-y-4 w-full">
                  <div>
                    <label className="block mb-1 font-medium">Product</label>
                    <input type="text" value={`${stockForm.productId} — ${stockForm.productName}`} disabled className="border rounded px-3 py-2 bg-gray-100 w-full disabled:opacity-70" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockForm.cost}
                      onChange={(e) => setStockForm({ ...stockForm, cost: e.target.value })}
                      placeholder="Enter cost"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={stockForm.quantity}
                      onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                      placeholder="Enter quantity"
                      className="border rounded px-3 py-2 w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Always self-purchased — for a real supplier restock, use Suppliers &gt; Record a Purchase instead.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-green-700">Add Stock</button>
                    <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                  </div>
                </form>
              </div>
              )}

              {isAdmin && mode === 'deductstock' && (
              <div className="w-full lg:w-1/3 p-4 sm:p-8 border-t-4 lg:border-t-0 lg:border-l-4 border-gray-300 lg:overflow-y-auto">
                <h2 className="text-2xl flex justify-center text-orange-600 font-bold mb-4">Deduct Stock</h2>
                <form onSubmit={handleDeductStockSubmit} className="space-y-4 w-full">
                  <div>
                    <label className="block mb-1 font-medium">Product</label>
                    <input type="text" value={`${deductForm.productId} — ${deductForm.productName}`} disabled className="border rounded px-3 py-2 bg-gray-100 w-full disabled:opacity-70" />
                    <p className="text-xs text-gray-500 mt-1">Available: {deductForm.available}</p>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={deductForm.available}
                      value={deductForm.quantity}
                      onChange={(e) => setDeductForm({ ...deductForm, quantity: e.target.value })}
                      placeholder="Enter quantity"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Reason</label>
                    <select
                      value={deductForm.reason}
                      onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value, supplierId: '' })}
                      className="border rounded px-3 py-2 w-full"
                    >
                      <option value="">Select reason</option>
                      {REASON_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  {deductForm.reason === 'returned_to_supplier' && (
                    <div>
                      <label className="block mb-1 font-medium">Supplier</label>
                      <select
                        value={deductForm.supplierId}
                        onChange={(e) => setDeductForm({ ...deductForm, supplierId: e.target.value })}
                        className="border rounded px-3 py-2 w-full"
                      >
                        <option value="">Select supplier</option>
                        {allSuppliers.map((s) => (
                          <option key={s._id} value={s._id}>{s.supplierName}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Recovered cost is credited to this supplier's balance — no loss is recorded.</p>
                    </div>
                  )}
                  <div>
                    <label className="block mb-1 font-medium">Note</label>
                    <input
                      type="text"
                      value={deductForm.note}
                      onChange={(e) => setDeductForm({ ...deductForm, note: e.target.value })}
                      placeholder="Explain why this stock is being removed"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Deduct Stock</button>
                    <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                  </div>
                </form>
              </div>
              )}

              {isAdmin && mode === 'delete' && (
              <div className="w-full lg:w-1/3 p-4 sm:p-8 border-t-4 lg:border-t-0 lg:border-l-4 border-gray-300 lg:overflow-y-auto">
                <h2 className="text-2xl flex justify-center text-red-600 font-bold mb-4">Delete Product</h2>
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
                  This permanently removes the product from the database. This cannot be undone (aside from the
                  temporary Undo button after confirming).
                </p>
                <form onSubmit={handleDeleteSubmit} className="space-y-4 w-full">
                  <div>
                    <label className="block mb-1 font-medium">Product</label>
                    <input type="text" value={`${deleteForm.productId} — ${deleteForm.productName}`} disabled className="border rounded px-3 py-2 bg-gray-100 w-full disabled:opacity-70" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Reason</label>
                    <select
                      value={deleteForm.reason}
                      onChange={(e) => setDeleteForm({ ...deleteForm, reason: e.target.value })}
                      className="border rounded px-3 py-2 w-full"
                    >
                      <option value="">Select reason</option>
                      {REASON_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Note</label>
                    <input
                      type="text"
                      value={deleteForm.note}
                      onChange={(e) => setDeleteForm({ ...deleteForm, note: e.target.value })}
                      placeholder="Explain why this product is being deleted"
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete Permanently</button>
                    <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                  </div>
                </form>
              </div>
              )}
            </div>
          </div>

          {isAdmin && (
          <div className="flex gap-4 mt-4 py-4">
            <button onClick={() => setMode('add')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Add Product +
            </button>
            {showUndo && (
              <button onClick={handleUndo} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Undo Deleted
              </button>
            )}
          </div>
          )}
        </div>
      </main>
    </div>
  );
}