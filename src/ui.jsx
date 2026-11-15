import { useEffect, useRef, useState } from 'react';
import { sb, level, last7, fmt, roleName, daysAgo, streakOf, nf } from './db.js';

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
  back: 'M19 12H5 M12 19l-7-7 7-7',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  close: 'M18 6L6 18 M6 6l12 12',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
};
export const Icon = ({ n, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {P[n].split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}
  </svg>
);

/* ---------- Toast ---------- */
let push = () => {};
export const toast = (m, t = 'ok') => push(m, t);
export function ToastHost() {
  const [l, setL] = useState([]);
  useEffect(() => {
    push = (m, t) => {
      const id = Math.random();
      setL((x) => [...x, { id, m, t }]);
      setTimeout(() => setL((x) => x.filter((i) => i.id !== id)), 3000);
    };
    return () => { push = () => {}; };
  }, []);
  return <div className="toasts">{l.map((i) => <div key={i.id} className={'toast ' + i.t}>{i.m}</div>)}</div>;
}

/* ---------- المان‌های پایه ---------- */
export function Modal({ onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="clay modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small ghost close" onClick={onClose}><Icon n="close" size={16} /></button>
        {children}
      </div>
    </div>
  );
}
export const Avatar = ({ name, size = 56 }) => (
  <div className="avatar" style={{ width: size, height: size, fontSize: size / 2.2 }}>{(name || '?').trim()[0]}</div>
);
export const RoleBadge = ({ role }) => role !== 'member' && <span className={'badge ' + role}>{roleName[role]}</span>;
export const Empty = ({ icon = 'leaf', text }) => (
  <div className="empty"><div className="empty-i"><Icon n={icon} size={30} /></div><p>{text}</p></div>
);
export const Tile = ({ icon, label, value, sub }) => (
  <div className="clay tile">
    <div className="tile-i"><Icon n={icon} size={22} /></div>
    <div><div className="tile-v">{value}</div><div className="tile-l">{label}</div>{sub && <small className="muted">{sub}</small>}</div>
  </div>
);
export function Ring({ value, max = 100, size = 120, stroke = 12, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(value / max, 1);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b6ec6e" /><stop offset="1" stopColor="#3f8f26" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d6e9c6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#rg)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .9s ease' }} />
      </svg>
      <div className="ringc">{children}</div>
    </div>
  );
}
export function Radar({ skills }) {
  const n = skills.length;
  if (n < 3) return <Empty icon="target" text="برای نمودار راداری حداقل ۳ مهارت لازم است." />;
  const max = Math.max(...skills.map((s) => s.xp), 1);
  const C = 160, R = 100;
  const pt = (i, r) => { const a = (-90 + (i * 360) / n) * (Math.PI / 180); return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const ring = (f) => skills.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const poly = skills.map((s, i) => pt(i, R * (s.xp / max)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 320 320" className="chart">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="#c9dcbc" />)}
      {skills.map((_, i) => <line key={i} x1={C} y1={C} x2={pt(i, R)[0]} y2={pt(i, R)[1]} stroke="#c9dcbc" />)}
      <polygon points={poly} fill="rgba(108,192,74,.45)" stroke="#3f8f26" strokeWidth="2.5" strokeLinejoin="round" />
      {skills.map((s, i) => { const [x, y] = pt(i, R * (s.xp / max)); return <circle key={'d' + s.id} cx={x} cy={y} r="4" fill="#3f8f26" />; })}
      {skills.map((s, i) => { const [x, y] = pt(i, R + 24); return <text key={s.id} x={x} y={y} textAnchor="middle" fontSize="11" fill="#355a22">{s.name}</text>; })}
    </svg>
  );
}
export function Bars({ acts }) {
  const days = last7();
  const vals = days.map((d) => acts.find((a) => a.day === d.day)?.count || 0);
  const max = Math.max(...vals, 1);
  return (
    <svg viewBox="0 0 320 190" className="chart">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a6e872" /><stop offset="1" stopColor="#3f8f26" /></linearGradient></defs>
      {[0, 1, 2, 3].map((i) => <line key={i} x1="8" x2="312" y1={140 - i * 40} y2={140 - i * 40} stroke="#d6e6c8" strokeDasharray="4 5" />)}
      {days.map((d, i) => {
        const h = (vals[i] / max) * 115;
        return (
          <g key={d.day}>
            <rect x={14 + i * 43} y={140 - h} width="30" height={Math.max(h, 4)} rx="10" fill="url(#g)" />
            <text x={29 + i * 43} y={133 - h} textAnchor="middle" fontSize="11" fontWeight="700" fill="#355a22">{vals[i]}</text>
            <text x={29 + i * 43} y="160" textAnchor="middle" fontSize="9" fill="#5b7a4a">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- نمایش رشد یک نفر ---------- */
export function Growth({ user }) {
  const [skills, setSkills] = useState([]);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [s, a] = await Promise.all([
        sb.from('skills').select('*').eq('user_id', user.id).order('id'),
        sb.from('activity').select('*').eq('user_id', user.id).gte('day', daysAgo(40)),
      ]);
      setSkills(s.data || []); setActs(a.data || []); setLoading(false);
    })();
  }, [user.id, user.xp]);
  const lv = level(user.xp), into = (user.xp || 0) % 1000;
  const week = last7().reduce((t, d) => t + (acts.find((a) => a.day === d.day)?.count || 0), 0);
  const maxSk = Math.max(...skills.map((s) => s.xp), 1);
  if (loading) return <div className="skeleton" />;
  return (
    <div>
      <div className="tiles">
        <Tile icon="zap" label="مجموع XP" value={nf(user.xp)} sub={`${nf(1000 - into)} XP تا لول ${nf(lv + 1)}`} />
        <Tile icon="flame" label="روز متوالی" value={nf(streakOf(acts))} />
        <Tile icon="trend" label="فعالیت این هفته" value={nf(week)} />
        <Tile icon="target" label="مهارت‌ها" value={nf(skills.length)} />
      </div>
      <div className="clay-in">
        <h3>مهارت‌ها</h3>
        {skills.length === 0 && <Empty text="هنوز مهارتی ثبت نشده. ادمین مهارت‌ها را تنظیم می‌کند." />}
        {skills.map((s) => (
          <div key={s.id} className="skill">
            <div className="row between"><b>{s.name}</b><small className="muted">{nf(s.xp)} XP</small></div>
            <div className="bar"><div style={{ width: (s.xp / maxSk) * 100 + '%' }} /></div>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="clay-in"><h3>نمودار راداری مهارت‌ها</h3><Radar skills={skills} /></div>
        <div className="clay-in"><h3>فعالیت هفتگی</h3><Bars acts={acts} /></div>
      </div>
    </div>
  );
}

/* ---------- گفتگوی دوطرفه روی گزارش ---------- */
export function Thread({ report, me, onSent }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const load = async () => {
    const { data } = await sb.from('report_messages').select('*, sender:profiles!sender_id(name)').eq('report_id', report.id).order('created_at');
    setMsgs(data || []);
  };
  useEffect(() => { load(); }, [report.id]);
  const send = async () => {
    if (!text.trim()) return;
    await sb.from('report_messages').insert({ report_id: report.id, sender_id: me.id, content: text.trim() });
    if (me.id !== report.user_id) await sb.from('reports').update({ status: 'reviewed' }).eq('id', report.id);
    setText(''); load(); onSent && onSent();
  };
  return (
    <div className="thread">
      {msgs.length === 0 && <small className="muted">هنوز پیامی در این گفتگو نیست.</small>}
      {msgs.map((m) => (
        <div key={m.id} className={'msg ' + (m.sender_id === me.id ? 'mine' : '')}>
          <b>{m.sender?.name}</b><p>{m.content}</p><small className="muted">{fmt(m.created_at)}</small>
        </div>
      ))}
      <div className="row">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="پیام یا پاسخ..." />
        <button className="btn small" onClick={send}><Icon n="send" size={16} /></button>
      </div>
    </div>
  );
}

export function Reveal({ children, delay = 0 }) {
  const ref = useRef(); const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: 0.12 });
    o.observe(ref.current); return () => o.disconnect();
  }, []);
  return <div ref={ref} className={'reveal ' + (v ? 'in' : '')} style={{ transitionDelay: delay + 'ms' }}>{children}</div>;
}
