import { Fragment, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import { api } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { flattenObject, lastSegment } from '../lib/flattenObject';
import { formatMoney } from '../lib/money';

const MONEY_KEY_RE = /price|amount|balance|paid|due|cost/i;
const DATE_KEY_RE = /date|At$/i;

function formatFieldValue(key, value) {
  if (value === undefined) return '';
  if (MONEY_KEY_RE.test(key) && typeof value === 'number') return formatMoney(value);
  if (DATE_KEY_RE.test(key) && value && !isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString();
  }
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildDiffRows(before, after) {
  const beforeRows = flattenObject(before);
  const afterRows = flattenObject(after);
  const map = new Map();
  for (const { path, value } of beforeRows) {
    map.set(path, { path, before: value, after: undefined });
  }
  for (const { path, value } of afterRows) {
    const existing = map.get(path);
    if (existing) existing.after = value;
    else map.set(path, { path, before: undefined, after: value });
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

const PAGE_SIZE = 20;

const ACTION_LABELS = {
  'order.created': 'Order created',
  'order.edited': 'Order edited',
  'order.refunded': 'Order refunded',
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.deleted': 'Product deleted',
  'product.restored': 'Product restored',
  'customer.updated': 'Customer updated',
  'customer.deleted': 'Customer deleted',
  'customer.restored': 'Customer restored',
  'supplier.created': 'Supplier created',
  'supplier.updated': 'Supplier updated',
  'supplier.deleted': 'Supplier deleted',
  'supplier.purchase': 'Supplier purchase recorded',
  'user.created': 'Worker added',
  'user.deleted': 'Worker removed',
  'user.password_reset': 'Worker password reset',
  'user.password_changed': 'Password changed',
};

const ACTION_BADGE = {
  'order.created': 'bg-green-100 text-green-700',
  'order.edited': 'bg-yellow-100 text-yellow-700',
  'order.refunded': 'bg-red-100 text-red-700',
  'product.created': 'bg-blue-100 text-blue-700',
  'product.updated': 'bg-blue-100 text-blue-700',
  'product.deleted': 'bg-red-100 text-red-700',
  'product.restored': 'bg-green-100 text-green-700',
  'customer.updated': 'bg-purple-100 text-purple-700',
  'customer.deleted': 'bg-red-100 text-red-700',
  'customer.restored': 'bg-green-100 text-green-700',
  'supplier.created': 'bg-teal-100 text-teal-700',
  'supplier.updated': 'bg-teal-100 text-teal-700',
  'supplier.deleted': 'bg-red-100 text-red-700',
  'supplier.purchase': 'bg-teal-100 text-teal-700',
  'user.created': 'bg-indigo-100 text-indigo-700',
  'user.deleted': 'bg-red-100 text-red-700',
  'user.password_reset': 'bg-indigo-100 text-indigo-700',
  'user.password_changed': 'bg-indigo-100 text-indigo-700',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [actionFilter, setActionFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const [expandedId, setExpandedId] = useState(null);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLog({
        search: debouncedSearch,
        action: actionFilter,
        sortBy,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, actionFilter, sortBy, sortDir, page]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title="Audit Log" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <p className="text-sm text-gray-500 mb-4">
            A durable, read-only record of every order, product, customer, and supplier
            change — who did it and when. Kept to the most recent {' '}
            <span className="font-medium">entries only</span>; older entries are dropped
            automatically as new ones come in.
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by user, action, or ID…"
              className="border rounded px-3 py-2 flex-1 min-w-[220px]"
            />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="border rounded px-3 py-2"
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-600 mb-3">{error}</p>}

          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <SortableHeader label="When" field="date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th className="py-3 px-2 text-left">Action</th>
                  <th className="py-3 px-2 text-left">By</th>
                  <th className="py-3 px-2 text-left">Target</th>
                  <th className="py-3 px-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">Loading…</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">No audit entries found.</td></tr>
                ) : (
                  entries.map((entry) => (
                    <Fragment key={entry._id}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === entry._id ? null : entry._id)}
                      >
                        <td className="py-2 px-2 whitespace-nowrap">{new Date(entry.date).toLocaleString()}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_BADGE[entry.action] || 'bg-gray-100 text-gray-700'}`}>
                            {ACTION_LABELS[entry.action] || entry.action}
                          </span>
                        </td>
                        <td className="py-2 px-2">{entry.actor?.username} <span className="text-gray-400">({entry.actor?.role})</span></td>
                        <td className="py-2 px-2">{entry.targetType}: {entry.targetId}</td>
                        <td className="py-2 px-2 text-brand text-xs">{expandedId === entry._id ? 'Hide details ▲' : 'View details ▼'}</td>
                      </tr>
                      {expandedId === entry._id && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={5} className="p-4">
                            <table className="w-full text-xs bg-white border rounded overflow-hidden">
                              <thead className="bg-gray-100 text-gray-600 uppercase">
                                <tr>
                                  <th className="py-2 px-2 text-left">Field</th>
                                  <th className="py-2 px-2 text-left">Before</th>
                                  <th className="py-2 px-2 text-left">After</th>
                                </tr>
                              </thead>
                              <tbody>
                                {buildDiffRows(entry.before, entry.after).map((row) => {
                                  const key = lastSegment(row.path);
                                  const changed = formatFieldValue(key, row.before) !== formatFieldValue(key, row.after);
                                  return (
                                    <tr key={row.path} className={`border-t ${changed ? 'bg-yellow-50 font-medium' : ''}`}>
                                      <td className="py-1 px-2 whitespace-nowrap">{row.path}</td>
                                      <td className="py-1 px-2">{entry.before ? formatFieldValue(key, row.before) : ''}</td>
                                      <td className="py-1 px-2">{formatFieldValue(key, row.after)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
            <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        </main>
      </div>
    </div>
  );
}
