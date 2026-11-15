import { useEffect, useState } from 'react';
import { sb, PUBLIC_COLS, level, fmt, fa2en, bumpToday, MIN_CHARS, REPORT_XP } from './db.js';
import { Modal, Avatar, Growth, Thread, RoleBadge } from './ui.jsx';

export function Members() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  useEffect(() => { sb.from('profiles').select(PUBLIC_COLS).order('xp', { ascending: false }).then(({ data }) => setList(data || [])); }, []);
  const shown = list.filter((m) => (m.name + (m.field || '') + (m.city || '')).includes(q));
  return (
    <div>
      <input className="search" placeholder="جستجو در اعضا..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="cards">
        {shown.map((m) => (
          <div key={m.id} className="clay card" onClick={() => setSel(m)}>
            <Avatar name={m.name} />
            <h3>{m.name} <RoleBadge role={m.role} /></h3>
            <p className="muted">{m.field} · {m.city} · {m.age} ساله</p>
            <span className="chip">لول {level(m.xp)} · {m.xp} XP</span>
          </div>
        ))}
      </div>
      {sel && (
        <Modal onClose={() => setSel(null)}>
          <div className="mhead"><Avatar name={sel.name} size={70} />
            <div><h2>{sel.name} <RoleBadge role={sel.role} /></h2>
              <p className="muted">{sel.field} · {sel.city} · {sel.age} ساله</p></div></div>
          <Growth user={sel} />
        </Modal>
      )}
    </div>
  );
}

export const MyPanel = ({ user }) => <div className="clay pad"><h2>پنل رشد من</h2><Growth user={user} /></div>;

export function SubmitReport({ user, refresh }) {
  const [text, setText] = useState('');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const load = async () => {
    const { data } = await sb.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, []);
  const len = text.trim().length;
  const send = async () => {
    if (len < 1) return;
    const earn = len >= MIN_CHARS ? REPORT_XP : 0;
    const { error } = await sb.from('reports').insert({ user_id: user.id, content: text.trim(), xp_awarded: earn });
    if (error) return setNote('خطا: ' + error.message);
    if (earn) {
      const { data } = await sb.from('profiles').select('xp').eq('id', user.id).single();
      await sb.from('profiles').update({ xp: (data?.xp || 0) + earn }).eq('id', user.id);
    }
    await bumpToday(user.id);
    setText('');
    setNote(earn ? `گزارش ثبت شد و ${earn} XP گرفتی 🎉` : `گزارش ثبت شد (برای گرفتن XP حداقل ${MIN_CHARS} حرف لازمه)`);
    load(); refresh();
  };
  return (
    <div>
      <div className="clay pad">
        <h2>ارسال گزارش رشد</h2>
        <textarea rows="7" value={text} onChange={(e) => setText(e.target.value)} placeholder="امروز چه کارهایی انجام دادی؟" />
        <div className="row between">
          <small className={len >= MIN_CHARS ? 'ok' : 'muted'}>{len} / {MIN_CHARS} حرف {len >= MIN_CHARS && '✓ واجد ' + REPORT_XP + ' XP'}</small>
          <button className="btn" onClick={send}>ارسال گزارش</button>
        </div>
        {note && <div className="note">{note}</div>}
      </div>
      <h3>گزارش‌های قبلی من</h3>
      {list.map((r) => (
        <div key={r.id} className="clay pad rep">
          <div className="row between"><small className="muted">{fmt(r.created_at)}</small>
            <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار بررسی'}{r.xp_awarded ? ` · +${r.xp_awarded}XP` : ''}</span></div>
          <p>{r.content}</p>
          <button className="btn small ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'بستن گفتگو' : 'گفتگو با ادمین'}</button>
          {open === r.id && <Thread report={r} me={user} />}
        </div>
      ))}
    </div>
  );
}

export function AdminMessages({ user }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    sb.from('admin_messages').select('*, sender:profiles!from_id(name)').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => setList(data || []));
  }, []);
  return (
    <div>
      <h2>پیام ادمین</h2>
      {list.length === 0 && <div className="clay pad muted">هنوز پیامی نداری.</div>}
      {list.map((m) => (
        <div key={m.id} className="clay pad rep"><b>{m.sender?.name}</b><p>{m.content}</p><small className="muted">{fmt(m.created_at)}</small></div>
      ))}
    </div>
  );
}

export function Profile({ user, refresh }) {
  const [fields, setFields] = useState([]);
  const [f, setF] = useState({ name: user.name, age: user.age || '', city: user.city || '', phone: user.phone, password: user.password, field: user.field || '' });
  const [note, setNote] = useState('');
  useEffect(() => { sb.from('fields').select('*').order('id').then(({ data }) => setFields(data || [])); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const phone = fa2en(f.phone), age = parseInt(fa2en(f.age), 10);
    if (!/^09\d{9}$/.test(phone) || !f.name.trim() || !f.password || !(age > 0)) return setNote('اطلاعات را درست وارد کن');
    const { error } = await sb.from('profiles').update({ name: f.name.trim(), age, city: f.city.trim(), phone, password: f.password, field: f.field }).eq('id', user.id);
    if (error) return setNote(error.code === '23505' ? 'این شماره برای شخص دیگری است' : error.message);
    setNote('ذخیره شد ✓'); refresh();
  };
  return (
    <div className="clay pad narrow">
      <h2>ویرایش اطلاعات حساب</h2>
      <label>اسم</label><input value={f.name} onChange={set('name')} />
      <label>سن</label><input value={f.age} onChange={set('age')} />
      <label>شهر</label><input value={f.city} onChange={set('city')} />
      <label>شماره موبایل</label><input value={f.phone} onChange={set('phone')} />
      <label>رمز عبور</label><input value={f.password} onChange={set('password')} />
      <label>حوزه فعالیت</label>
      <select value={f.field} onChange={set('field')}>
        {[...new Set([f.field, ...fields.map((x) => x.name)])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}
      </select>
      <button className="btn" onClick={save}>ذخیره تغییرات</button>
      {note && <div className="note">{note}</div>}
    </div>
  );
}
