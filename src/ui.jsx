import { Component, cloneElement, useEffect, useId, useRef, useState } from 'react';
import { level, xpInto, last7, roleName, nf, tierOf, fmtDay, addDays, store, LEVEL_XP } from './db.js';

/* ---------- آیکون ---------- */
const P = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  chart: 'M12 20V10 M18 20V4 M6 20v-4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  check: 'M20 6L9 17l-5-5',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  flame: 'M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-8 0 4-4 6-4 12 0 4 3 7 7 7z',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  back: 'M5 12h14 M12 5l7 7-7 7',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  close: 'M18 6L6 18 M6 6l12 12',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
};
export const Icon = ({ n, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" focusable="false">
    {P[n].split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}
  </svg>
);

/* ---------- کمک‌های دسترس‌پذیری ---------- */
/** props لازم برای کلیک‌پذیر کردن یک المان غیر دکمه با کیبورد */
export const clickable = (fn) => ({
  role: 'button',
  tabIndex: 0,
  onClick: fn,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
  },
});

/** برچسبِ متصل به ورودی (با id یکتا) */
export function Field({ label, children, className = '' }) {
  const id = useId();
  return (
    <div className={'field ' + className}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
const useUid = (p) => p + useId().replace(/:/g, '');

/* ---------- ErrorBoundary: خطای رندر دیگر صفحه سفید نمی‌شود ---------- */
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('GrowLand render error', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth" role="alert">
        <div className="clay authbox center">
          <h2>مشکلی پیش آمد</h2>
          <p className="muted">صفحه با خطا روبه‌رو شد. اطلاعات شما از بین نرفته است.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => window.location.reload()}>بارگذاری مجدد</button>
            <button className="btn ghost" onClick={() => this.setState({ error: null })}>تلاش دوباره</button>
          </div>
        </div>
      </div>
    );
  }
}

/* ---------- المان‌های پایه ---------- */
export function Bg() {
  return <div className="bgfx" aria-hidden="true"><i className="blob b1" /><i className="blob b2" /><i className="gridfx" /></div>;
}

export function ThemeToggle() {
  const [t, setT] = useState(document.documentElement.dataset.theme || 'dim');
  const flip = () => {
    const n = t === 'dim' ? 'light' : 'dim';
    document.documentElement.dataset.theme = n;
    store.set('gl_theme', n);
    setT(n);
  };
  const label = t === 'dim' ? 'تغییر به پوسته روشن' : 'تغییر به پوسته ملایم';
  return <button type="button" className="btn small ghost themebtn" onClick={flip} title={label} aria-label={label}><Icon n={t === 'dim' ? 'sun' : 'moon'} size={16} /></button>;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** مودال دسترس‌پذیر: role=dialog، فوکوس‌تله، Escape و بازگرداندن فوکوس */
export function Modal({ onClose, label = 'جزئیات', children }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useUid('modal-');
  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="clay modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={box} onClick={(e) => e.stopPropagation()}>
        <span id={titleId} className="sr">{label}</span>
        <button type="button" className="btn small ghost close" onClick={onClose} aria-label="بستن"><Icon n="close" size={16} /></button>
        {children}
      </div>
    </div>
  );
}

export const Avatar = ({ name, size = 56, t }) => (
  <div className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size / 2.2, ...(t ? { '--tc': t.c, '--tg': t.g } : {}) }}>
    {(name || '?').trim()[0]}
  </div>
);
export const RoleBadge = ({ role }) => role !== 'member' && <span className={'badge ' + role}>{roleName[role]}</span>;
export const TierBadge = ({ t }) => <span className="tbadge" style={{ '--tc': t.c, '--tg': t.g }}>{t.name}</span>;
export const Empty = ({ icon = 'leaf', text }) => (
  <div className="empty"><div className="empty-i"><Icon n={icon} size={30} /></div><p>{text}</p></div>
);
export const Spinner = () => <div className="spinner" role="status" aria-label="در حال بارگذاری" />;

/** خطای بارگذاری با دکمه تلاش مجدد */
export const ErrorState = ({ error, onRetry }) => (
  <div className="clay pad center" role="alert">
    <p>{error?.message || 'خطا در دریافت اطلاعات'}</p>
    {onRetry && <button type="button" className="btn small" onClick={onRetry}>تلاش مجدد</button>}
  </div>
);

export const Tile = ({ icon, label, value, sub }) => (
  <div className="clay tile">
    <div className="tile-i"><Icon n={icon} size={22} /></div>
    <div><div className="tile-v">{value}</div><div className="tile-l">{label}</div>{sub && <small className="muted">{sub}</small>}</div>
  </div>
);

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export function CountUp({ to, dur = 1200 }) {
  const [v, setV] = useState(() => (reduceMotion() ? to || 0 : 0));
  useEffect(() => {
    if (reduceMotion()) { setV(to || 0); return undefined; }
    let raf, t0;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / dur, 1);
      setV(Math.round((to || 0) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return nf(v);
}

export const XpBar = ({ value, max = LEVEL_XP, height = 14, label = 'پیشرفت XP' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="xpbar" style={{ height }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(Math.min(value, max))}>
      <div style={{ width: pct + '%' }} /><span />
    </div>
  );
};

export function Ring({ value, max = 100, size = 120, stroke = 12, children, label }) {
  const gid = useUid('rg');
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(Math.max(value, 0) / max, 1);
  return (
    <div className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--n1)' }} /><stop offset="1" style={{ stopColor: 'var(--n2)' }} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="ringc">{children}</div>
    </div>
  );
}

export function Radar({ skills }) {
  const n = skills.length;
  if (n < 3) return <Empty icon="target" text="برای نمودار راداری حداقل ۳ مهارت لازم است." />;
  const max = Math.max(...skills.map((s) => s.xp), 1);
  const C = 180, R = 100, CY = 160;
  const pt = (i, r) => { const a = (-90 + (i * 360) / n) * (Math.PI / 180); return [C + r * Math.cos(a), CY + r * Math.sin(a)]; };
  const ring = (f) => skills.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const poly = skills.map((s, i) => pt(i, R * Math.max(0, s.xp / max)).join(',')).join(' ');
  const summary = 'نمودار راداری مهارت‌ها: ' + skills.map((s) => `${s.name} ${nf(s.xp)} امتیاز`).join('، ');
  return (
    <svg viewBox="0 0 360 320" className="chart" style={{ direction: 'ltr' }} role="img" aria-label={summary}>
      <title>{summary}</title>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" className="cg" />)}
      {skills.map((_, i) => <line key={i} x1={C} y1={CY} x2={pt(i, R)[0]} y2={pt(i, R)[1]} className="cg" />)}
      <polygon points={poly} className="rp" strokeWidth="2.5" strokeLinejoin="round" />
      {skills.map((s, i) => { const [x, y] = pt(i, R * Math.max(0, s.xp / max)); return <circle key={'d' + s.id} cx={x} cy={y} r="4" className="rd" />; })}
      {skills.map((s, i) => {
        const [x, y] = pt(i, R + 14);
        const anchor = x > C + 12 ? 'start' : x < C - 12 ? 'end' : 'middle';
        const label = s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name;
        return <text key={s.id} x={x} y={y + 4} textAnchor={anchor} fontSize="11" className="ct">{label}</text>;
      })}
    </svg>
  );
}

export function Bars({ acts, today }) {
  const gid = useUid('bg');
  const days = last7(today);
  const vals = days.map((d) => acts.find((a) => a.day === d.day)?.count || 0);
  const max = Math.max(...vals, 1);
  const summary = 'فعالیت ۷ روز اخیر: ' + days.map((d, i) => `${d.label} ${nf(vals[i])}`).join('، ');
  return (
    <svg viewBox="0 0 320 190" className="chart" style={{ direction: 'ltr' }} role="img" aria-label={summary}>
      <title>{summary}</title>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--n2)' }} /><stop offset="1" style={{ stopColor: 'var(--n1)' }} /></linearGradient></defs>
      {[0, 1, 2, 3].map((i) => <line key={i} x1="8" x2="312" y1={140 - i * 40} y2={140 - i * 40} className="cg" strokeDasharray="4 5" />)}
      {days.map((d, i) => {
        const h = (vals[i] / max) * 115;
        return (
          <g key={d.day}>
            <rect x={14 + i * 43} y={140 - h} width="30" height={Math.max(h, 4)} rx="6" fill={`url(#${gid})`} />
            <text x={29 + i * 43} y={133 - h} textAnchor="middle" fontSize="11" fontWeight="700" className="ct">{nf(vals[i])}</text>
            <text x={29 + i * 43} y="160" textAnchor="middle" fontSize="9" className="cm">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Heatmap({ acts, today }) {
  const map = {};
  acts.forEach((a) => (map[a.day] = a.count));
  const cells = [];
  for (let i = 83; i >= 0; i--) { const d = addDays(today, -i); cells.push([d, map[d] || 0]); }
  const active = cells.filter(([, c]) => c > 0).length;
  return (
    <div className="heat" role="img" aria-label={`نقشه فعالیت ۱۲ هفته اخیر: ${nf(active)} روز فعال از ${nf(84)} روز`}>
      {cells.map(([d, c]) => <i key={d} title={`${fmtDay(d)} · ${nf(c)}`} className={'h' + Math.min(c, 4)} />)}
    </div>
  );
}

/* ---------- کارت افتخار عضو ---------- */
export function MemberCard({ m, rank, skills = [], onClick }) {
  const lv = level(m.xp), t = tierOf(lv);
  const top = [...skills].sort((a, b) => b.xp - a.xp).slice(0, 3);
  const maxS = Math.max(...top.map((s) => s.xp), 1);
  return (
    <div
      className={'mcard ' + (rank <= 3 ? 'top top' + rank : '')}
      style={{ '--tc': t.c, '--tg': t.g }}
      aria-label={`${m.name}، رتبه ${nf(rank)}، لول ${nf(lv)}، ${nf(m.xp)} امتیاز. مشاهده پروفایل`}
      {...clickable(onClick)}
    >
      <div className="mc-shine" />
      <div className="mc-head">
        <span className={'mc-rank en ' + (rank <= 3 ? 'r' + rank : '')}>{nf(rank)}</span>
        <span className="mc-tier en">{t.en}</span>
      </div>
      <div className="mc-av">
        <Avatar name={m.name} size={86} t={t} />
        <span className="mc-lv"><small className="en">LV</small> {nf(lv)}</span>
      </div>
      <h3 className="mc-name">{m.name} <RoleBadge role={m.role} /></h3>
      <div className="mc-title">{t.name}</div>
      <div className="mc-meta">{m.field || '—'} · {m.city || '—'}</div>
      <XpBar value={xpInto(m.xp)} height={10} label={`پیشرفت ${m.name} تا لول بعد`} />
      <div className="row between mc-xp"><small className="muted">{nf(xpInto(m.xp))} / {nf(LEVEL_XP)}</small><b>{nf(m.xp)} XP</b></div>
      {top.length > 0 && (
        <div className="mc-skills">
          {top.map((s) => (
            <div key={s.id} className="mc-sk"><span>{s.name}</span><i><b style={{ width: Math.max(4, (s.xp / maxS) * 100) + '%' }} /></i></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [v, setV] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (v || !ref.current) return undefined;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: 0.1 });
    o.observe(ref.current);
    return () => o.disconnect();
  }, [v]);
  return <div ref={ref} className={'reveal ' + (v ? 'in' : '')} style={{ transitionDelay: delay + 'ms' }}>{children}</div>;
}

export const LoadMore = ({ paged }) => (
  <>
    {paged.error && <ErrorState error={paged.error} onRetry={() => (paged.items.length ? paged.loadMore() : paged.reload())} />}
    {!paged.done && !paged.error && paged.items.length > 0 && (
      <div className="center"><button type="button" className="btn ghost" onClick={paged.loadMore} disabled={paged.loading}>{paged.loading ? 'در حال بارگذاری...' : 'نمایش بیشتر'}</button></div>
    )}
  </>
);
