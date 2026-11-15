import { useEffect, useState } from 'react';
import { sb, level, last7, fmt, roleName } from './db.js';

export function Modal({ onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="clay modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
}

export const Avatar = ({ name, size = 56 }) => (
  <div className="avatar" style={{ width: size, height: size, fontSize: size / 2.2 }}>
    {(name || '?').trim()[0]}
  </div>
);

export function Radar({ skills }) {
  const n = skills.length;
  if (n < 3) return <p className="muted center">برای نمودار راداری حداقل ۳ مهارت لازم است.</p>;
  const max = Math.max(...skills.map((s) => s.xp), 1);
  const C = 160, R = 100;
  const pt = (i, r) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const ring = (f) => skills.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const poly = skills.map((s, i) => pt(i, R * (s.xp / max)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 320 320" className="chart">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="#c9dcbc" />)}
      {skills.map((_, i) => <line key={i} x1={C} y1={C} x2={pt(i, R)[0]} y2={pt(i, R)[1]} stroke="#c9dcbc" />)}
      <polygon points={poly} fill="rgba(108,192,74,.45)" stroke="#4a9a2c" strokeWidth="2.5" />
      {skills.map((s, i) => {
        const [x, y] = pt(i, R + 24);
        return <text key={s.id} x={x} y={y} textAnchor="middle" fontSize="11" fill="#355a22">{s.name}</text>;
      })}
    </svg>
  );
}

export function Bars({ acts }) {
  const days = last7();
  const vals = days.map((d) => acts.find((a) => a.day === d.day)?.count || 0);
  const max = Math.max(...vals, 1);
  return (
    <svg viewBox="0 0 320 190" className="chart">
      {days.map((d, i) => {
        const h = (vals[i] / max) * 120;
        return (
          <g key={d.day}>
            <rect x={14 + i * 43} y={140 - h} width="30" height={h} rx="10" fill="url(#g)" />
            <text x={29 + i * 43} y={134 - h} textAnchor="middle" fontSize="11" fill="#355a22">{vals[i]}</text>
            <text x={29 + i * 43} y="160" textAnchor="middle" fontSize="9" fill="#5b7a4a">{d.label}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9be06b" /><stop offset="1" stopColor="#4a9a2c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// نمایش کامل رشد یک نفر (هم پنل رشد خودش و هم دید دیگران)
export function Growth({ user }) {
  const [skills, setSkills] = useState([]);
  const [acts, setActs] = useState([]);
  useEffect(() => {
    (async () => {
      const [s, a] = await Promise.all([
        sb.from('skills').select('*').eq('user_id', user.id).order('id'),
        sb.from('activity').select('*').eq('user_id', user.id).gte('day', last7()[0].day),
      ]);
      setSkills(s.data || []);
      setActs(a.data || []);
    })();
  }, [user.id, user.xp]);
  const lv = level(user.xp);
  const pct = ((user.xp || 0) % 1000) / 10;
  return (
    <div>
      <div className="clay-in stat">
        <div className="lvl">لول {lv}</div>
        <div className="grow">
          <div className="bar"><div style={{ width: pct + '%' }} /></div>
          <small className="muted">{user.xp} XP — {1000 - ((user.xp || 0) % 1000)} XP تا لول بعدی</small>
        </div>
      </div>
      <h3>مهارت‌ها</h3>
      {skills.length === 0 && <p className="muted">هنوز مهارتی ثبت نشده. ادمین مهارت‌ها را تنظیم می‌کند.</p>}
      <div className="chips">
        {skills.map((s) => <span key={s.id} className="chip">{s.name} · {s.xp} XP</span>)}
      </div>
      <div className="grid2">
        <div className="clay-in"><h3>نمودار مهارت‌ها</h3><Radar skills={skills} /></div>
        <div className="clay-in"><h3>فعالیت هفتگی</h3><Bars acts={acts} /></div>
      </div>
    </div>
  );
}

// گفتگوی دو طرفه روی یک گزارش
export function Thread({ report, me }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const load = async () => {
    const { data } = await sb.from('report_messages')
      .select('*, sender:profiles!sender_id(name)').eq('report_id', report.id).order('created_at');
    setMsgs(data || []);
  };
  useEffect(() => { load(); }, [report.id]);
  const send = async () => {
    if (!text.trim()) return;
    await sb.from('report_messages').insert({ report_id: report.id, sender_id: me.id, content: text.trim() });
    if (me.id !== report.user_id) await sb.from('reports').update({ status: 'reviewed' }).eq('id', report.id);
    setText('');
    load();
  };
  return (
    <div className="thread">
      {msgs.map((m) => (
        <div key={m.id} className={'msg ' + (m.sender_id === me.id ? 'mine' : '')}>
          <b>{m.sender?.name}</b>
          <p>{m.content}</p>
          <small className="muted">{fmt(m.created_at)}</small>
        </div>
      ))}
      <div className="row">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="پیام یا پاسخ..." />
        <button className="btn small" onClick={send}>ارسال</button>
      </div>
    </div>
  );
}

export const RoleBadge = ({ role }) => role !== 'member' && <span className={'badge ' + role}>{roleName[role]}</span>;
