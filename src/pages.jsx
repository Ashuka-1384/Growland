import { useEffect, useState } from 'react';
import { sb, PUBLIC_COLS, level, xpInto, fmt, fa2en, bumpToday, MIN_CHARS, REPORT_XP, nf } from './db.js';
import { Modal, Avatar, Growth, Thread, RoleBadge, Icon, Ring, Empty, Tile, toast } from './ui.jsx';

/* ---------- پنل رشد من ---------- */
export function MyPanel({ user, go }) {
  const [rank, setRank] = useState(null);
  const [reports, setReports] = useState(0);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).gt('xp', user.xp),
        sb.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        sb.from('admin_messages').select('*, sender:profiles!from_id(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      ]);
      setRank((a.count || 0) + 1); setReports(b.count || 0); setMsg(c.data?.[0] || null);
    })();
  }, [user.xp]);
  const lv = level(user.xp), into = xpInto(user.xp);
  return (
    <div>
      <div className="clay herocard">
        <Ring value={into} max={1000} size={150} stroke={14}><small>لول</small><b className="big-n">{nf(lv)}</b></Ring>
        <div className="grow">
          <h1 className="hello">سلام {user.name} 👋</h1>
          <p className="muted">{user.field} · {user.city}</p>
          <div className="bar tall"><div style={{ width: into / 10 + '%' }} /></div>
          <small className="muted">{nf(into)} از ۱٬۰۰۰ XP برای لول بعدی</small>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => go('report')}><Icon n="file" size={16} /> ارسال گزارش</button>
            <span className="chip"><Icon n="trophy" size={14} /> رتبه {rank ? nf(rank) : '...'}</span>
            <span className="chip"><Icon n="file" size={14} /> {nf(reports)} گزارش</span>
          </div>
        </div>
      </div>
      {msg && (
        <div className="clay pad msgcard" onClick={() => go('msgs')}>
          <Icon n="mail" size={22} />
          <div className="grow"><b>آخرین پیام از {msg.sender?.name}</b><p className="clip">{msg.content}</p></div>
        </div>
      )}
      <Growth user={user} />
    </div>
  );
}

/* ---------- اعضا ---------- */
export function Members() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [fld, setFld] = useState('');
  const [sort, setSort] = useState('xp');
  const [sel, setSel] = useState(null);
  useEffect(() => { sb.from('profiles').select(PUBLIC_COLS).order('xp', { ascending: false }).then(({ data }) => setList(data || [])); }, []);
  if (!list) return <div className="skeleton" />;
  const fields = [...new Set(list.map((m) => m.field).filter(Boolean))];
  let shown = list.filter((m) => (!fld || m.field === fld) && (m.name + (m.city || '')).includes(q));
  if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  if (sort === 'new') shown = [...shown].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const podium = !q && !fld && sort === 'xp' && list.length >= 3 ? [list[1], list[0], list[2]] : null;
  return (
    <div>
      <div className="pagehead"><h2>اعضای گرولند</h2><span className="chip">{nf(list.length)} عضو</span></div>
      {podium && (
        <div className="podium">
          {podium.map((m, i) => {
            const pos = [2, 1, 3][i];
            return (
              <div key={m.id} className={'clay pod p' + pos} onClick={() => setSel(m)}>
                <div className="crown">{pos === 1 ? '👑' : pos === 2 ? '🥈' : '🥉'}</div>
                <Avatar name={m.name} size={pos === 1 ? 74 : 60} />
                <b>{m.name}</b><small className="muted">لول {nf(level(m.xp))} · {nf(m.xp)} XP</small>
              </div>
            );
          })}
        </div>
      )}
      <div className="filters">
        <div className="searchbox"><Icon n="search" size={18} /><input placeholder="جستجوی اسم یا شهر..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="xp">بیشترین XP</option><option value="name">به ترتیب نام</option><option value="new">جدیدترین</option></select>
      </div>
      <div className="chips">
        <span className={'chip pick ' + (!fld ? 'on' : '')} onClick={() => setFld('')}>همه</span>
        {fields.map((f) => <span key={f} className={'chip pick ' + (fld === f ? 'on' : '')} onClick={() => setFld(f)}>{f}</span>)}
      </div>
      {shown.length === 0 ? <Empty icon="users" text="عضوی پیدا نشد." /> : (
        <div className="cards">
          {shown.map((m) => (
            <div key={m.id} className="clay card" onClick={() => setSel(m)}>
              <Avatar name={m.name} size={64} />
              <h3>{m.name} <RoleBadge role={m.role} /></h3>
              <p className="muted">{m.field} · {m.city} · {nf(m.age)} ساله</p>
              <div className="bar"><div style={{ width: xpInto(m.xp) / 10 + '%' }} /></div>
              <div className="row between cardfoot"><span className="chip">لول {nf(level(m.xp))}</span><small className="muted">{nf(m.xp)} XP</small></div>
            </div>
          ))}
        </div>
      )}
      {sel && (
        <Modal onClose={() => setSel(null)}>
          <div className="mhead"><Avatar name={sel.name} size={72} />
            <div><h2>{sel.name} <RoleBadge role={sel.role} /></h2><p className="muted">{sel.field} · {sel.city} · {nf(sel.age)} ساله · لول {nf(level(sel.xp))}</p></div></div>
          <Growth user={sel} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- ارسال گزارش ---------- */
export function SubmitReport({ user, refresh }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await sb.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, []);
  const len = text.trim().length;
  const send = async () => {
    if (len < 1 || busy) return;
    setBusy(true);
    const earn = len >= MIN_CHARS ? REPORT_XP : 0;
    const { error } = await sb.from('reports').insert({ user_id: user.id, content: text.trim(), xp_awarded: earn });
    if (error) { setBusy(false); return toast('خطا: ' + error.message, 'err'); }
    let up = 0;
    if (earn) {
      const { data } = await sb.from('profiles').select('xp').eq('id', user.id).single();
      const old = data?.xp || 0;
      await sb.from('profiles').update({ xp: old + earn }).eq('id', user.id);
      if (level(old + earn) > level(old)) up = level(old + earn);
    }
    await bumpToday(user.id);
    setText(''); setBusy(false);
    toast(up ? `🎉 تبریک! به لول ${nf(up)} رسیدی` : earn ? `گزارش ثبت شد و ${earn} XP گرفتی 🎉` : `گزارش ثبت شد (برای XP حداقل ${MIN_CHARS} حرف لازمه)`);
    load(); refresh();
  };
  return (
    <div>
      <div className="pagehead"><h2>ارسال گزارش رشد</h2></div>
      <div className="split2">
        <div className="clay pad">
          <textarea rows="9" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="امروز چه کارهایی انجام دادی؟ چی یاد گرفتی؟ چه چالشی داشتی؟" />
          <div className="row between">
            <div className="row"><Ring value={len} max={MIN_CHARS} size={52} stroke={6}><small className="tiny">{len >= MIN_CHARS ? '✓' : nf(len)}</small></Ring>
              <small className={len >= MIN_CHARS ? 'ok' : 'muted'}>{len >= MIN_CHARS ? `عالیه! ${REPORT_XP} XP می‌گیری` : `${nf(MIN_CHARS - len)} حرف دیگه تا ${REPORT_XP} XP`}</small></div>
            <button className="btn" onClick={send} disabled={busy || len < 1}><Icon n="send" size={16} /> ارسال گزارش</button>
          </div>
        </div>
        <div className="clay pad tips">
          <h3>نکات یک گزارش خوب</h3>
          <p>✔️ مشخص بنویس چه کاری انجام دادی</p><p>✔️ نتیجه و چیزی که یاد گرفتی رو بگو</p>
          <p>✔️ چالش‌ها و سوالاتت رو برای سرپرست بنویس</p><p>✔️ حداقل {nf(MIN_CHARS)} حرف تا XP بگیری</p>
        </div>
      </div>
      <h3>گزارش‌های قبلی من</h3>
      {list === null ? <div className="skeleton" /> : list.length === 0 ? <Empty icon="file" text="هنوز گزارشی نفرستادی." /> : list.map((r) => (
        <div key={r.id} className="clay pad rep">
          <div className="row between"><small className="muted">{fmt(r.created_at)}</small>
            <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار بررسی'}{r.xp_awarded ? ` · +${r.xp_awarded} XP` : ''}</span></div>
          <p>{r.content}</p>
          <button className="btn small ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'بستن گفتگو' : 'گفتگو با ادمین'}</button>
          {open === r.id && <Thread report={r} me={user} />}
        </div>
      ))}
    </div>
  );
}

/* ---------- پیام ادمین ---------- */
export function AdminMessages({ user }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    sb.from('admin_messages').select('*, sender:profiles!from_id(name)').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => setList(data || []));
  }, []);
  return (
    <div>
      <div className="pagehead"><h2>پیام ادمین</h2></div>
      {list === null ? <div className="skeleton" /> : list.length === 0 ? <Empty icon="mail" text="هنوز پیامی نداری." /> : list.map((m) => (
        <div key={m.id} className="clay pad rep row top">
          <Avatar name={m.sender?.name} size={44} />
          <div className="grow"><div className="row between"><b>{m.sender?.name}</b><small className="muted">{fmt(m.created_at)}</small></div><p>{m.content}</p></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- پروفایل ---------- */
export function Profile({ user, refresh }) {
  const [fields, setFields] = useState([]);
  const [sup, setSup] = useState('');
  const [f, setF] = useState({ name: user.name, age: user.age || '', city: user.city || '', phone: user.phone, password: user.password, field: user.field || '' });
  useEffect(() => {
    sb.from('fields').select('*').order('id').then(({ data }) => setFields(data || []));
    if (user.supervisor_id) sb.from('profiles').select('name').eq('id', user.supervisor_id).maybeSingle().then(({ data }) => setSup(data?.name || ''));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const phone = fa2en(f.phone), age = parseInt(fa2en(f.age), 10);
    if (!/^09\d{9}$/.test(phone) || !f.name.trim() || !f.password || !(age > 0)) return toast('اطلاعات را درست وارد کن', 'err');
    const { error } = await sb.from('profiles').update({ name: f.name.trim(), age, city: f.city.trim(), phone, password: f.password, field: f.field }).eq('id', user.id);
    if (error) return toast(error.code === '23505' ? 'این شماره برای شخص دیگری است' : error.message, 'err');
    toast('اطلاعات ذخیره شد ✓'); refresh();
  };
  return (
    <div>
      <div className="pagehead"><h2>پروفایل</h2></div>
      <div className="split2">
        <div className="clay pad center">
          <Avatar name={user.name} size={96} />
          <h2>{user.name}</h2><RoleBadge role={user.role} />
          <p className="muted">{user.field} · {user.city}</p>
          <div className="tiles two"><Tile icon="zap" label="XP" value={nf(user.xp)} /><Tile icon="star" label="لول" value={nf(level(user.xp))} /></div>
          {sup && <p className="muted">سرپرست شما: <b>{sup}</b></p>}
        </div>
        <div className="clay pad">
          <h3>ویرایش اطلاعات حساب</h3>
          <label>اسم</label><input value={f.name} onChange={set('name')} />
          <div className="row"><div className="grow"><label>سن</label><input value={f.age} onChange={set('age')} /></div><div className="grow"><label>شهر</label><input value={f.city} onChange={set('city')} /></div></div>
          <label>شماره موبایل</label><input value={f.phone} onChange={set('phone')} />
          <label>رمز عبور</label><input value={f.password} onChange={set('password')} />
          <label>حوزه فعالیت</label>
          <select value={f.field} onChange={set('field')}>{[...new Set([f.field, ...fields.map((x) => x.name)])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}</select>
          <button className="btn" onClick={save}><Icon n="check" size={16} /> ذخیره تغییرات</button>
        </div>
      </div>
    </div>
  );
}
