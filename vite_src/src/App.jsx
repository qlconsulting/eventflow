import { useState, useEffect, useCallback } from 'react';

function apiFetch(path, opts = {}) {
  const BASE = window.__BACKEND_URL__ || '';
  return new Promise((resolve) => {
    for (let i = 0; i < 5; i++) {
      (async () => {
        try {
          const r = await fetch(BASE + path, opts);
          if (r.ok) resolve(await r.json());
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1500));
      })();
    }
  });
}

function LandingPage({ onGetStarted, onLogin, onSignup }) {
  const [styleInjected, setStyleInjected] = useState(false);

  useEffect(() => {
    if (!styleInjected) {
      const style = document.createElement('style');
      style.textContent = `

        body { margin: 0; font-family: 'DM Sans', sans-serif; background: #0F1A2E; color: #e6eaf2; }
        h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; }
        .fade-in { opacity: 0; transform: translateY(20px); animation: fadeIn 0.6s forwards; }
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
        .btn-primary { background: #0077B6; color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .btn-primary:hover { background: #005a8c; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,119,182,0.3); }
        .btn-accent { background: #F4A261; color: #0F1A2E; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .btn-accent:hover { background: #e08c4a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(244,162,97,0.3); }
        .card { background: #1A2744; border-radius: 12px; padding: 24px; transition: all 0.3s; border: 1px solid transparent; }
        .card:hover { border-color: #0077B6; transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,119,182,0.15); }
        .pricing-card { background: #1A2744; border-radius: 12px; padding: 32px; transition: all 0.3s; border: 1px solid transparent; text-align: center; }
        .pricing-card:hover { border-color: #F4A261; transform: translateY(-4px); box-shadow: 0 8px 24px rgba(244,162,97,0.15); }
        .pricing-card.featured { border-color: #0077B6; background: linear-gradient(135deg, #1A2744 0%, #1f2f50 100%); }
      `;
      document.head.appendChild(style);
      setStyleInjected(true);
    }
  }, [styleInjected]);

  const features = [
    { icon: '🎤', title: 'Speaker Management', desc: 'Curate and manage speakers with bios, photos, and session assignments in one place.' },
    { icon: '📅', title: 'Agenda Builder', desc: 'Drag-and-drop schedule builder with timezone support and conflict detection.' },
    { icon: '🎟️', title: 'Attendee Registration', desc: 'Custom registration forms, ticket tiers, and automated confirmation emails.' },
    { icon: '📱', title: 'Branded Event App', desc: 'White-label mobile app with personalized schedules, maps, and networking.' },
    { icon: '💬', title: 'Live Q&A & Polls', desc: 'Real-time audience engagement with moderated Q&A and instant poll results.' },
    { icon: '📊', title: 'Post-Event Analytics', desc: 'Deep insights on attendance, engagement, and ROI — exportable reports.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0F1A2E', color: '#e6eaf2', fontFamily: "'DM Sans', sans-serif" }}>
      {/* NAVBAR */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #1A2744' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 24, color: '#F4A261', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>EventFlow</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4 }}>
            <path d="M4 8h16M4 12h12M4 16h8" stroke="#F4A261" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="18" cy="16" r="3" fill="#F4A261"/>
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn-primary" onClick={onGetStarted}>Get Started Free</button>
          <button onClick={onLogin} style={{ background: 'transparent', border: '1px solid #0077B6', color: '#0077B6', padding: '12px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', transition: '0.2s' }}>Sign In</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <div className="fade-in">
          <h1 style={{ fontSize: '3.5rem', margin: 0, lineHeight: 1.1 }}>Run flawless events for up to 50 attendees free,<br/>or scale to thousands with <span style={{ color: '#F4A261' }}>Pro at $199/event</span></h1>
          <p style={{ fontSize: '1.2rem', color: '#8FA3BF', marginTop: 24, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
            End-to-end event management for conference organizers. Speaker management, agenda builder, attendee registration, branded event app, live Q&A, polls, and analytics — all in one platform.
          </p>
          <div style={{ marginTop: 32, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-accent" style={{ fontSize: 18, padding: '14px 32px' }} onClick={onGetStarted}>Start Your Free Event</button>
            <button onClick={onGetStarted} style={{ background: 'transparent', border: '2px solid #0077B6', color: '#0077B6', padding: '14px 32px', borderRadius: 8, fontWeight: 700, fontSize: 18, cursor: 'pointer', transition: '0.2s' }}>Watch Demo</button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: '#0077B6' }}>🎟️</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F4A261', marginTop: 8 }}>50</div>
          <div style={{ fontSize: 14, color: '#8FA3BF' }}>Free attendees per event</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: '#0077B6' }}>💰</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F4A261', marginTop: 8 }}>$199</div>
          <div style={{ fontSize: 14, color: '#8FA3BF' }}>Pro price per event</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: '#0077B6' }}>📈</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F4A261', marginTop: 8 }}>$1,499</div>
          <div style={{ fontSize: 14, color: '#8FA3BF' }}>Annual plan for up to 10 events</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: '#0077B6' }}>⭐</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F4A261', marginTop: 8 }}>94%</div>
          <div style={{ fontSize: 14, color: '#8FA3BF' }}>Average attendee satisfaction</div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 32px' }}>
        <h2 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: 48, fontFamily: "'Space Grotesk', sans-serif" }}>Everything you need to <span style={{ color: '#0077B6' }}>run amazing events</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {(features || []).map((f, i) => (
            <div key={i} className="card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, margin: '0 0 8px', color: '#F4A261' }}>{f.title}</h3>
              <p style={{ color: '#8FA3BF', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>
        <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 40 }}>Trusted by <span style={{ color: '#F4A261' }}>event organizers worldwide</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {[
            { text: 'EventFlow transformed our annual tech conference. The speaker management and live polling features were game-changers.', name: 'Sarah Chen', role: 'Conference Director, TechSummit' },
            { text: 'We scaled from 200 to 2,000 attendees using EventFlow\'s Pro plan. The branded app gave us a professional edge.', name: 'Marcus Okafor', role: 'CEO, Global Connect' },
            { text: 'The post-event analytics alone are worth the price. We increased attendee engagement by 40% in our second event.', name: 'Dr. Amara Singh', role: 'Event Strategist, EduCon' },
          ].map((t, i) => (
            <div key={i} className="card">
              <p style={{ color: '#8FA3BF', fontStyle: 'italic', lineHeight: 1.7, marginTop: 0 }}>"{t.text}"</p>
              <p style={{ margin: 0, fontWeight: 600, color: '#F4A261' }}>{t.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7C99' }}>{t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 32px' }}>
        <h2 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: 48 }}>Simple, transparent pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            { name: 'Free', price: '$0', period: '/event', desc: '50 attendees, core features', features: ['Speaker directory', 'Basic agenda builder', 'Manual registration', 'Email support'], featured: false, btn: 'Get Started Free' },
            { name: 'Pro', price: '$199', period: '/event', desc: 'Unlimited attendees, full features', features: ['Everything in Free', 'Branded event app', 'Live Q&A & polls', 'Post-event analytics', 'Priority support'], featured: true, btn: 'Start Pro' },
            { name: 'Annual', price: '$1,499', period: '/year', desc: 'Pro features for up to 10 events/year', features: ['Everything in Pro', 'Up to 10 events', 'Custom domain', 'Dedicated account manager', 'API access'], featured: false, btn: 'Go Annual' },
          ].map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              <h3 style={{ margin: '0 0 8px', fontSize: 24, color: plan.featured ? '#F4A261' : '#e6eaf2' }}>{plan.name}</h3>
              <div style={{ fontSize: 14, color: '#8FA3BF', marginBottom: 16 }}>{plan.desc}</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#F4A261' }}>{plan.price}<span style={{ fontSize: 16, color: '#8FA3BF', fontWeight: 400 }}>{plan.period}</span></div>
              <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', margin: '24px 0' }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ padding: '6px 0', color: '#8FA3BF' }}>✓ {f}</li>
                ))}
              </ul>
              <button className={`btn-${plan.featured ? 'accent' : 'primary'}`} style={{ width: '100%', fontSize: 16 }} onClick={onGetStarted}>{plan.btn}</button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ background: 'linear-gradient(135deg, #0077B6 0%, #005a8c 100%)', padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', margin: '0 0 16px', color: 'white' }}>Ready to run your best event yet?</h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>Join 5,000+ organizers who trust EventFlow. No credit card required.</p>
        <button className="btn-accent" style={{ fontSize: 18, padding: '14px 32px' }} onClick={onGetStarted}>Create Your Free Event Now</button>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0A1324', padding: '40px 32px', textAlign: 'center', borderTop: '1px solid #1A2744' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ color: '#8FA3BF', cursor: 'pointer' }}>Features</span>
          <span style={{ color: '#8FA3BF', cursor: 'pointer' }}>Pricing</span>
          <span style={{ color: '#8FA3BF', cursor: 'pointer' }}>About</span>
          <span style={{ color: '#8FA3BF', cursor: 'pointer' }}>Blog</span>
          <span style={{ color: '#8FA3BF', cursor: 'pointer' }}>Support</span>
        </div>
        <div style={{ color: '#6B7C99', fontSize: 14 }}>
          <span style={{ color: '#F4A261', fontWeight: 700 }}>EventFlow</span> — © {new Date().getFullYear()} All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function ProductApp({ user, onLogout }) {
  /* NC_PLACEHOLDER_DASHBOARD — replaced by the real dashboard in Phase 2 */
  return (
    <div style={{ minHeight: '100vh', background: '#0a0d18', color: '#e6eaf2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Welcome, {user?.name || user?.email || 'there'} 👋</h1>
      <p style={{ color: '#9aa6bd', maxWidth: 460, lineHeight: 1.5, margin: 0 }}>Your account is ready. Your dashboard is being set up and will appear here shortly.</p>
      <button onClick={onLogout} style={{ marginTop: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid #2a3350', background: 'transparent', color: '#e6eaf2', fontWeight: 600, cursor: 'pointer' }}>Log out</button>
    </div>
  );
}

function AuthGate({ onAuth, onClose }) {
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const _ip = { width: '100%', padding: '11px 13px', margin: '6px 0', borderRadius: 9, border: '1px solid #2a3350', background: '#0b1020', color: '#e6eaf2', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true); setError('');
    const _b = window.__NC_BASE__ || ''; const _s = window.__COMPANY_SLUG__ || '';
    const body = JSON.stringify({ email: form.email, password: form.password, name: form.name });
    const _call = () => fetch(`${_b}/api/c/${_s}/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    try {
      let res; try { res = await _call(); } catch { await new Promise(r => setTimeout(r, 2500)); res = await _call(); }
      const json = await res.json();
      if (!json.ok) { setError(json.error || 'Authentication failed — please try again'); setLoading(false); return; }
      onAuth(json);
    } catch { setError('Connection error — please try again in a moment.'); setLoading(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,18,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ background: '#0f1424', border: '1px solid #232b45', padding: 28, borderRadius: 16, width: 360, maxWidth: '90vw', color: '#e6eaf2' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h3>
        {mode === 'signup' && <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" style={_ip} />}
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" type="email" required style={_ip} />
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 6 chars)" type="password" required style={_ip} />
        {error && <p style={{ color: '#f87171', fontSize: 13, margin: '6px 0 0' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 9, border: 'none', background: loading ? '#4b50b8' : '#6366f1', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '…' : mode === 'signup' ? 'Get started free' : 'Log in'}
        </button>
        <p onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} style={{ marginTop: 14, fontSize: 13, color: '#9aa6bd', cursor: 'pointer', textAlign: 'center' }}>
          {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}
        </p>
      </form>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      if (localStorage.getItem('nc_user') && !localStorage.getItem('nc_auth')) localStorage.removeItem('nc_user');
      const a = JSON.parse(localStorage.getItem('nc_auth') || 'null');
      return (a && a.token && a.user && typeof a.user.email === 'string') ? a : null;
    } catch { return null; }
  });
  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => {
    if (!auth?.token) return;
    const _b = window.__NC_BASE__ || ''; const _s = window.__COMPANY_SLUG__ || '';
    fetch(`${_b}/api/c/${_s}/auth/me`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json()).then(d => { if (!d.ok) { localStorage.removeItem('nc_auth'); setAuth(null); } }).catch(() => {});
  }, []);
  const onAuth = (data) => { localStorage.setItem('nc_auth', JSON.stringify(data)); setAuth(data); setShowAuth(false); };
  const onLogout = () => { localStorage.removeItem('nc_auth'); setAuth(null); };
  if (auth?.user) return <ProductApp user={auth.user} token={auth.token} onLogout={onLogout} />;
  return (
    <>
      <LandingPage onGetStarted={() => setShowAuth(true)} onSignup={() => setShowAuth(true)} onLogin={() => setShowAuth(true)} />
      {/* Fallback entry point (bottom-right so it never overlaps the nav) — guarantees a
          working login even if the landing's own buttons aren't wired to the auth modal. */}
      <button onClick={() => setShowAuth(true)} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, background: '#6366f1', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(99,102,241,.45)' }}>Sign in</button>
      {showAuth && <AuthGate onAuth={onAuth} onClose={() => setShowAuth(false)} />}
    </>
  );
}

export default App;
