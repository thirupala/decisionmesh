/**
 * SysAdminRoute.jsx — Route guard for sys_admin-only pages
 *
 * hasSysAdminRole() checks all three common JWT role locations:
 *   1. Keycloak realm roles:  tokenParsed.realm_access.roles
 *   2. Keycloak client roles: tokenParsed.resource_access.<any-client>.roles
 *   3. Zitadel roles:         tokenParsed["urn:zitadel:iam:org:project:roles"]
 *
 * To debug: open /debug/token in your app and look for where
 * "sys_admin" appears in your JWT claims.
 */
import { ShieldOff } from 'lucide-react';

const ROLE = 'sys_admin';

// ── Role check — covers Keycloak realm, client roles, and Zitadel ─────────────
export function hasSysAdminRole(keycloak) {
  const token = keycloak?.tokenParsed;
  if (!token) return false;

  // 1. Keycloak realm roles
  const realmRoles = token?.realm_access?.roles ?? [];
  if (realmRoles.includes(ROLE)) return true;

  // 2. Keycloak client roles — check all resource_access clients
  const resourceAccess = token?.resource_access ?? {};
  for (const client of Object.values(resourceAccess)) {
    if (client?.roles?.includes(ROLE)) return true;
  }

  // 3. Zitadel project roles
  const zitadelRoles = token?.['urn:zitadel:iam:org:project:roles'] ?? {};
  if (ROLE in zitadelRoles) return true;

  // 4. Simple top-level roles array (some custom setups)
  const topRoles = token?.roles ?? [];
  if (topRoles.includes(ROLE)) return true;

  // Debug — remove once confirmed working
  console.debug('[SysAdminRoute] tokenParsed:', JSON.stringify(token, null, 2));
  console.debug('[SysAdminRoute] sys_admin not found in any role location');

  return false;
}

// ── Route guard component ─────────────────────────────────────────────────────
export default function SysAdminRoute({ keycloak, children }) {
  const isAdmin = hasSysAdminRole(keycloak);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <ShieldOff size={28} className="text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Access denied</h1>
          <p className="text-sm text-slate-500 mb-6">
            This page requires the{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
              sys_admin
            </code>{' '}
            role. Contact your administrator if you believe this is a mistake.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            ← Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
