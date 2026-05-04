/**
 * AdminWebhooks.jsx — Webhook Event Log (sys_admin only)
 * Calls GET /api/admin/webhooks and POST /api/admin/webhooks/{id}/replay
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, RefreshCw, ChevronLeft, ChevronRight,
  AlertCircle, Check, RotateCcw, ChevronDown, ChevronRight as ChevronR,
} from 'lucide-react';
import Page from '../components/shared/Page';
import { Card, Spinner } from '../components/shared';
import { request } from '../utils/api';

const STATUS_META = {
  received:  { bg: '#eff6ff', color: '#2563eb', label: 'Received'  },
  processed: { bg: '#f0fdf4', color: '#16a34a', label: 'Processed' },
  failed:    { bg: '#fef2f2', color: '#dc2626', label: '✗ Failed'  },
};

const GATEWAY_META = {
  stripe:    { bg: '#eff6ff', color: '#2563eb' },
  razorpay:  { bg: '#fff7ed', color: '#ea580c' },
};

export default function AdminWebhooks({ keycloak }) {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [gateway,   setGateway]   = useState('all');
  const [status,    setStatus]    = useState('all');
  const [page,      setPage]      = useState(0);
  const [expanded,  setExpanded]  = useState(null);
  const [replaying, setReplaying] = useState(null);
  const [toast,     setToast]     = useState(null);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size: PAGE_SIZE });
      if (gateway !== 'all') params.set('gateway', gateway);
      if (status !== 'all')  params.set('status',  status);
      const data = await request(keycloak, `/admin/webhooks?${params}`);
      setEvents(data ?? []);
    } catch (e) {
      console.error('Failed to load webhooks', e);
    } finally {
      setLoading(false);
    }
  }, [keycloak, page, gateway, status]);

  useEffect(() => { load(); }, [load]);

  function showToast(type, text) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleReplay(event) {
    setReplaying(event.id);
    try {
      await request(keycloak, `/admin/webhooks/${event.id}/replay`, { method: 'POST' });
      showToast('success', `Event ${event.eventType} reset for reprocessing`);
      load();
    } catch (e) {
      showToast('error', e.message ?? 'Replay failed');
    } finally {
      setReplaying(null);
    }
  }

  const failedCount = events.filter(e => e.status === 'failed').length;

  return (
    <Page title="Webhook events" subtitle="Incoming Stripe and Razorpay webhook log">

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Failed alert */}
      {failedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={14} className="text-red-600 shrink-0" />
          <p className="text-xs font-medium text-red-800">
            <strong>{failedCount}</strong> failed event{failedCount > 1 ? 's' : ''} on this page — use Replay to reprocess.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Gateway */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {['all', 'stripe', 'razorpay'].map(g => (
            <button key={g} onClick={() => { setGateway(g); setPage(0); }}
              className={`px-3 py-2 font-medium capitalize transition-colors ${
                gateway === g ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {g === 'all' ? 'All gateways' : g === 'stripe' ? '💳 Stripe' : '🇮🇳 Razorpay'}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {['all', 'received', 'processed', 'failed'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0); }}
              className={`px-3 py-2 font-medium capitalize transition-colors ${
                status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {s === 'all' ? 'All statuses' : s}
            </button>
          ))}
        </div>

        <button onClick={() => load()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : events.length === 0 ? (
        <Card className="p-12 text-center">
          <Webhook size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No webhook events found.</p>
          <p className="text-xs text-slate-400 mt-1">
            Add <code className="bg-slate-100 px-1 rounded">WebhookEventEntity.log()</code> calls
            to your BillingResource webhook handlers to populate this log.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map(e => {
            const statusMeta  = STATUS_META[e.status]  ?? STATUS_META.received;
            const gatewayMeta = GATEWAY_META[e.gateway] ?? { bg: '#f8fafc', color: '#64748b' };
            const isExpanded  = expanded === e.id;

            return (
              <Card key={e.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : e.id)}
                >
                  {/* Gateway */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: gatewayMeta.bg, color: gatewayMeta.color }}>
                    {e.gateway}
                  </span>

                  {/* Event type */}
                  <code className="flex-1 text-xs text-slate-700 font-mono truncate">{e.eventType}</code>

                  {/* Status */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: statusMeta.bg, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>

                  {/* Replay button — only for failed */}
                  {e.status === 'failed' && (
                    <button
                      onClick={ev => { ev.stopPropagation(); handleReplay(e); }}
                      disabled={replaying === e.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {replaying === e.id
                        ? <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        : <><RotateCcw size={9} /> Replay</>
                      }
                    </button>
                  )}

                  {/* Timestamp */}
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {e.receivedAt ? new Date(e.receivedAt).toLocaleString() : '—'}
                  </span>

                  {isExpanded
                    ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                    : <ChevronR size={13} className="text-slate-400 shrink-0" />
                  }
                </div>

                {/* Expanded payload */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    {e.error && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-mono">
                        Error: {e.error}
                      </div>
                    )}
                    <div className="flex gap-4 text-[10px] text-slate-500 mb-2">
                      <span>ID: <code className="font-mono text-slate-700">{e.id}</code></span>
                      {e.orgId && <span>Org: <code className="font-mono text-slate-700">{e.orgId}</code></span>}
                      {e.processedAt && <span>Processed: {new Date(e.processedAt).toLocaleString()}</span>}
                    </div>
                    <pre className="text-[10px] font-mono bg-slate-900 text-green-300 rounded-lg p-3 overflow-x-auto max-h-64 leading-relaxed">
                      {e.payload
                        ? (() => { try { return JSON.stringify(JSON.parse(e.payload), null, 2); } catch { return e.payload; } })()
                        : 'No payload recorded'
                      }
                    </pre>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {events.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Page {page + 1}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={events.length < PAGE_SIZE}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
