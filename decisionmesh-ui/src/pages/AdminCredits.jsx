/**
 * AdminCredits.jsx — Credit Ledger (sys_admin only)
 * Calls GET /api/admin/credits and /api/admin/credits/stats
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Coins, RefreshCw, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import Page from '../components/shared/Page';
import { Card, Spinner } from '../components/shared';
import { request } from '../utils/api';

const REASONS = [
  'ALL', 'REGISTRATION_GIFT', 'SUBSCRIPTION', 'PURCHASE',
  'REFERRAL', 'INTENT_EXECUTION', 'RETRY', 'REFUND', 'ADMIN_ADJUSTMENT',
];

const REASON_COLORS = {
  REGISTRATION_GIFT: { bg: '#f0fdf4', color: '#16a34a' },
  SUBSCRIPTION:      { bg: '#eff6ff', color: '#2563eb' },
  PURCHASE:          { bg: '#fdf4ff', color: '#9333ea' },
  REFERRAL:          { bg: '#fff7ed', color: '#ea580c' },
  INTENT_EXECUTION:  { bg: '#fef2f2', color: '#dc2626' },
  RETRY:             { bg: '#fef2f2', color: '#dc2626' },
  REFUND:            { bg: '#f0fdf4', color: '#16a34a' },
  ADMIN_ADJUSTMENT:  { bg: '#fefce8', color: '#ca8a04' },
};

function StatCard({ label, value, sub, color, icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <div className="p-1.5 rounded-lg" style={{ background: color + '15', color }}>{icon}</div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function AdminCredits({ keycloak }) {
  const [entries,  setEntries]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [reason,   setReason]   = useState('ALL');
  const [page,     setPage]     = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size: PAGE_SIZE });
      if (reason !== 'ALL') params.set('reason', reason);
      const [data, statsData] = await Promise.all([
        request(keycloak, `/admin/credits?${params}`),
        request(keycloak, '/admin/credits/stats'),
      ]);
      setEntries(data ?? []);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load credits', e);
    } finally {
      setLoading(false);
    }
  }, [keycloak, page, reason]);

  useEffect(() => { load(); }, [load]);

  return (
    <Page title="Credit ledger" subtitle="All credit transactions across every organisation">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total transactions" value={stats.totalTransactions?.toLocaleString() ?? '—'}
            color="#2563eb" icon={<Coins size={14} />} />
          <StatCard label="Total granted" value={(stats.totalGranted ?? 0).toLocaleString()}
            sub="All time" color="#16a34a" icon={<TrendingUp size={14} />} />
          <StatCard label="Total debited" value={(stats.totalDebited ?? 0).toLocaleString()}
            sub="All time" color="#dc2626" icon={<TrendingDown size={14} />} />
          <StatCard label="Net credits" value={(stats.netCredits ?? 0).toLocaleString()}
            sub="Granted − debited" color="#7c3aed" icon={<Coins size={14} />} />
        </div>
      )}

      {/* By reason breakdown */}
      {stats?.byReason && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By reason</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byReason).map(([r, total]) => {
              const meta = REASON_COLORS[r] ?? { bg: '#f8fafc', color: '#64748b' };
              return (
                <div key={r} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: meta.bg, color: meta.color }}>
                  {r}: <span className="font-bold">{total > 0 ? '+' : ''}{total.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={13} className="text-slate-400" />
        <div className="flex flex-wrap gap-1">
          {REASONS.map(r => (
            <button key={r} onClick={() => { setReason(r); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                reason === r ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {r === 'ALL' ? 'All' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button onClick={() => load()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center">
          <Coins size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No transactions found.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Org ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e, i) => {
                  const meta = REASON_COLORS[e.reason] ?? { bg: '#f8fafc', color: '#64748b' };
                  const isCredit = e.amount > 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <code className="text-[10px] text-slate-400 font-mono">
                          {e.orgId ? e.orgId.toString().slice(0, 8) + '…' : '—'}
                        </code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: meta.bg, color: meta.color }}>
                          {e.reason}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-bold ${isCredit ? 'text-emerald-700' : 'text-red-600'}`}>
                          {isCredit ? '+' : ''}{e.amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="text-[10px] text-slate-400 font-mono truncate max-w-[160px] block">
                          {e.referenceId ?? '—'}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">Page {page + 1}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={entries.length < PAGE_SIZE}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}
