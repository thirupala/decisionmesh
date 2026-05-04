import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, ListOrdered, Cpu,
  Puzzle, ShieldCheck, BarChart3, TrendingUp,
  KeyRound, ScrollText, ChevronLeft, ChevronRight,
  UserPlus, PanelLeftClose, FolderOpen,
  ChevronDown, Check, Plus, Palette, CreditCard, Receipt, Bug, Library,
  MessageSquarePlus, TestTube2,
  Users, Coins, Webhook, HeartPulse,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProject } from '../context/ProjectContext';
import { useCredits } from '../context/CreditContext';
import { hasSysAdminRole } from '../components/SysAdminRoute';

// ── Single top-level item (no section header) ────────────────────────────────
const DASHBOARD = { label: 'Dashboard', icon: LayoutDashboard, to: '/' };

// ── Grouped nav sections ──────────────────────────────────────────────────────
// All section headers: slate-700 (uniform)
// All item panels:     white bg, slate-200 border (neutral — no colored tints)
// Color reserved for:  active item bg only
const NAV_SECTIONS = [
  {
    label:      'Playground',
    headerBg:   '#334155',
    headerText: '#ffffff',
    itemBg:     '#ffffff',
    itemBorder: '#e2e8f0',
    itemColor:  '#4b5563',
    activeBg:   '#7c3aed',
    hoverBg:    '#f3f0ff',
    hoverText:  '#6d28d9',
    maxHeight:  '100px',
    items: [
      { label: 'Playground',     icon: FlaskConical, to: '/playground'     },
      { label: 'Intent Library', icon: Library,      to: '/intent-library' },
    ],
  },
  {
    label:      'Operations',
    headerBg:   '#334155',
    headerText: '#ffffff',
    itemBg:     '#ffffff',
    itemBorder: '#e2e8f0',
    itemColor:  '#4b5563',
    activeBg:   '#2563eb',
    hoverBg:    '#eff6ff',
    hoverText:  '#1d4ed8',
    maxHeight:  '180px',
    items: [
      { label: 'Intents',    icon: ListOrdered, to: '/intents'    },
      { label: 'Executions', icon: Cpu,         to: '/executions' },
      { label: 'Adapters',   icon: Puzzle,      to: '/adapters'   },
      { label: 'Policies',   icon: ShieldCheck, to: '/policies'   },
    ],
  },
  {
    label:      'Analytics',
    headerBg:   '#334155',
    headerText: '#ffffff',
    itemBg:     '#ffffff',
    itemBorder: '#e2e8f0',
    itemColor:  '#4b5563',
    activeBg:   '#0d9488',
    hoverBg:    '#f0fdfa',
    hoverText:  '#0f766e',
    maxHeight:  '100px',
    items: [
      { label: 'Cost',  icon: BarChart3,  to: '/analytics/cost'  },
      { label: 'Drift', icon: TrendingUp, to: '/analytics/drift' },
    ],
  },
  {
    label:      'Organisation',
    headerBg:   '#334155',
    headerText: '#ffffff',
    itemBg:     '#ffffff',
    itemBorder: '#e2e8f0',
    itemColor:  '#4b5563',
    activeBg:   '#4f46e5',
    hoverBg:    '#eef2ff',
    hoverText:  '#4338ca',
    maxHeight:  '100px',
    items: [
      { label: 'Invite',   icon: UserPlus, to: '/invite'       },
      { label: 'Branding', icon: Palette,  to: '/org/branding' },
    ],
  },
  {
    label:      'Account',
    headerBg:   '#334155',
    headerText: '#ffffff',
    itemBg:     '#ffffff',
    itemBorder: '#e2e8f0',
    itemColor:  '#4b5563',
    activeBg:   '#374151',
    hoverBg:    '#f8fafc',
    hoverText:  '#111827',
    maxHeight:  '180px',
    items: [
      { label: 'API Keys', icon: KeyRound,   to: '/api-keys' },
      { label: 'Audit',    icon: ScrollText, to: '/audit'    },
      { label: 'Credits',  icon: Receipt,    to: '/credits'  },
      { label: 'Billing',  icon: CreditCard, to: '/billing'  },
    ],
  },
];

// Visible only to sys_admin role
const ADMIN_NAV = [
  { label: 'Users',           icon: Users,             to: '/admin/users'    },
  { label: 'Credit Ledger',   icon: Coins,             to: '/admin/credits'  },
  { label: 'Webhooks',        icon: Webhook,           to: '/admin/webhooks' },
  { label: 'Health',          icon: HeartPulse,        to: '/admin/health'   },
  { label: 'Feedback',        icon: MessageSquarePlus, to: '/admin/feedback' },
  { label: 'Payment Testing', icon: TestTube2,         to: '/admin/payments' },
  { label: 'Token Debug',     icon: Bug,               to: '/debug/token'    },
];

const ENV_DOTS = {
  Production: 'bg-green-500',
  Staging:    'bg-amber-500',
  Dev:        'bg-blue-500',
};

function CreditFooter() {
  const navigate = useNavigate();
  const { balance, allocated, statusColor, isEmpty, isLow } = useCredits();
  if (balance === null) return null;
  const pct = allocated ? Math.min(100, (balance / allocated) * 100) : 100;
  return (
    <div
      onClick={() => navigate('/billing?tab=credits')}
      className="mx-2 mb-1 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-100 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Credits</span>
        <span className="text-xs font-bold" style={{ color: statusColor }}>
          {balance?.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: statusColor }} />
      </div>
      {(isEmpty || isLow) && (
        <p className="text-[10px] mt-1" style={{ color: statusColor }}>
          {isEmpty ? '⚠ No credits — top up' : '⚠ Running low'}
        </p>
      )}
    </div>
  );
}

function ProjectSwitcher() {
  const navigate = useNavigate();
  const { org, projects, activeProject, switchProject, loading } = useProject();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="h-12 border-b border-slate-100" />;

  function handleSwitch(project) {
    switchProject(project);
    setOpen(false);
  }

  return (
    <div className="relative px-2 pb-2 border-b border-slate-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-100 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {org.name?.[0]?.toUpperCase() ?? 'O'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 leading-none truncate">{org.name}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ENV_DOTS[activeProject?.environment] ?? 'bg-slate-400'}`} />
            <p className="text-xs font-bold text-slate-900 leading-none truncate">{activeProject?.name ?? 'No project'}</p>
          </div>
        </div>
        <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-2 right-2 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Projects</p>
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {projects.map(p => (
                <button key={p.id}
                  onClick={() => handleSwitch(p)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ENV_DOTS[p.environment] ?? 'bg-slate-400'}`} />
                  <span className="flex-1 text-sm text-slate-700 truncate">{p.name}</span>
                  {p.id === activeProject?.id && (
                    <Check size={12} className="shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 py-1">
              <button
                onClick={() => { setOpen(false); navigate('/projects'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                onMouseEnter={e => e.currentTarget.style.color = 'var(--brand-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = ''}
              >
                <FolderOpen size={12} /> Manage projects
              </button>
              <button
                onClick={() => { setOpen(false); navigate('/projects?new=1'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                onMouseEnter={e => e.currentTarget.style.color = 'var(--brand-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = ''}
              >
                <Plus size={12} /> New project
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, onHide, keycloak }) {
  const isAdmin = hasSysAdminRole(keycloak);

  // Track which sections are open — all open by default
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(
      [...NAV_SECTIONS.map(s => s.label), 'admin'].map(k => [k, true])
    )
  );

  function toggleSection(label) {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-200 shrink-0',
      collapsed ? 'w-14' : 'w-48'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center border-b border-slate-200 shrink-0',
        collapsed ? 'justify-center px-0 py-4' : 'px-3 py-3 gap-2.5'
      )}>
        {/* Icon — bordered container for clean edge */}
        <div className="shrink-0 w-9 h-9 rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white flex items-center justify-center">
          <img
            src="/decimeshi-icon.svg"
            alt="DecisionMesh"
            className="w-7 h-7 object-contain"
          />
        </div>

        {!collapsed && (
          <>
            {/* Two-tone wordmark */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold leading-none tracking-tight">
                <span className="text-slate-900">Decision</span><span style={{ color: 'var(--brand-primary)' }}>Mesh</span>
              </p>
              <p className="text-[9px] font-semibold tracking-[0.10em] uppercase mt-1 whitespace-nowrap"
                style={{ color: 'var(--brand-primary)', opacity: 0.75 }}>
                AI Control Plane
              </p>
            </div>
            <button
              onClick={onHide}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            >
              <PanelLeftClose size={14} />
            </button>
          </>
        )}
      </div>

      {/* Project switcher */}
      {!collapsed && <ProjectSwitcher />}

      {/* Main nav */}
      <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">

        {/* Dashboard — standalone */}
        <NavLink
          to={DASHBOARD.to}
          end
          className={({ isActive }) => cn(
            'select-none flex items-center gap-2.5 py-2 mx-2 px-2.5 rounded-lg text-sm font-medium transition-colors mb-2',
            isActive
              ? 'text-blue-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            collapsed && 'justify-center mx-1 px-0'
          )}
          style={({ isActive }) => isActive
            ? { backgroundColor: 'var(--brand-light)', color: 'var(--brand-primary)' }
            : {}
          }
          title={collapsed ? DASHBOARD.label : undefined}
        >
          <DASHBOARD.icon size={15} className="shrink-0" />
          {!collapsed && <span>{DASHBOARD.label}</span>}
        </NavLink>

        {/* ── Grouped sections ─────────────────────────────────────── */}
        {NAV_SECTIONS.map(section => {
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label} className={cn('mb-1.5', collapsed ? 'mx-1' : 'mx-2')}>

              {collapsed ? (
                /* Collapsed — colored dot only */
                <>
                  <div className="flex justify-center mt-2 mb-1">
                    <div className="w-4 h-0.5 rounded-full opacity-40"
                      style={{ backgroundColor: section.headerBg }} />
                  </div>
                  {section.items.map(({ label, icon: Icon, to }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) => cn(
                        'select-none flex items-center justify-center py-2 rounded-lg mb-0.5 transition-colors'
                      )}
                      style={({ isActive }) => isActive
                        ? { backgroundColor: section.activeBg, color: '#fff' }
                        : { color: '#64748b' }
                      }
                      title={label}
                    >
                      <Icon size={14} />
                    </NavLink>
                  ))}
                </>
              ) : (
                <>
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="select-none w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-all duration-150"
                    style={{
                      backgroundColor: section.headerBg,
                      borderRadius: isOpen ? '6px 6px 0 0' : '6px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      size={11}
                      className="shrink-0 transition-transform duration-200 opacity-70"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    />
                  </button>

                  {/* Animated items panel */}
                  <div style={{
                    maxHeight:  isOpen ? `${section.items.length * 36 + 10}px` : '0px',
                    overflow:   'hidden',
                    transition: 'max-height 0.2s ease-in-out',
                  }}>
                    <div
                      className="border-x border-b rounded-b-md px-1 py-1"
                      style={{ borderColor: section.itemBorder, backgroundColor: section.itemBg }}
                    >
                      {section.items.map(({ label, icon: Icon, to }) => (
                        <NavLink
                          key={to}
                          to={to}
                          className={({ isActive }) => cn(
                            'select-none flex items-center gap-2 py-1.5 px-2 rounded text-xs font-medium mb-0.5 last:mb-0 transition-colors duration-150',
                            isActive
                              ? 'text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                          style={({ isActive }) => isActive
                            ? { backgroundColor: section.activeBg }
                            : {}
                          }
                          onMouseEnter={e => {
                            if (!e.currentTarget.style.backgroundColor) {
                              e.currentTarget.style.backgroundColor = section.hoverBg;
                            }
                          }}
                          onMouseLeave={e => {
                            if (e.currentTarget.style.backgroundColor === section.hoverBg) {
                              e.currentTarget.style.backgroundColor = '';
                            }
                          }}
                          title={label}
                        >
                          <Icon size={13} className="shrink-0" />
                          <span>{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* ── Admin section — sys_admin only ───────────────────────── */}
        {isAdmin && (() => {
          const isOpen = openSections['admin'] !== false;
          return (
            <div className={cn('mb-1.5', collapsed ? 'mx-1' : 'mx-2')}>
              {collapsed ? (
                <>
                  <div className="flex justify-center mt-2 mb-1">
                    <div className="w-4 h-0.5 rounded-full bg-blue-400 opacity-60" />
                  </div>
                  {ADMIN_NAV.map(({ label, icon: Icon, to }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) => cn(
                        'select-none flex items-center justify-center py-2 rounded-lg mb-0.5 transition-colors',
                        !isActive && 'hover:bg-blue-50'
                      )}
                      style={({ isActive }) => isActive
                        ? { backgroundColor: '#2563eb', color: '#fff' }
                        : { color: '#3b82f6' }
                      }
                      title={label}
                    >
                      <Icon size={14} />
                    </NavLink>
                  ))}
                </>
              ) : (
                <>
                  {/* Admin header */}
                  <button
                    onClick={() => toggleSection('admin')}
                    className="select-none w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-all duration-150"
                    style={{
                      backgroundColor: '#334155',
                      borderRadius: isOpen ? '6px 6px 0 0' : '6px',
                      borderLeft: '3px solid #3b82f6',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={11} className="text-blue-300 shrink-0" />
                      <span>Admin</span>
                    </div>
                    <ChevronDown
                      size={11}
                      className="shrink-0 transition-transform duration-200 opacity-60"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    />
                  </button>

                  {/* Admin items */}
                  <div style={{
                    maxHeight:  isOpen ? `${ADMIN_NAV.length * 36 + 10}px` : '0px',
                    overflow:   'hidden',
                    transition: 'max-height 0.2s ease-in-out',
                  }}>
                    <div className="border-x border-b border-slate-200 rounded-b-md bg-white px-1 py-1">
                      {ADMIN_NAV.map(({ label, icon: Icon, to }) => (
                        <NavLink
                          key={to}
                          to={to}
                          className={({ isActive }) => cn(
                            'select-none flex items-center gap-2 py-1.5 px-2 rounded text-xs font-medium mb-0.5 last:mb-0 transition-colors duration-150',
                            isActive
                              ? 'text-white'
                              : 'text-blue-700 hover:bg-blue-100 hover:text-blue-900'
                          )}
                          style={({ isActive }) => isActive
                            ? { backgroundColor: '#2563eb' }
                            : {}
                          }
                          title={label}
                        >
                          <Icon size={13} className="shrink-0" />
                          <span>{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

      </nav>

      {/* Credit footer */}
      {!collapsed && <CreditFooter />}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed
          ? <ChevronRight size={13} />
          : <><ChevronLeft size={13} /><span>Collapse</span></>
        }
      </button>
    </aside>
  );
}
