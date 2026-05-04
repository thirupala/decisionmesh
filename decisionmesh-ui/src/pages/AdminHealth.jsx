/**
 * AdminHealth.jsx — System Health (sys_admin only)
 * Calls GET /api/admin/health from AdminResource.java
 */
import { useState, useEffect, useCallback } from 'react';
import {
  HeartPulse, RefreshCw, Cpu, Database,
  Wifi, WifiOff, Clock, Server, AlertCircle,
} from 'lucide-react';
import Page from '../components/shared/Page';
import { Card, Spinner } from '../components/shared';
import { request } from '../utils/api';

function MetricRow({ label, value, sub, warning }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 ${
      warning ? 'text-amber-700' : ''
    }`}>
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
      <span className={`text-xs font-bold ${warning ? 'text-amber-700' : 'text-slate-900'}`}>
        {warning && <AlertCircle size={10} className="inline mr-1" />}
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    up:       { bg: '#f0fdf4', color: '#16a34a', label: '● Up'       },
    down:     { bg: '#fef2f2', color: '#dc2626', label: '● Down'     },
    degraded: { bg: '#fff7ed', color: '#ea580c', label: '● Degraded' },
    unknown:  { bg: '#f8fafc', color: '#64748b', label: '● Unknown'  },
  };
  const m = map[status] ?? map.unknown;
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function formatUptime(ms) {
  if (!ms) return '—';
  const mins  = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function AdminHealth({ keycloak }) {
  const [health,    setHealth]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request(keycloak, '/admin/health');
      setHealth(data);
      setLastFetch(new Date());
    } catch (e) {
      console.error('Health check failed', e);
      setHealth({ status: 'down' });
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const jvm = health?.jvm ?? {};
  const db  = health?.database ?? {};
  const kafka = health?.kafka ?? {};
  const memPct = jvm.memoryPct ?? 0;

  return (
    <Page title="System health" subtitle="JVM, database, and infrastructure metrics — auto-refreshes every 30s">

      {/* Overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            health?.status === 'up'       ? 'bg-emerald-50'  :
            health?.status === 'degraded' ? 'bg-amber-50'    : 'bg-red-50'
          }`}>
            <HeartPulse size={18} className={
              health?.status === 'up'       ? 'text-emerald-600' :
              health?.status === 'degraded' ? 'text-amber-600'   : 'text-red-600'
            } />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900">Overall status</p>
              {health && <StatusBadge status={health.status} />}
            </div>
            {lastFetch && (
              <p className="text-[10px] text-slate-400">
                Last checked {lastFetch.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && !health ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* JVM */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-blue-50"><Cpu size={14} className="text-blue-600" /></div>
              <p className="text-sm font-bold text-slate-900">JVM</p>
            </div>

            {/* Memory bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500">Memory</span>
                <span className={`font-bold ${memPct > 85 ? 'text-red-600' : memPct > 65 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {memPct}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${memPct}%`,
                    backgroundColor: memPct > 85 ? '#dc2626' : memPct > 65 ? '#d97706' : '#16a34a',
                  }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {jvm.usedMemoryMb ?? '—'} MB used / {jvm.maxMemoryMb ?? '—'} MB max
              </p>
            </div>

            <div>
              <MetricRow label="Used memory"   value={`${jvm.usedMemoryMb ?? '—'} MB`}  warning={memPct > 85} />
              <MetricRow label="Total memory"  value={`${jvm.totalMemoryMb ?? '—'} MB`} />
              <MetricRow label="Max memory"    value={`${jvm.maxMemoryMb ?? '—'} MB`}   />
              <MetricRow label="Processors"    value={jvm.processors ?? '—'}             />
              <MetricRow label="Uptime"        value={formatUptime(jvm.uptimeMs)}        sub="Since last restart" />
            </div>
          </Card>

          {/* Database */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50"><Database size={14} className="text-emerald-600" /></div>
                <p className="text-sm font-bold text-slate-900">Database</p>
              </div>
              <StatusBadge status={db.status ?? 'unknown'} />
            </div>

            <MetricRow label="Total users"        value={(db.totalUsers ?? '—').toLocaleString?.() ?? '—'} />
            <MetricRow label="Credit ledger rows"  value={(db.totalLedgerRows ?? '—').toLocaleString?.() ?? '—'} />
            <MetricRow
              label="Failed webhooks"
              value={db.failedWebhooks ?? '—'}
              warning={(db.failedWebhooks ?? 0) > 0}
              sub={(db.failedWebhooks ?? 0) > 0 ? 'Check Webhooks tab' : undefined}
            />

            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                PostgreSQL via Hibernate Reactive + Vert.x reactive pool.
                Connection health verified by user count query.
              </p>
            </div>
          </Card>

          {/* Kafka */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100">
                  {kafka.status === 'up'
                    ? <Wifi size={14} className="text-slate-600" />
                    : <WifiOff size={14} className="text-slate-400" />
                  }
                </div>
                <p className="text-sm font-bold text-slate-900">Kafka</p>
              </div>
              <StatusBadge status={kafka.status ?? 'unknown'} />
            </div>

            {kafka.status === 'unknown' ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                <Server size={20} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Lag metrics not yet wired</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Inject <code className="bg-slate-100 px-1 rounded">KafkaAdminClient</code> into
                  AdminResource to enable consumer lag, topic offsets, and partition health.
                </p>
              </div>
            ) : (
              <>
                <MetricRow label="Consumer lag"  value={kafka.consumerLag ?? '—'} warning={(kafka.consumerLag ?? 0) > 1000} />
                <MetricRow label="Outbox depth"  value={kafka.outboxDepth ?? '—'} warning={(kafka.outboxDepth ?? 0) > 100} />
                <MetricRow label="Broker"        value={kafka.broker ?? '—'} />
              </>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                Topics: intent-events · execution-events · governance-events
              </p>
            </div>
          </Card>

        </div>
      )}

      {/* Timestamp */}
      {health?.timestamp && (
        <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <Clock size={9} /> Server time: {new Date(health.timestamp).toLocaleString()}
        </p>
      )}
    </Page>
  );
}
