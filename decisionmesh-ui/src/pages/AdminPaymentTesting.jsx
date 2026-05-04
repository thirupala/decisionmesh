/**
 * AdminPaymentTesting.jsx — Stripe & Razorpay Dev Testing Console
 *
 * Available only to sys_admin role (wrap with SysAdminRoute in router).
 * Provides:
 *   - Test card / UPI numbers with one-click copy
 *   - Trigger test checkouts for every plan + interval
 *   - Trigger test credit pack purchases
 *   - Simulate webhook events via backend
 *   - View recent Stripe & Razorpay events
 *   - Environment indicator (test vs live)
 */
import { useState } from 'react';
import {
  CreditCard, Zap, Copy, Check, AlertTriangle, RefreshCw,
  ExternalLink, ChevronDown, ChevronRight, Terminal,
  ShieldCheck, Globe, Webhook,
} from 'lucide-react';
import Page from '../components/shared/Page';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '../components/shared';
import { request } from '../utils/api';

// ── Stripe test cards ─────────────────────────────────────────────────────────
const STRIPE_CARDS = [
  { label: 'Success',              number: '4242 4242 4242 4242', type: 'Visa',       result: 'Payment succeeds'                     },
  { label: 'Auth required',        number: '4000 0025 0000 3155', type: 'Visa',       result: 'Requires 3D Secure authentication'     },
  { label: 'Decline',              number: '4000 0000 0000 9995', type: 'Visa',       result: 'Insufficient funds — payment declined' },
  { label: 'Card declined',        number: '4000 0000 0000 0002', type: 'Visa',       result: 'Generic card declined'                 },
  { label: 'Expired card',         number: '4000 0000 0000 0069', type: 'Visa',       result: 'Expired card error'                   },
  { label: 'Incorrect CVC',        number: '4000 0000 0000 0127', type: 'Visa',       result: 'Incorrect CVC'                        },
  { label: 'India (requires auth)',number: '4000 0035 6000 0008', type: 'Visa IN',    result: 'India card — 3DS required'            },
  { label: 'Subscription success', number: '4000 0000 0000 0044', type: 'MasterCard', result: 'Subscription always succeeds'         },
];

// ── Razorpay test credentials ─────────────────────────────────────────────────
// OTP for all scenarios: 1234 · CVV: any 3 digits · Expiry: any future date
const RAZORPAY_TEST = [
  { label: 'UPI — success',              value: 'success@razorpay',       type: 'UPI',        result: 'Payment captured immediately'               },
  { label: 'UPI — failure',              value: 'failure@razorpay',       type: 'UPI',        result: 'Payment fails — tests error handling'       },
  { label: 'Card — success (Visa)',       value: '4111 1111 1111 1111',    type: 'Card',       result: 'Visa test card — payment succeeds'          },
  { label: 'Card — success (RuPay)',      value: '6076 0000 0000 0002',    type: 'Card',       result: 'RuPay card — payment succeeds'              },
  { label: 'Card — 3DS required',        value: '4000 0000 0000 0002',    type: 'Card',       result: 'OTP screen shown — enter 1234 to pass'     },
  { label: 'Card — decline',             value: '5104 0155 5555 5558',    type: 'Card',       result: 'MasterCard — payment declined'              },
  { label: 'Card — insufficient funds',  value: '4111 1111 1111 1112',    type: 'Card',       result: 'Fails with insufficient_funds error'        },
  { label: 'Netbanking — success',       value: 'HDFC (select in popup)', type: 'Netbanking', result: 'Select any bank in test mode — succeeds'   },
  { label: 'Wallet — Paytm',            value: 'OTP: 1234',              type: 'Wallet',     result: 'Paytm wallet — enter OTP 1234 to succeed'  },
  { label: 'Subscription renewal',       value: 'success@razorpay',       type: 'UPI',        result: 'Use to trigger subscription.charged event'  },
];

// ── Plans to test ─────────────────────────────────────────────────────────────
const TEST_PLANS = [
  {
    name: 'Hobby', id: 'hobby',
    stripe: { monthly: 'hobby' },
    razorpay: { monthly: 'plan_SdDy1dq630Eqr7' },
  },
  {
    name: 'Builder', id: 'builder',
    stripe: {
      monthly: 'builder', quarterly: 'builder_quarterly',
      halfyearly: 'builder_halfyearly', yearly: 'builder_yearly',
    },
    razorpay: {
      monthly: 'plan_SdDtQreYZOuDuZ', quarterly: 'plan_SdR7GBM6uj4NqV',
      halfyearly: 'plan_SdR8W9gg1aXHkK', yearly: 'plan_SdR92osLF8JvPx',
    },
  },
  {
    name: 'Pro', id: 'pro',
    stripe: {
      monthly: 'pro', quarterly: 'pro_quarterly',
      halfyearly: 'pro_halfyearly', yearly: 'pro_yearly',
    },
    razorpay: {
      monthly: 'plan_SdDv8HzOQxPoFm', quarterly: 'plan_SdR9crmN0Nxxzj',
      halfyearly: 'plan_SdRA09r9Rs9KA0', yearly: 'plan_SdRAPgVKuMooyq',
    },
  },
];

const TEST_PACKS = [
  { name: 'Starter', id: 'starter', credits: 12000,  usdPrice: 10, inrPrice: 849,  stripe: 'credits_starter', razorpay: 'credits_starter' },
  { name: 'Growth',  id: 'growth',  credits: 32000,  usdPrice: 25, inrPrice: 2099, stripe: 'credits_growth',  razorpay: 'credits_growth'  },
  { name: 'Scale',   id: 'scale',   credits: 100000, usdPrice: 75, inrPrice: 6299, stripe: 'credits_scale',   razorpay: 'credits_scale'   },
];

const INTERVALS = ['monthly', 'quarterly', 'halfyearly', 'yearly'];

// ── Webhook events to simulate ────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { id: 'stripe.checkout.session.completed',      label: 'Stripe — checkout.session.completed',      color: '#2563eb' },
  { id: 'stripe.invoice.payment_succeeded',       label: 'Stripe — invoice.payment_succeeded',       color: '#2563eb' },
  { id: 'stripe.invoice.payment_failed',          label: 'Stripe — invoice.payment_failed',          color: '#dc2626' },
  { id: 'stripe.customer.subscription.deleted',   label: 'Stripe — customer.subscription.deleted',   color: '#dc2626' },
  { id: 'razorpay.payment.captured',              label: 'Razorpay — payment.captured',              color: '#f59e0b' },
  { id: 'razorpay.payment.failed',                label: 'Razorpay — payment.failed',                color: '#dc2626' },
  { id: 'razorpay.subscription.activated',        label: 'Razorpay — subscription.activated',        color: '#f59e0b' },
  { id: 'razorpay.subscription.charged',          label: 'Razorpay — subscription.charged',          color: '#f59e0b' },
  { id: 'razorpay.subscription.cancelled',        label: 'Razorpay — subscription.cancelled',        color: '#dc2626' },
  { id: 'razorpay.subscription.halted',           label: 'Razorpay — subscription.halted',           color: '#dc2626' },
];

// ── Copy to clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-slate-900">{title}</span>
        </div>
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPaymentTesting({ keycloak }) {
  const [gateway,      setGateway]      = useState('stripe');
  const [triggering,   setTriggering]   = useState(null);
  const [webhookFiring, setWebhookFiring] = useState(null);
  const [results,      setResults]      = useState([]);   // log of test actions
  const [interval,     setIntervalSel]  = useState('monthly');

  const userEmail = keycloak?.tokenParsed?.email ?? 'admin@decimeshi.com';

  function addResult(type, message) {
    setResults(r => [{ id: Date.now(), type, message, ts: new Date().toLocaleTimeString() }, ...r].slice(0, 20));
  }

  // ── Trigger test checkout ─────────────────────────────────────────────────
  async function triggerPlanCheckout(plan) {
    const key = `${plan.id}_${interval}`;
    setTriggering(key);
    try {
      if (gateway === 'stripe') {
        const priceKey = plan.stripe[interval] ?? plan.stripe.monthly;
        const res = await request(keycloak, '/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            plan:  priceKey,
            mode:  'subscription',
            interval,
          }),
        });
        if (res?.checkoutUrl) {
          window.open(res.checkoutUrl, '_blank');
          addResult('success', `Stripe checkout opened for ${plan.name} ${interval}`);
        }
      } else {
        const planId = plan.razorpay[interval] ?? plan.razorpay.monthly;
        const order = await request(keycloak, '/billing/razorpay/order', {
          method: 'POST',
          body: JSON.stringify({ priceId: planId, mode: 'subscription', plan: plan.id, interval }),
        });
        addResult('success', `Razorpay order created: ${order?.orderId} for ${plan.name} ${interval}`);
      }
    } catch (e) {
      addResult('error', `${plan.name} ${interval}: ${e.message}`);
    } finally {
      setTriggering(null);
    }
  }

  // ── Trigger test credit pack ──────────────────────────────────────────────
  async function triggerPackCheckout(pack) {
    setTriggering(pack.id);
    try {
      if (gateway === 'stripe') {
        const res = await request(keycloak, '/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail,
            plan:  pack.stripe,   // "credits_starter" → resolves stripe.price.credits.starter
            mode:  'payment',
            creditAmount: pack.credits,
          }),
        });
        if (res?.checkoutUrl) {
          window.open(res.checkoutUrl, '_blank');
          addResult('success', `Stripe checkout opened for Credits ${pack.name}`);
        }
      } else {
        const order = await request(keycloak, '/billing/razorpay/order', {
          method: 'POST',
          body: JSON.stringify({ priceId: pack.razorpay, mode: 'payment', creditAmount: pack.credits }),
        });
        if (!order?.orderId && !order?.subscriptionId)
          throw new Error('No order ID returned from Razorpay');
        addResult('success', `Razorpay order created: ${order.orderId} — opening popup`);
        // Open Razorpay popup to complete the test payment
        const loaded = window.Razorpay || await new Promise(res => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => res(true); s.onerror = () => res(false);
          document.head.appendChild(s);
        });
        if (!loaded) throw new Error('Razorpay SDK failed to load');
        new window.Razorpay({
          key:         order.keyId,
          order_id:    order.orderId,
          amount:      order.amount,
          currency:    order.currency || 'INR',
          name:        'DecisionMesh [TEST]',
          description: `Credits ${pack.name} — ${pack.credits.toLocaleString()} credits`,
          prefill:     { email: userEmail },
          theme:       { color: '#2563eb' },
          handler: (r) => addResult('success', `Payment done: ${r.razorpay_payment_id} — call /billing/razorpay/verify to complete`),
          modal: { ondismiss: () => addResult('error', 'Razorpay popup dismissed') },
        }).open();
      }
    } catch (e) {
      addResult('error', `Credits ${pack.name}: ${e.message}`);
    } finally {
      setTriggering(null);
    }
  }

  // ── Simulate webhook ──────────────────────────────────────────────────────
  async function simulateWebhook(event) {
    setWebhookFiring(event.id);
    try {
      await request(keycloak, '/admin/webhooks/simulate', {
        method: 'POST',
        body: JSON.stringify({ eventType: event.id }),
      });
      addResult('success', `Webhook simulated: ${event.label}`);
    } catch (e) {
      addResult('error', `Webhook ${event.id}: ${e.message}`);
    } finally {
      setWebhookFiring(null);
    }
  }

  return (
    <Page
      title="Payment testing console"
      subtitle="Sys-admin only — dev environment Stripe & Razorpay testing"
    >
      {/* Environment banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
        <p className="text-xs font-medium text-amber-800">
          <strong>Dev/test environment only.</strong> All Stripe transactions use test mode keys.
          No real money is charged. Razorpay test mode is active.
        </p>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          TEST MODE
        </div>
      </div>

      {/* Gateway selector */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold text-slate-500">Testing via:</p>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {[
            { id: 'stripe',   label: '💳 Stripe (USD)' },
            { id: 'razorpay', label: '🇮🇳 Razorpay (INR)' },
          ].map(g => (
            <button key={g.id}
              onClick={() => setGateway(g.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                gateway === g.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Interval:</span>
          <select
            value={interval}
            onChange={e => setIntervalSel(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white"
          >
            {INTERVALS.map(iv => (
              <option key={iv} value={iv}>{iv}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Test cards / UPI ──────────────────────────────────────────────── */}
      <Section
        title={gateway === 'stripe' ? 'Stripe test cards' : 'Razorpay test credentials'}
        icon={<CreditCard size={15} className="text-slate-500" />}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Scenario</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">
                  {gateway === 'stripe' ? 'Card number' : 'Value / ID'}
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Expected result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(gateway === 'stripe' ? STRIPE_CARDS : RAZORPAY_TEST).map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{item.label}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.number ?? item.value}
                      </code>
                      <CopyButton text={item.number ?? item.value} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{item.result ?? item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gateway === 'stripe' ? (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400">
              Use any future expiry date · CVC: any 3 digits · ZIP: any 5 digits
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-700">
              Card OTP: <strong>1234</strong> · CVV: any 3 digits · Expiry: any future date · Subscription plans redirect to Razorpay hosted page (expected)
            </div>
          )}
        </div>
      </Section>

      {/* ── Trigger plan checkouts ────────────────────────────────────────── */}
      <Section
        title={`Trigger plan checkout — ${interval} via ${gateway}`}
        icon={<Zap size={15} className="text-slate-500" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEST_PLANS.map(plan => {
            const key        = `${plan.id}_${interval}`;
            const isLoading  = triggering === key;
            const planId     = gateway === 'stripe'
              ? (plan.stripe[interval]   ?? plan.stripe.monthly)
              : (plan.razorpay[interval] ?? plan.razorpay.monthly);

            return (
              <div key={plan.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900 mb-1">{plan.name}</p>
                <code className="text-[10px] font-mono text-slate-400 block mb-3 truncate">{planId}</code>
                <button
                  onClick={() => triggerPlanCheckout(plan)}
                  disabled={!!triggering}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {isLoading
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>Open checkout <ExternalLink size={10} /></>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Trigger credit pack checkouts ─────────────────────────────────── */}
      <Section
        title={`Trigger credit pack checkout — via ${gateway}`}
        icon={<ShieldCheck size={15} className="text-slate-500" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEST_PACKS.map(pack => {
            const isLoading = triggering === pack.id;
            const priceId   = gateway === 'stripe' ? pack.stripe : pack.razorpay;
            return (
              <div key={pack.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900 mb-0.5">{pack.name}</p>
                <p className="text-[10px] text-slate-400 mb-1">{pack.credits.toLocaleString()} credits</p>
                <code className="text-[10px] font-mono text-slate-400 block mb-3 truncate">{priceId}</code>
                <button
                  onClick={() => triggerPackCheckout(pack)}
                  disabled={!!triggering}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>Buy credits test <ExternalLink size={10} /></>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Simulate webhooks ─────────────────────────────────────────────── */}
      <Section
        title="Simulate webhook events"
        icon={<Webhook size={15} className="text-slate-500" />}
        defaultOpen={false}
      >
        <p className="text-xs text-slate-500 mb-4">
          Fires a synthetic webhook payload to <code className="text-[10px] bg-slate-100 px-1 rounded">POST /admin/webhooks/simulate</code> on
          the backend, which processes it through the same handler as real events.
        </p>
        <div className="space-y-2">
          {WEBHOOK_EVENTS.map(event => (
            <div key={event.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                <code className="text-xs font-mono text-slate-700">{event.label}</code>
              </div>
              <button
                onClick={() => simulateWebhook(event)}
                disabled={!!webhookFiring}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-white hover:border-slate-300 disabled:opacity-50 transition-colors"
              >
                {webhookFiring === event.id
                  ? <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : <><Zap size={10} /> Fire</>
                }
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Quick links ───────────────────────────────────────────────────── */}
      <Section
        title="Quick links"
        icon={<Globe size={15} className="text-slate-500" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Stripe test dashboard',     url: 'https://dashboard.stripe.com/test/dashboard',          badge: 'Stripe'    },
            { label: 'Stripe webhook events',     url: 'https://dashboard.stripe.com/test/webhooks',           badge: 'Stripe'    },
            { label: 'Stripe test payment log',   url: 'https://dashboard.stripe.com/test/payments',           badge: 'Stripe'    },
            { label: 'Razorpay test dashboard',   url: 'https://dashboard.razorpay.com/app/dashboard',         badge: 'Razorpay'  },
            { label: 'Razorpay test payments',    url: 'https://dashboard.razorpay.com/app/payments',          badge: 'Razorpay'  },
            { label: 'Razorpay subscriptions',    url: 'https://dashboard.razorpay.com/app/subscriptions',     badge: 'Razorpay'  },
          ].map(link => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  link.badge === 'Stripe'   ? 'bg-blue-50 text-blue-700'   :
                  link.badge === 'Razorpay' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>{link.badge}</span>
                <span className="text-xs text-slate-700">{link.label}</span>
              </div>
              <ExternalLink size={11} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </a>
          ))}
        </div>
      </Section>

      {/* ── Action log ───────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <Section
          title="Action log"
          icon={<Terminal size={15} className="text-slate-500" />}
        >
          <div className="space-y-1.5 font-mono">
            {results.map(r => (
              <div key={r.id} className={`flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg ${
                r.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
              }`}>
                <span className="text-slate-400 shrink-0">{r.ts}</span>
                <span className="font-bold">{r.type === 'success' ? '✓' : '✗'}</span>
                <span>{r.message}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setResults([])}
            className="mt-3 text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <RefreshCw size={10} /> Clear log
          </button>
        </Section>
      )}
    </Page>
  );
}
