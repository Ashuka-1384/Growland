import { useEffect, useState } from 'react';
import { sb, level, fmt, last7, roleName, canManage } from './db.js';
import { Avatar, Thread, RoleBadge } from './ui.jsx';

const COLS = 'id,name,age,city,field,role,xp,supervisor_id,phone';

function MemberEditor({ me, m, admins, reload }) {
  const [xp, setXp] = useState(m.xp);
  const [skills, setSkills] = useState([]);
  const [acts, setActs] = useState({});
  const [newSkill, setNewSkill] = useState('');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const days = last7();
  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 2000); };

  const load = async () => {
    const [s, a] = await Promise.all([
      sb.from('skills').select('*').eq('user_id', m.id).order('id'),
      sb.from('activity').select('*').eq('user_id', m.id).gte('day', days[0].day),
    ]);
    setSkills(s.data || []);
    const o = {}; (a.data || []).forEach((r) => (o[r.day] = r.count)); setActs(o);
  };
  useEffect(() => { load(); }, [m.id]);

  const saveXp = async () => { await sb.from('profiles').update({ xp: parseInt(xp, 10) || 0 }).eq('id', m.id); flash('XP ذخیره شد'); reload(); };
  const addSkill = async () => {
    if (!newSkill.trim()) return;
    await sb.from('skills').insert({ user_id: m.id, name: newSkill.trim(), xp: 0 }); setNewSkill(''); load();
  };
  const saveSkill = async (s) => { await sb.from('skills').update({ name: s.name, xp: parseInt(s.xp, 10) || 0 }).eq('id', s.id); flash('مهارت ذخیره شد'); };
  const delSkill = async (id) => { await sb.from('skills').delete().eq('id', id); load(); };
  const editSkill = (id, k, v) => setSkills(skills.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const saveActs = async () => {
    const rows = days.map((d) => ({ user_id: m.id, day: d.day, count: parseInt(acts[d.day], 10) || 0 }));
    await sb.from('activity').upsert(rows, { onConflict: 'user_id,day' }); flash('نمودار هفتگی ذخیره شد');
  };
  const sendMsg = async () => {
    if (!msg.trim()) return;
    await sb.from('admin_messages').insert({ user_id: m.id, from_id: me.id, content: msg.trim() }); setMsg(''); flash('پیام ارسال شد');
  };
  const setRole = async (role) => { await sb.from('profiles').update({ role }).eq('id', m.id); flash('نقش تغییر کرد'); reload(); };
  const setSup = async (v) => { await sb.from('profiles').update({ supervisor_id: v || null }).eq('id', m.id); flash('سرپرست تغییر کرد'); reload(); };

  return (
    <div className="clay pad">
      <h2>{m.name} <RoleBadge role={m.role} /></h2>
      <p className="muted">{m.field} · {m.city} · {m.age} ساله · {m.phone} · لول {level(m.xp)}</p>
      {note && <div className="note">{note}</div>}

      {me.role === 'super' && m.role !== 'super' && (
        <div className="clay-in">
          <h3>مدیریت نقش و سرپرستی (سوپر ادمین)</h3>
          <div className="row">
            <select value={m.role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">عضو عادی</option><option value="admin">ادمین</option>
            </select>
            <select value={m.supervisor_id || ''} onChange={(e) => setSup(e.target.value)}>
              <option value="">بدون سرپرست</option>
              {admins.filter((a) => a.id !== m.id).map((a) => <option key={a.id} value={a.id}>سرپرست: {a.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="clay-in"><h3>XP کل (روی لول اثر دارد)</h3>
        <div className="row"><input type="number" value={xp} onChange={(e) => setXp(e.target.value)} /><button className="btn small" onClick={saveXp}>ذخیره</button></div></div>

      <div className="clay-in"><h3>مهارت‌ها</h3>
        {skills.map((s) => (
          <div className="row" key={s.id}>
            <input value={s.name} onChange={(e) => editSkill(s.id, 'name', e.target.value)} />
            <input type="number" value={s.xp} onChange={(e) => editSkill(s.id, 'xp', e.target.value)} />
            <button className="btn small" onClick={() => saveSkill(s)}>ذخیره</button>
            <button className="btn small danger" onClick={() => delSkill(s.id)}>حذف</button>
          </div>
        ))}
        <div className="row"><input placeholder="مهارت جدید" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} /><button className="btn small" onClick={addSkill}>افزودن</button></div>
      </div>

      <div className="clay-in"><h3>نمودار فعالیت هفتگی</h3>
        <div className="days">{days.map((d) => (
          <label key={d.day}>{d.label}<input type="number" value={acts[d.day] ?? 0} onChange={(e) => setActs({ ...acts, [d.day]: e.target.value })} /></label>
        ))}</div>
        <button className="btn small" onClick={saveActs}>ذخیره</button></div>

      <div className="clay-in"><h3>پیام ادمین برای {m.name}</h3>
        <textarea rows="3" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className="btn small" onClick={sendMsg}>ارسال پیام</button></div>
    </div>
  );
}

function ReportsTab({ me, members }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [only, setOnly] = useState(true);
  const load = async () => {
    const ids = members.map((m) => m.id);
    if (!ids.length) return setList([]);
    const { data } = await sb.from('reports').select('*, user:profiles!user_id(name)').in('user_id', ids).order('created_at', { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, [members.length]);
  const shown = list.filter((r) => !only || r.status === 'pending');
  return (
    <div>
      <label className="check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> فقط بررسی‌نشده‌ها</label>
      {shown.length === 0 && <div className="clay pad muted">گزارشی وجود ندارد.</div>}
      {shown.map((r) => (
        <div key={r.id} className="clay pad rep">
          <div className="row between"><b>{r.user?.name}</b><small className="muted">{fmt(r.created_at)}</small></div>
          <p>{r.content}</p>
          <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار'}</span>{' '}
          <button className="btn small ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>پاسخ / گفتگو</button>{' '}
          {r.status === 'pending' && <button className="btn small" onClick={async () => { await sb.from('reports').update({ status: 'reviewed' }).eq('id', r.id); load(); }}>علامت بررسی شد</button>}
          {open === r.id && <Thread report={r} me={me} />}
        </div>
      ))}
    </div>
  );
}

function FieldsTab() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const load = () => sb.from('fields').select('*').order('id').then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; await sb.from('fields').insert({ name: name.trim() }); setName(''); load(); };
  return (
    <div className="clay pad narrow">
      <h2>حوزه‌های فعالیت (فرم ثبت‌نام)</h2>
      {list.map((f) => (
        <div className="row between" key={f.id}><span>{f.name}</span>
          <button className="btn small danger" onClick={async () => { await sb.from('fields').delete().eq('id', f.id); load(); }}>حذف</button></div>
      ))}
      <div className="row"><input placeholder="حوزه جدید" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn small" onClick={add}>افزودن</button></div>
    </div>
  );
}

export default function Admin({ me }) {
  const [tab, setTab] = useState('members');
  const [all, setAll] = useState([]);
  const [sel, setSel] = useState(null);
  const load = async () => {
    const { data } = await sb.from('profiles').select(COLS).order('xp', { ascending: false });
    setAll(data || []);
  };
  useEffect(() => { load(); }, []);
  const mine = all.filter((m) => canManage(me, m));
  const admins = all.filter((m) => m.role === 'admin' || m.role === 'super');
  const current = mine.find((m) => m.id === sel);
  return (
    <div>
      <div className="subtabs">
        {[['members', 'مدیریت اعضا'], ['reports', 'گزارش‌ها'], ['fields', 'حوزه‌های فعالیت']].map(([k, l]) => (
          <button key={k} className={'btn small ' + (tab === k ? '' : 'ghost')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'members' && (
        <div className="split">
          <div className="side">
            {mine.length === 0 && <div className="clay pad muted">فعلا کسی زیر نظر تو نیست. سوپر ادمین باید افراد را به تو بسپارد.</div>}
            {mine.map((m) => (
              <div key={m.id} className={'clay mini ' + (sel === m.id ? 'active' : '')} onClick={() => setSel(m.id)}>
                <Avatar name={m.name} size={38} /><div><b>{m.name}</b><br /><small className="muted">{roleName[m.role]} · لول {level(m.xp)}</small></div>
              </div>
            ))}
          </div>
          <div className="main">{current ? <MemberEditor key={current.id} me={me} m={current} admins={admins} reload={load} /> : <div className="clay pad muted">یک نفر را از لیست انتخاب کن.</div>}</div>
        </div>
      )}
      {tab === 'reports' && <ReportsTab me={me} members={mine} />}
      {tab === 'fields' && <FieldsTab />}
    </div>
  );
}
