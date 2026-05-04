/**
 * AdminUsers.jsx — User Management (sys_admin only)
 * Calls GET/POST /api/admin/users/* from AdminResource.java
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCw, Check, X, ShieldOff,
  ShieldCheck, Plus, Minus, AlertCircle, ChevronLeft,
  ChevronRight, UserCheck, UserX, Eye, X as Close,
} from 'lucide-react';
import Page from '../components/shared/Page';
import { Card, Spinner } from '../components/shared';
import { request } from '../utils/api';

function Badge({ active }) {
  return active
    ? <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><Check size={9} /> Active</span>
    : <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><X size={9} /> Suspended</span>;
}

export default function AdminUsers({ keycloak }) {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [activeFilter, setActiveFilter] = useState('all');  // all | active | suspended
  const [page,       setPage]       = useState(0);
  const [acting,     setActing]     = useState(null);   // userId being acted on
  const [creditModal, setCreditModal] = useState(null); // { user }
  const [creditAmt,  setCreditAmt]  = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [toast,      setToast]      = useState(null);
  const [detailUser, setDetailUser] = useState(null);   // user detail drawer
  const [detailLoading, setDetailLoading] = useState(false);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size: PAGE_SIZE });
      if (search.trim()) params.set('search', search.trim());
      if (activeFilter !== 'all') params.set('active', activeFilter === 'active');
      const data = await request(keycloak, `/admin/users?${params}`);
      setUsers(data ?? []);
    } catch (e) {
      showToast('error', e.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [keycloak, page, search, activeFilter]);

  useEffect(() => { load(); }, [load]);

  function showToast(type, text) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleSuspend(user) {
    setActing(user.userId);
    try {
      await request(keycloak, `/admin/users/${user.userId}/suspend`, { method: 'POST' });
      showToast('success', `${user.email} suspended`);
      load();
    } catch (e) { showToast('error', e.message); }
    finally { setActing(null); }
  }

  async function handleActivate(user) {
    setActing(user.userId);
    try {
      await request(keycloak, `/admin/users/${user.userId}/activate`, { method: 'POST' });
      showToast('success', `${user.email} activated`);
      load();
    } catch (e) { showToast('error', e.message); }
    finally { setActing(null); }
  }

  async function handleCreditSubmit() {
    const amount = parseInt(creditAmt);
    if (!amount || amount === 0) return;
    setActing(creditModal.user.userId);
    try {
      const res = await request(keycloak, `/admin/users/${creditModal.user.userId}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount, note: creditNote }),
      });
      showToast('success', `Credits adjusted — new balance: ${res.newBalance?.toLocaleString()}`);
      setCreditModal(null);
      setCreditAmt('');
      setCreditNote('');
      load();
    } catch (e) { showToast('error', e.message); }
    finally { setActing(null); }
  }

  async function handleViewUser(userId) {
    setDetailLoading(true);
    setDetailUser({}); // open drawer immediately with loading state
    try {
      const data = await request(keycloak, `/admin/users/${userId}`);
      setDetailUser(data);
    } catch (e) {
      showToast('error', e.message ?? 'Failed to load user detail');
      setDetailUser(null);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <Page title="User management" subtitle="View, suspend, activate and adjust credits for all users">

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by email or name..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {[
            { id: 'all',       label: 'All' },
            { id: 'active',    label: '✓ Active' },
            { id: 'suspended', label: '✗ Suspended' },
          ].map(f => (
            <button key={f.id} onClick={() => { setActiveFilter(f.id); setPage(0); }}
              className={`px-3 py-2 font-medium transition-colors ${
                activeFilter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        <button onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No users found.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Credits</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Tenant ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Joined</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.userId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{u.name ?? '—'}</p>
                      <p className="text-slate-400 font-mono text-[10px]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3"><Badge active={u.isActive} /></td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${u.creditBalance <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {(u.creditBalance ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[10px] text-slate-400 font-mono">
                        {u.tenantId ? u.tenantId.toString().slice(0, 8) + '…' : '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* View detail */}
                        <button
                          onClick={() => handleViewUser(u.userId)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                          title="View user detail"
                        >
                          <Eye size={10} /> View
                        </button>

                        {/* Adjust credits */}
                        <button
                          onClick={() => { setCreditModal({ user: u }); setCreditAmt(''); setCreditNote(''); }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                          title="Adjust credits"
                        >
                          <Plus size={10} /> Credits
                        </button>

                        {/* Suspend / activate */}
                        {u.isActive ? (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={acting === u.userId}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                            title="Suspend user"
                          >
                            {acting === u.userId
                              ? <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <><UserX size={10} /> Suspend</>
                            }
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(u)}
                            disabled={acting === u.userId}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                            title="Activate user"
                          >
                            {acting === u.userId
                              ? <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                              : <><UserCheck size={10} /> Activate</>
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">Page {page + 1}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={users.length < PAGE_SIZE}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* User detail drawer */}
      {detailUser !== null && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setDetailUser(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl border-l border-slate-200 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">User detail</p>
              <button onClick={() => setDetailUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <Close size={14} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner className="w-6 h-6" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Identity */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Identity</p>
                  {[
                    { label: 'Name',      value: detailUser.name       ?? '—' },
                    { label: 'Email',     value: detailUser.email      ?? '—' },
                    { label: 'Status',    value: <Badge active={detailUser.isActive} /> },
                    { label: 'Joined',    value: detailUser.createdAt
                        ? new Date(detailUser.createdAt).toLocaleString() : '—' },
                    { label: 'Updated',   value: detailUser.updatedAt
                        ? new Date(detailUser.updatedAt).toLocaleString() : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-500 shrink-0">{label}</span>
                      <span className="text-xs font-medium text-slate-800 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>

                {/* IDs */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Internal IDs</p>
                  {[
                    { label: 'User ID',   value: detailUser.userId   },
                    { label: 'Tenant ID', value: detailUser.tenantId },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                      <code className="text-[10px] font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded block break-all">
                        {value ?? '—'}
                      </code>
                    </div>
                  ))}
                </div>

                {/* Credits */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Credits</p>
                  <p className={`text-3xl font-extrabold ${
                    (detailUser.creditBalance ?? 0) <= 0 ? 'text-red-600' : 'text-slate-900'
                  }`}>
                    {(detailUser.creditBalance ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">current balance</p>
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Quick actions</p>
                  <button
                    onClick={() => {
                      setDetailUser(null);
                      setCreditModal({ user: detailUser });
                      setCreditAmt('');
                      setCreditNote('');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Plus size={12} className="text-slate-400" /> Adjust credits
                  </button>
                  {detailUser.isActive ? (
                    <button
                      onClick={() => { setDetailUser(null); handleSuspend(detailUser); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <UserX size={12} /> Suspend account
                    </button>
                  ) : (
                    <button
                      onClick={() => { setDetailUser(null); handleActivate(detailUser); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      <UserCheck size={12} /> Activate account
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Credit adjustment modal */}
      {creditModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setCreditModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Adjust credits</h3>
              <p className="text-xs text-slate-500 mb-4">{creditModal.user.email}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                    Amount <span className="font-normal text-slate-400">(positive = grant, negative = deduct)</span>
                  </label>
                  <input
                    type="number"
                    value={creditAmt}
                    onChange={e => setCreditAmt(e.target.value)}
                    placeholder="e.g. 500 or -100"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                    Note <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={creditNote}
                    onChange={e => setCreditNote(e.target.value)}
                    placeholder="e.g. Trial extension"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleCreditSubmit}
                  disabled={!creditAmt || parseInt(creditAmt) === 0 || acting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 hover:bg-slate-800 transition-colors">
                  {acting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirm'}
                </button>
                <button onClick={() => setCreditModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
