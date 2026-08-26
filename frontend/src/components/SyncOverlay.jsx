import { useEffect, useState } from 'react';
import { subscribeAutoSync, isAutoSyncing } from '../lib/offlineSync';

export default function SyncOverlay() {
  const [syncing, setSyncing] = useState(isAutoSyncing());

  useEffect(() => subscribeAutoSync(setSyncing), []);

  if (!syncing) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg px-6 py-4 flex items-center gap-3">
        <div className="h-5 w-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-700">Syncing offline sales…</span>
      </div>
    </div>
  );
}
