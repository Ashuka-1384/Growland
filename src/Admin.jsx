import { useEffect, useState } from 'react';
import { sb, level, fmt, last7, roleName, canManage, nf } from './db.js';
import { Avatar, Thread, RoleBadge, Icon, Tile, Empty, Growth, toast } from './ui.jsx';

const COLS = 'id,name,age,city,field,role,xp,supervisor_id,phone';

function MemberEditor({ me, m, reload }) {
  const [tab, setTab] = useState('xp');
  const [xp, setXp] = useState(m.xp);
  const [skills, setSkills] = useState([]);
  const [acts, setActs] = useState({});
  const [newSkill, setNewSkill] = useState('');
  const [msg, setMsg] = useState('');
  const days = last7();

  const load = async () => {
    const [s, a] = await Promise.all([
      sb.from('skills').select('*').eq('user_id', m.id).order('id'),
      sb.from('activity').select('*').eq('user_id', m.id).gte('day', days[0].day),
    ]);
    setSkills(s.data || []);
    const o = {}; (a.data || []).forEach((r) => (o[r.day] = r.count)); setActs(o);
  };
  useEffect(() => { load(); }, [m.id]);

  const saveXp = async () => { await sb.from('profiles').update({ xp: Math.max(0, parseInt(xp, 10) || 0) }).eq('id', m.id); toast('XP ذخیره شد'); reload(); };
  const addSkill = async () => { if (!newSkill.trim()) return; await sb.from('skills').insert({ user_id: m.id, name: newSkill.trim(), xp: 0 }); setNewSkill(''); load(); };
  const saveSkill = async (s) => { await sb.from('skills').update({ name: s.name, xp: Math.max(0, parseInt(s.xp, 10) || 0) }).eq('id', s.id); toast('مهارت ذخیره شد'); };
  const delSkill = async (id) => { await sb.from('skills').delete().eq('id', id); load(); };
  const editSkill = (id, k, v) => setSkills(skills.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const saveActs = async () => {
    const rows = days.map((d) => ({ user_id: m.id, day: d.day, count: Math.max(0, parseInt(acts[d.day], 10) || 0) }));
    await sb.from('activity').upsert(rows, { onConflict: 'user_id,day' }); toast('نمودار هفتگی ذخیره شد');
  };
  const sendMsg = async () => {
    if (!msg.trim()) return;
    await sb.from('admin_messages').insert({ user_id: m.id, from_id: me.id, content: msg.trim() }); setMsg(''); toast('پیام ارسال شد');
  };

  return (
    <div className="clay pad">
      <div className="mhead"><Avatar name={m.name} size={64} />
        <div><h2>{m.name} <RoleBadge role={m.role} /></h2>
          <p className="muted">{m.field} · {m.city} · {nf(m.age)} ساله · {m.phone}</p>
          <span className="chip">لول {nf(level(m.xp))} · {nf(m.xp)} XP</span></div></div>
      <div className="seg" style={{ margin: '14px 0' }}>
        {[['xp', 'XP و مهارت‌ها'], ['act', 'فعالیت هفتگی'], ['msg', 'پیام'], ['view', 'پیش‌نمایش پنل']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'xp' && (
        <>
          <div className="clay-in"><h3>XP کل <small className="muted">(روی لول اثر دارد)</small></h3>
            <div className="row"><input type="number" min="0" value={xp} onChange={(e) => setXp(e.target.value)} /><button className="btn small" onClick={saveXp}>ذخیره</button></div></div>
          <div className="clay-in"><h3>مهارت‌ها</h3>
            {skills.length === 0 && <small className="muted">مهارتی ثبت نشده.</small>}
            {skills.map((s) => (
              <div className="row" key={s.id}>
                <input value={s.name} onChange={(e) => editSkill(s.id, 'name', e.target.value)} />
                <input type="number" value={s.xp} onChange={(e) => editSkill(s.id, 'xp', e.target.value)} style={{ maxWidth: 110 }} />
                <button className="btn small" onClick={() => saveSkill(s)}><Icon n="check" size={16} /></button>
                <button className="btn small danger" onClick={() => delSkill(s.id)}><Icon n="trash" size={16} /></button>
              </div>
            ))}
            <div className="row"><input placeholder="مهارت جدید..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSkill()} /><button className="btn small" onClick={addSkill}><Icon n="plus" size={16} /> افزودن</button></div>
          </div>
        </>
      )}
      {tab === 'act' && (
        <div className="clay-in"><h3>فعالیت ۷ روز اخیر</h3>
          <div className="days">{days.map((d) => (
            <label key={d.day}>{d.label}<input type="number" min="0" value={acts[d.day] ?? 0} onChange={(e) => setActs({ ...acts, [d.day]: e.target.value })} /></label>
          ))}</div>
          <button className="btn small" onClick={saveActs}>ذخیره نمودار</button></div>
      )}
      {tab === 'msg' && (
        <div className="clay-in"><h3>پیام برای {m.name}</h3>
          <textarea rows="4" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="متن پیام..." />
          <button className="btn small" onClick={sendMsg}><Icon n="send" size={16} /> ارسال پیام</button></div>
      )}
      {tab === 'view' && <Growth user={m} />}
    </div>
  );
}

function ReportsTab({ me, reports, reload }) {
  const [open, setOpen] = useState(null);
  const [keep, setKeep] = useState([]);   // گزارش‌هایی که باز شدن، تا وسط گفتگو ناپدید نشن
  const [filter, setFilter] = useState('pending');
  const shown = reports.filter((r) => filter === 'all' || r.status === 'pending' || keep.includes(r.id));
  const toggle = (id) => { setOpen(open === id ? null : id); setKeep((k) => (k.includes(id) ? k : [...k, id])); };
  return (
    <div>
      <div className="seg" style={{ maxWidth: 320 }}>
        <button className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>بررسی‌نشده</button>
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>همه</button>
      </div>
      {shown.length === 0 && <Empty icon="check" text={filter === 'pending' ? 'همه گزارش‌ها بررسی شده‌اند.' : 'گزارشی وجود ندارد.'} />}
      {shown.map((r) => (
        <div key={r.id} className="clay pad rep">
          <div className="row between"><div className="row"><Avatar name={r.user?.name} size={38} /><b>{r.user?.name}</b></div><small className="muted">{fmt(r.created_at)}</small></div>
          <p>{r.content}</p>
          <div className="row wrap">
            <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار'}{r.xp_awarded ? ` · +${r.xp_awarded} XP` : ''}</span>
            <button className="btn small ghost" onClick={() => toggle(r.id)}>پاسخ / گفتگو</button>
            {r.status === 'pending' && <button className="btn small" onClick={async () => { await sb.from('reports').update({ status: 'reviewed' }).eq('id', r.id); toast('علامت‌گذاری شد'); reload(); }}><Icon n="check" size={16} /> بررسی شد</button>}
          </div>
          {open === r.id && <Thread report={r} me={me} onSent={reload} />}
        </div>
      ))}
    </div>
  );
}

function TeamTab({ me, all, reload }) {
  const admins = all.filter((a) => a.role !== 'member');
  const upd = async (id, patch) => {
    await sb.from('profiles').update(patch).eq('id', id);
    // اگر ادمینی به عضو عادی تبدیل شد، افراد زیر نظرش بدون سرپرست می‌شوند
    if (patch.role === 'member') await sb.from('profiles').update({ supervisor_id: null }).eq('supervisor_id', id);
    toast('ذخیره شد'); reload();
  };
  const rows = all.filter((m) => m.id !== me.id);
  return (
    <div className="clay pad">
      <h3>نقش‌ها و سرپرستی</h3>
      <p className="muted">نقش هر عضو و ادمین سرپرست او را مشخص کنید.</p>
      <div className="tablewrap"><table>
        <thead><tr><th>نام</th><th>حوزه</th><th>نقش</th><th>سرپرست</th></tr></thead>
        <tbody>{rows.map((m) => (
          <tr key={m.id}>
            <td><b>{m.name}</b></td><td>{m.field}</td>
            <td>{m.role === 'super' ? <RoleBadge role="super" /> : <select value={m.role} onChange={(e) => upd(m.id, { role: e.target.value })}><option value="member">عضو</option><option value="admin">ادمین</option></select>}</td>
            <td><select value={m.supervisor_id || ''} onChange={(e) => upd(m.id, { supervisor_id: e.target.value || null })}>
              <option value="">بدون سرپرست</option>
              {admins.filter((a) => a.id !== m.id).map((a) => <option key={a.id} value={a.id}>{a.name} ({roleName[a.role]})</option>)}
            </select></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function FieldsTab() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const load = () => sb.from('fields').select('*').order('id').then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; const { error } = await sb.from('fields').insert({ name: name.trim() }); if (error) return toast('این حوزه قبلاً ثبت شده است', 'err'); setName(''); load(); toast('حوزه اضافه شد'); };
  return (
    <div className="clay pad narrow">
      <h3>حوزه‌های فعالیت (فرم ثبت‌نام)</h3>
      {list.map((f) => (
        <div className="row between fieldrow" key={f.id}><span>{f.name}</span>
          <button className="btn small danger" onClick={async () => { await sb.from('fields').delete().eq('id', f.id); load(); }}><Icon n="trash" size={16} /></button></div>
      ))}
      <div className="row"><input placeholder="حوزه جدید..." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="btn small" onClick={add}><Icon n="plus" size={16} /> افزودن</button></div>
    </div>
  );
}

export default function Admin({ me, onChange }) {
  const [tab, setTab] = useState('members');
  const [all, setAll] = useState([]);
  const [reports, setReports] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    const { data } = await sb.from('profiles').select(COLS).order('xp', { ascending: false });
    const everyone = data || [];
    setAll(everyone);
    const ids = everyone.filter((m) => canManage(me, m)).map((m) => m.id);
    if (!ids.length) return setReports([]);
    let rq = sb.from('reports').select('*, user:profiles!user_id(name)').order('created_at', { ascending: false });
    if (me.role !== 'super') rq = rq.in('user_id', ids);
    const r = await rq;
    setReports(r.data || []);
    onChange && onChange();
  };
  useEffect(() => { load(); }, []);

  const mine = all.filter((m) => canManage(me, m));
  const current = mine.find((m) => m.id === sel);
  const pending = reports.filter((r) => r.status === 'pending').length;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = reports.filter((r) => new Date(r.created_at) >= start).length;
  const list = mine.filter((m) => m.name.includes(q));
  const tabs = [['members', 'مدیریت اعضا'], ['reports', 'گزارش‌ها'], ...(me.role === 'super' ? [['team', 'نقش‌ها و سرپرستی']] : []), ['fields', 'حوزه‌های فعالیت']];

  return (
    <div>
      <div className="pagehead"><h2>پنل مدیریت</h2><RoleBadge role={me.role} /></div>
      <div className="tiles">
        <Tile icon="users" label={me.role === 'super' ? 'کل اعضا' : 'اعضای تحت سرپرستی'} value={nf(mine.length)} />
        <Tile icon="file" label="گزارش بررسی‌نشده" value={nf(pending)} />
        <Tile icon="trend" label="گزارش‌های امروز" value={nf(today)} />
        <Tile icon="zap" label="مجموع XP اعضا" value={nf(mine.reduce((t, m) => t + m.xp, 0))} />
      </div>
      <div className="seg" style={{ margin: '16px 0' }}>
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'reports' && pending > 0 && <i className="dot">{nf(pending)}</i>}</button>
        ))}
      </div>

      {tab === 'members' && (
        <div className="split">
          <div className="side">
            <div className="searchbox"><Icon n="search" size={18} /><input placeholder="جستجو..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {mine.length === 0 && <Empty icon="users" text="در حال حاضر عضوی تحت سرپرستی شما نیست. سوپر ادمین باید اعضا را به شما اختصاص دهد." />}
            {list.map((m) => (
              <div key={m.id} className={'clay mini ' + (sel === m.id ? 'active' : '')} onClick={() => { setSel(m.id); setTimeout(() => document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}>
                <Avatar name={m.name} size={40} /><div className="grow"><b>{m.name}</b><br /><small className="muted">{roleName[m.role]} · لول {nf(level(m.xp))}</small></div>
              </div>
            ))}
          </div>
          <div id="editor">{current ? <MemberEditor key={current.id} me={me} m={current} reload={load} /> : <Empty icon="user" text="یک عضو را از لیست انتخاب کنید." />}</div>
        </div>
      )}
      {tab === 'reports' && <ReportsTab me={me} reports={reports} reload={load} />}
      {tab === 'team' && me.role === 'super' && <TeamTab me={me} all={all} reload={load} />}
      {tab === 'fields' && <FieldsTab />}
    </div>
  );
}
