import { useEffect, useState } from 'react';
import { sb, PUBLIC_COLS, level, xpInto, fmt, fa2en, bumpToday, MIN_CHARS, REPORT_XP, nf, TIERS, tierOf, nextTier } from './db.js';
import { Modal, Avatar, Growth, Thread, RoleBadge, TierBadge, Icon, Ring, XpBar, Empty, Tile, MemberCard, CountUp, toast, celebrate } from './ui.jsx';

/* ---------- پروفایل عمومی یک عضو (وقتی روی کارتش کلیک می‌شود) ---------- */
export function MemberProfile({ m, rank }) {
  const lv = level(m.xp), t = tierOf(lv), nt = nextTier(lv);
  return (
    <div>
      <div className="mp-head" style={{ '--tc': t.c, '--tg': t.g }}>
        <Ring value={xpInto(m.xp)} max={1000} size={140} stroke={8}>
          <Avatar name={m.name} size={100} t={t} />
        </Ring>
        <div className="grow">
          <small className="tier en">{t.en}</small>
          <h2 className="mp-name">{m.name} <RoleBadge role={m.role} /></h2>
          <div className="tier-name">{t.name}</div>
          <p className="muted">{m.field} · {m.city} · {nf(m.age)} ساله</p>
          <div className="row wrap">
            <span className="chip big-chip"><span className="en">LV</span> {nf(lv)}</span>
            {rank && <span className="chip"><Icon n="trophy" size={14} /> رتبه {nf(rank)}</span>}
            <span className="chip"><Icon n="zap" size={14} /> {nf(m.xp)} XP</span>
          </div>
        </div>
      </div>
      <XpBar value={xpInto(m.xp)} />
      <small className="muted">
        {nf(1000 - xpInto(m.xp))} XP تا لول {nf(lv + 1)}{nt ? ` · ${nf(nt.min - lv)} لول تا رتبه «${nt.name}»` : ' · به بالاترین رتبه رسیده 🔥'}
      </small>
      <Growth user={m} />
    </div>
  );
}

/* ---------- پنل رشد من ---------- */
export function MyPanel({ user, go }) {
  const [rank, setRank] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    (async () => {
      const [a, c] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).gt('xp', user.xp),
        sb.from('admin_messages').select('*, sender:profiles!from_id(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      ]);
      setRank((a.count || 0) + 1); setMsg(c.data?.[0] || null);
    })();
  }, [user.xp]);
  const lv = level(user.xp), t = tierOf(lv), nt = nextTier(lv), into = xpInto(user.xp);
  return (
    <div>
      <div className="clay hud" style={{ '--tc': t.c, '--tg': t.g }}>
        <div className="hud-av">
          <Ring value={into} max={1000} size={176} stroke={10}><Avatar name={user.name} size={126} t={t} /></Ring>
          <span className="hud-lv"><small className="en">LV</small> <CountUp to={lv} dur={800} /></span>
        </div>
        <div className="grow">
          <small className="tier en">{t.en} · {t.name}</small>
          <h1 className="hello"><span className="glitch" data-text={user.name}>{user.name}</span></h1>
          <p className="muted">{user.field} · {user.city}</p>
          <XpBar value={into} height={18} />
          <div className="row between"><small className="muted">{nf(into)} / ۱٬۰۰۰ XP</small><small className="ok">{nf(1000 - into)} XP تا لول {nf(lv + 1)}</small></div>
          {nt && <small className="muted">{nf(nt.min - lv)} لول تا رتبه «{nt.name}» ({nt.en})</small>}
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => go('report')}><Icon n="file" size={16} /> ارسال گزارش</button>
            <span className="chip"><Icon n="trophy" size={14} /> رتبه {rank ? nf(rank) : '...'}</span>
            <span className="chip"><Icon n="zap" size={14} /> <CountUp to={user.xp} /> XP</span>
          </div>
        </div>
      </div>
      {msg && (
        <div className="clay pad msgcard" onClick={() => go('msgs')}>
          <Icon n="mail" size={22} />
          <div className="grow"><b>آخرین پیام از {msg.sender?.name}</b><p className="clip">{msg.content}</p></div>
        </div>
      )}
      <Growth user={user} mine go={go} />
    </div>
  );
}

/* ---------- پنل اعضا ---------- */
export function Members() {
  const [list, setList] = useState(null);
  const [skills, setSkills] = useState({});
  const [q, setQ] = useState('');
  const [fld, setFld] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState('xp');
  const [view, setView] = useState('cards');
  const [sel, setSel] = useState(null);
  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        sb.from('profiles').select(PUBLIC_COLS).order('xp', { ascending: false }),
        sb.from('skills').select('id,user_id,name,xp'),
      ]);
      const g = {}; (s.data || []).forEach((x) => (g[x.user_id] = [...(g[x.user_id] || []), x]));
      setSkills(g); setList(p.data || []);
    })();
  }, []);
  if (!list) return <div className="skeleton" />;

  const rank = {}; list.forEach((m, i) => (rank[m.id] = i + 1));
  const fields = [...new Set(list.map((m) => m.field).filter(Boolean))];
  const tiers = TIERS.filter((t) => list.some((m) => tierOf(level(m.xp)).en === t.en));
  const totalXp = list.reduce((t, m) => t + m.xp, 0);
  const avgLv = list.length ? Math.round(list.reduce((t, m) => t + level(m.xp), 0) / list.length) : 0;

  let shown = list.filter((m) => (!fld || m.field === fld) && (!tier || tierOf(level(m.xp)).en === tier) && (m.name + (m.city || '')).includes(q));
  if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  if (sort === 'new') shown = [...shown].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const hallOn = !q && !fld && !tier && sort === 'xp' && list.length >= 3;
  const hall = hallOn ? [list[1], list[0], list[2]] : null;
  const grid = hallOn ? shown.slice(3) : shown;

  return (
    <div>
      <div className="pagehead"><h2>پنل اعضا</h2><span className="chip">{nf(list.length)} عضو فعال</span></div>
      <div className="tiles">
        <Tile icon="users" label="اعضای گرولند" value={nf(list.length)} />
        <Tile icon="zap" label="مجموع XP جامعه" value={nf(totalXp)} />
        <Tile icon="star" label="میانگین لول" value={nf(avgLv)} />
        <Tile icon="trophy" label="قدرتمندترین" value={list[0]?.name || '—'} />
      </div>

      {hall && (
        <>
          <h3 className="sec-h">🏆 تالار افتخار</h3>
          <div className="hall">
            {hall.map((m) => <MemberCard key={m.id} m={m} rank={rank[m.id]} skills={skills[m.id]} onClick={() => setSel(m)} />)}
          </div>
        </>
      )}

      <div className="filters">
        <div className="searchbox"><Icon n="search" size={18} /><input placeholder="جستجوی اسم یا شهر..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="xp">بیشترین XP</option><option value="name">به ترتیب نام</option><option value="new">جدیدترین</option></select>
        <div className="seg viewseg"><button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>کارت</button><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>جدول</button></div>
      </div>
      <div className="chips">
        <span className={'chip pick ' + (!tier ? 'on' : '')} onClick={() => setTier('')}>همه رتبه‌ها</span>
        {tiers.map((t) => <span key={t.en} className={'chip pick ' + (tier === t.en ? 'on' : '')} style={{ '--tc': t.c }} onClick={() => setTier(tier === t.en ? '' : t.en)}>{t.name}</span>)}
      </div>
      <div className="chips">
        <span className={'chip pick ' + (!fld ? 'on' : '')} onClick={() => setFld('')}>همه حوزه‌ها</span>
        {fields.map((f) => <span key={f} className={'chip pick ' + (fld === f ? 'on' : '')} onClick={() => setFld(fld === f ? '' : f)}>{f}</span>)}
      </div>

      {shown.length === 0 ? <Empty icon="users" text="عضوی پیدا نشد." /> : view === 'cards' ? (
        grid.length > 0 && <div className="cards">{grid.map((m) => <MemberCard key={m.id} m={m} rank={rank[m.id]} skills={skills[m.id]} onClick={() => setSel(m)} />)}</div>
      ) : (
        <div className="clay pad tablewrap"><table className="lb">
          <thead><tr><th>رتبه</th><th>عضو</th><th>رتبه قدرت</th><th>حوزه</th><th>لول</th><th>XP</th></tr></thead>
          <tbody>{shown.map((m) => { const t = tierOf(level(m.xp)); return (
            <tr key={m.id} onClick={() => setSel(m)}>
              <td className="en">{nf(rank[m.id])}</td>
              <td><div className="row"><Avatar name={m.name} size={34} t={t} /><b>{m.name}</b> <RoleBadge role={m.role} /></div></td>
              <td><TierBadge t={t} /></td><td>{m.field}</td><td>{nf(level(m.xp))}</td>
              <td><div style={{ minWidth: 110 }}><XpBar value={xpInto(m.xp)} height={7} /><small className="muted">{nf(m.xp)}</small></div></td>
            </tr>); })}</tbody>
        </table></div>
      )}
      {sel && <Modal onClose={() => setSel(null)}><MemberProfile m={sel} rank={rank[sel.id]} /></Modal>}
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
    let up = null;
    if (earn) {
      const { data } = await sb.from('profiles').select('xp').eq('id', user.id).single();
      const old = data?.xp || 0;
      await sb.from('profiles').update({ xp: old + earn }).eq('id', user.id);
      if (level(old + earn) > level(old)) up = { level: level(old + earn), tierUp: tierOf(level(old + earn)).en !== tierOf(level(old)).en };
    }
    await bumpToday(user.id);
    setText(''); setBusy(false);
    if (earn) toast(`+${nf(earn)} XP ⚡`, 'xp'); else toast(`گزارش ثبت شد (برای XP حداقل ${nf(MIN_CHARS)} حرف لازمه)`);
    if (up) celebrate(up);
    load(); refresh();
  };
  const full = len >= MIN_CHARS;
  return (
    <div>
      <div className="pagehead"><h2>ارسال گزارش رشد</h2></div>
      <div className="split2">
        <div className="clay pad">
          <textarea rows="9" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="امروز چه کارهایی انجام دادی؟ چی یاد گرفتی؟ چه چالشی داشتی؟" />
          <div className="row between wrap">
            <div className="row"><Ring value={len} max={MIN_CHARS} size={54} stroke={6}><small className="tiny">{full ? '✓' : nf(len)}</small></Ring>
              <small className={full ? 'ok' : 'muted'}>{full ? `آماده‌ی دریافت ${nf(REPORT_XP)} XP` : `${nf(MIN_CHARS - len)} حرف دیگه تا ${nf(REPORT_XP)} XP`}</small></div>
            <button className={'btn ' + (full ? 'pulse' : '')} onClick={send} disabled={busy || len < 1}><Icon n="send" size={16} /> {full ? `ارسال و دریافت ${nf(REPORT_XP)} XP` : 'ارسال گزارش'}</button>
          </div>
        </div>
        <div className="clay pad tips">
          <h3>نکات یک گزارش قدرتمند</h3>
          <p>⚡ مشخص بنویس چه کاری انجام دادی</p><p>🎯 نتیجه و چیزی که یاد گرفتی رو بگو</p>
          <p>🧩 چالش‌ها و سوالاتت رو برای سرپرست بنویس</p><p>🔥 هر روز گزارش بده تا زنجیره‌ات نشکنه</p>
        </div>
      </div>
      <h3>گزارش‌های قبلی من</h3>
      {list === null ? <div className="skeleton" /> : list.length === 0 ? <Empty icon="file" text="هنوز گزارشی نفرستادی. اولین گزارشت رو بفرست!" /> : list.map((r) => (
        <div key={r.id} className="clay pad rep">
          <div className="row between"><small className="muted">{fmt(r.created_at)}</small>
            <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار بررسی'}{r.xp_awarded ? ` · +${nf(r.xp_awarded)} XP` : ''}</span></div>
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
  const t = tierOf(level(user.xp));
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
        <div className="clay pad center" style={{ '--tc': t.c, '--tg': t.g }}>
          <Avatar name={user.name} size={96} t={t} />
          <h2>{user.name}</h2><TierBadge t={t} /> <RoleBadge role={user.role} />
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
