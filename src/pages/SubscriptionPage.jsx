import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import './ProfilePage.css';   // shared sidebar/root styles
import './SubscriptionPage.css';

/* ── Icon helpers ───────────────────────────────────────────── */
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconSub = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconCross = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ── Feature icon blocks ────────────────────────────────────── */
const FeatBlock = ({ icon, label, sub }) => (
  <div className="sub-feat-block">
    <div className="sub-feat-icon">{icon}</div>
    <div>
      <div className="sub-feat-label">{label}</div>
      <div className="sub-feat-sub">{sub}</div>
    </div>
  </div>
);

/* ── Compare table row ─────────────────────────────────────── */
function CompareRow({ label, basic, pro }) {
  return (
    <tr className="sub-table-row">
      <td className="sub-td sub-td-feat">{label}</td>
      <td className="sub-td sub-td-basic">{basic}</td>
      <td className="sub-td sub-td-pro">{pro}</td>
    </tr>
  );
}

const COMPARE = [

  { label: 'Daily Downloads',     basic: '5 / day',         pro: 'Unlimited' },
];

export default function SubscriptionPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { subscribed, downloadsLeft, loading: subLoading } = useSubscription();

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true });
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) return null;

  return (
    <div className="pf-root">

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className="pf-sidebar">
        <div className="pf-sidebar-top">
          <p className="pf-nav-label">NAVIGATION</p>

          <button className="pf-nav-item" onClick={() => navigate('/profile')}>
            <IconUser />
            Account
          </button>

          <button className="pf-nav-item active">
            <IconSub />
            Subscription
          </button>
        </div>

        <div className="pf-sidebar-footer">
          <p className="pf-plan-label">Current Plan</p>
          <p className="pf-plan-name">
            {subLoading ? '…' : subscribed ? 'Premium Member' : 'Free Member'}
          </p>
          <button className="pf-upgrade-btn" disabled title="Próximamente disponible">
            Upgrade to Pro
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN ══════════════════ */}
      <main className="pf-main sub-main">

        {/* Header */}
        <div className="sub-header">
          <h1 className="sub-title">
            Music <span className="sub-title-accent">Scraper</span>
          </h1>
          <p className="sub-subtitle">
            Unlock the vault. Experience audio in its purest high-fidelity form with zero compromise.
          </p>
        </div>

        {/* ── Plan cards ─────────────────────────────────── */}
        <div className="sub-plans">

          {/* Basic plan */}
          <div className={`sub-plan sub-plan-basic${!subscribed ? ' sub-plan--current' : ''}`}>
            <div className="sub-plan-badge sub-plan-badge--std">Standard</div>

            <div className="sub-plan-price-row">
              <h2 className="sub-plan-name">Basic Plan</h2>
              <div className="sub-plan-price">
                <span className="sub-price-amount">$0</span>
                <span className="sub-price-unit">/mo</span>
              </div>
            </div>

            <ul className="sub-features-list">
              {[
                { ok: true,  text: 'Ad-supported listening' },
                { ok: true,  text: 'Standard 320kbps audio' },
                { ok: false, text: 'Limited downloads' },
              ].map(({ ok, text }) => (
                <li key={text} className={`sub-feature-item${ok ? '' : ' sub-feature-item--off'}`}>
                  <span className={`sub-feature-icon${ok ? ' ok' : ' off'}`}>
                    {ok ? <IconCheck /> : <IconCross />}
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <button className="sub-stay-btn" disabled={!subscribed}>
              {!subscribed ? '✓ Your current plan' : 'Downgrade to Basic'}
            </button>
          </div>

          {/* Pro plan */}
          <div className={`sub-plan sub-plan-pro${subscribed ? ' sub-plan--current' : ''}`}>
            <div className="sub-plan-badge sub-plan-badge--premium">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Premium Choice
            </div>

            <div className="sub-plan-price-row">
              <h2 className="sub-plan-name">Pro Plan</h2>
              <div className="sub-plan-price">
                <span className="sub-price-amount">$5.00</span>
                <span className="sub-price-unit">/month</span>
              </div>
            </div>

            {/* Feature grid (2×2) */}
            <div className="sub-feat-grid">
              <FeatBlock
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                }
                label="Hi-Res FLAC"
                sub="Lossless 24-bit/192kHz"
              />
              <FeatBlock
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                }
                label="Zero Interruptions"
                sub="No ads, ever"
              />
              <FeatBlock
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                }
                label="Unlimited Downloads"
                sub="Listen offline anywhere"
              />
              <FeatBlock
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
                    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                  </svg>
                }
                label="Spatial Sound"
                sub="360 Experience"
              />
            </div>

            {subscribed ? (
              <div className="sub-current-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                You're on Pro
              </div>
            ) : (
              <button className="sub-upgrade-btn" disabled title="Próximamente disponible">
                Upgrade to Pro Now
              </button>
            )}
          </div>
        </div>

        {/* ── Technical Breakdown ─────────────────────────── */}
        <div className="sub-compare">
          <p className="sub-compare-label">Technical Breakdown</p>

          <div className="sub-table-wrap">
            <table className="sub-table">
              <thead>
                <tr>
                  <th className="sub-th sub-th-feat">Feature</th>
                  <th className="sub-th sub-th-basic">Basic</th>
                  <th className="sub-th sub-th-pro">Vault Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(row => (
                  <CompareRow key={row.label} {...row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="sub-footer">
          <p className="sub-footer-note">
            Monthly subscription automatically renews unless cancelled. Prices in USD.
          </p>
          <div className="sub-footer-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#manage">Manage Payment</a>
          </div>
        </footer>

      </main>
    </div>
  );
}
