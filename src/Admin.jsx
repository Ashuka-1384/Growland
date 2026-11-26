import { useEffect, useState } from 'react';
import { level, fmt, last7, roleName, nf, MAX_MSG_CHARS } from './db.js';
import * as api from './api.js';
import { useAction, useDebounced, usePaged, useQuery, invalidate } from './hooks.js';
import { useNotify } from './notify.jsx';
import { Avatar, Empty, ErrorState, Icon, LoadMore, Modal, RoleBadge, Tile, clickable } from './ui.jsx';
import { Growth, Thread } from './widgets.jsx';

/** صفحه‌ی باریک (موبایل/تبلت): ویرایشگر عضو به‌جای ستون کناری، به‌صورت صفحه‌ی کشویی باز می‌شود */
function useNarrow(px = 860) {
  const q = `(max-width:${px}px)`;
  const [n, setN] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const m = matchMedia(q);
    const f = () => setN(m.matches);
    f();
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [q]);
  return n;
}

/** تأیید حذف با گزینه‌ی «برگرداندن XP» (window.confirm چنین امکانی ندارد و روی PWA موبایل گاهی بسته می‌شود) */
function ConfirmDelete({ title, text, revokeLabel, onCancel, onConfirm, busy }) {
  const [revoke, setRevoke] = useState(true);
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); } };
    document.addEventListener('keydown', f, true);
    return () => document.removeEventListener('keydown', f, true);
  }, [onCancel]);
  return (
    <div className="overlay confirm" onClick={onCancel}>
      <div className="clay modal small" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        {revokeLabel && (
          <label className="check"><input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} /> <span>{revokeLabel}</span></label>
        )}
        <div className="row wrap" style={{ marginTop: 14 }}>
          <button type="button" className="btn danger" disabled={busy} onClick={() => onConfirm(revoke)}><Icon n="trash" size={16} /> {busy ? '...' : 'حذف'}</button>
          <button type="button" className="btn ghost" onClick={onCancel}>انصراف</button>
        </div>
      </div>
    </div>
  );
}

/** یک کارت گزارش (مشترک بین تب «گزارش‌ها» و گزارش‌های یک عضو) */
function ReportCard({ r, me, busy, selected, onSelect, onMark, onDelete, onChange, showUser = true }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'clay pad rep' + (selected ? ' picked' : '')}>
      <div className="row between wrap">
        <div className="row">
          {onSelect && <input type="checkbox" className="pick" aria-label="انتخاب گزارش" checked={!!selected} onChange={() => onSelect(r.id)} />}
          {showUser && <><Avatar name={r.user_name} size={38} /><b>{r.user_name}</b></>}
        </div>
        <small className="muted">{fmt(r.created_at)}</small>
      </div>
      <p>{r.content}</p>
      <div className="row wrap">
        <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار'}{r.xp_awarded ? ` · +${nf(r.xp_awarded)} XP` : ''}</span>
        <button type="button" className="btn small ghost" aria-expanded={open} onClick={() => setOpen(!open)}>پاسخ / گفتگو</button>
        {r.status === 'pending' && onMark && <button type="button" className="btn small" disabled={busy} onClick={() => onMark(r)}><Icon n="check" size={16} /> بررسی شد</button>}
        <button type="button" className="btn small danger" disabled={busy} onClick={() => onDelete(r)} aria-label="حذف گزارش"><Icon n="trash" size={16} /> حذف</button>
      </div>
      {open && <Thread report={{ id: r.id, user_id: r.user_id, status: r.status }} me={me} onSent={onChange} />}
    </div>
  );
}

/** گزارش‌های یک عضو (داخل ویرایشگر عضو) */
function MemberReports({ me, m, onChange, onDeleteAll }) {
  const [run, busy] = useAction();
  const [ask, setAsk] = useState(null);
  const paged = usePaged((offset, limit) => api.adminReports(me.id, 'all', offset, limit, { user: m.id }), [m.id, me.id], 10);
  const del = async (revoke) => {
    if (await run(() => api.deleteReports(me.id, [ask.id], revoke), { ok: 'گزارش حذف شد' })) { setAsk(null); paged.reload(); onChange(); }
  };
  return (
    <div className="clay-in">
      <div className="row between wrap"><h3>گزارش‌های {m.name}</h3>
        {paged.items.length > 0 && <button type="button" className="btn small danger" onClick={onDeleteAll} disabled={busy}><Icon n="trash" size={16} /> حذف همه</button>}
      </div>
      {paged.items.length === 0 && paged.loading && <div className="skeleton" />}
      {paged.items.length === 0 && !paged.loading && !paged.error && <Empty icon="file" text="گزارشی وجود ندارد." />}
      {paged.items.map((r) => <ReportCard key={r.id} r={r} me={me} busy={busy} showUser={false} onDelete={setAsk} onChange={() => { paged.reload(); onChange(); }} />)}
      <LoadMore paged={paged} />
      {ask && <ConfirmDelete title="حذف گزارش" text="این گزارش حذف می‌شود." revokeLabel={ask.xp_awarded ? `${nf(ask.xp_awarded)} XP و فعالیت این گزارش هم کم شود` : null} onCancel={() => setAsk(null)} onConfirm={del} busy={busy} />}
    </div>
  );
}

function XpLog({ userId, xp }) {
  const { data, error, reload } = useQuery(`xph:${userId}:${xp}`, () => api.xpHistory(userId, 15), { stale: 10000 });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <div className="skeleton" style={{ height: 70 }} />;
  if (!data.length) return <small className="muted">هنوز تغییری ثبت نشده است.</small>;
  return (
    <ul className="xplist">
      {data.map((e) => (
        <li key={e.id} className="row between">
          <div><b>{e.reason || 'تغییر XP'}</b><br /><small className="muted">{fmt(e.created_at)}{e.by?.name ? ` · ${e.by.name}` : ''}</small></div>
          <span className={e.delta >= 0 ? 'ok' : 'neg'} dir="ltr">{e.delta >= 0 ? '+' : '−'}{nf(Math.abs(e.delta))}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- ویرایشگر عضو ---------- */
function MemberEditor({ me, m, reload, onGone }) {
  const { toast } = useNotify();
  const [tab, setTab] = useState('xp');
  const [xp, setXp] = useState(String(m.xp));
  const [reason, setReason] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [msg, setMsg] = useState('');
  const [acts, setActs] = useState(null);
  const [skills, setSkills] = useState([]);
  const [run, busy] = useAction();
  const [ask, setAsk] = useState(null); // 'user' | 'reports'
  const sk = useQuery(`admin-skills:${m.id}`, () => api.growth(m.id), { stale: 0 });
  const days = sk.data?.today ? last7(sk.data.today) : [];

  // state فقط یک‌بار از props پر نمی‌شود: با تغییر XP عضو (بعد از reload) همگام می‌شود
  useEffect(() => { setXp(String(m.xp)); }, [m.xp]);
  useEffect(() => {
    if (!sk.data) return;
    setSkills(sk.data.skills);
    const o = {};
    sk.data.acts.forEach((r) => (o[r.day] = r.count));
    setActs({ base: o, edit: { ...o } });
  }, [sk.data]);

  const after = () => { invalidate('growth:'); sk.reload(); reload(); };

  const saveXp = async () => {
    const v = parseInt(xp, 10);
    if (!Number.isFinite(v) || v < 0) return toast('XP باید عددی غیرمنفی باشد', 'err');
    // expected = XP که ادمین دیده؛ اگر هم‌زمان عوض شده باشد سرور تعارض را گزارش می‌کند
    const out = await run(() => api.setXp(me.id, m.id, v, m.xp, reason), { ok: (r) => (r.delta === 0 ? 'تغییری ایجاد نشد' : 'XP ذخیره شد') });
    if (out) { setReason(''); after(); } else reload();
  };
  const addSkill = async () => {
    if (!newSkill.trim()) return;
    if (await run(() => api.addSkill(m.id, newSkill), { ok: 'مهارت اضافه شد' })) { setNewSkill(''); after(); }
  };
  const saveSkill = async (s) => { if (await run(() => api.saveSkill(s), { ok: 'مهارت ذخیره شد' })) after(); };
  const delSkill = async (s) => {
    if (!window.confirm(`مهارت «${s.name}» حذف شود؟`)) return;
    if (await run(() => api.deleteSkill(s.id), { ok: 'مهارت حذف شد' })) after();
  };
  const editSkill = (id, k, v) => setSkills(skills.map((s) => (s.id === id ? { ...s, [k]: v } : s)));

  const saveActs = async () => {
    // فقط روزهای تغییرکرده ارسال می‌شوند و سرور تعارض را تشخیص می‌دهد (نه بازنویسی کورکورانه)
    const changes = days
      .filter((d) => (parseInt(acts.edit[d.day], 10) || 0) !== (acts.base[d.day] || 0))
      .map((d) => ({ day: d.day, count: Math.max(0, parseInt(acts.edit[d.day], 10) || 0), expected: acts.base[d.day] || 0 }));
    if (!changes.length) return toast('تغییری برای ذخیره نیست');
    const out = await run(() => api.setActivity(me.id, m.id, changes));
    if (!out) return;
    if (out.conflicts?.length) toast('فعالیت چند روز هم‌زمان تغییر کرده بود؛ اطلاعات به‌روز شد. دوباره ویرایش کنید.', 'err');
    else toast('نمودار هفتگی ذخیره شد');
    after();
  };
  const sendMsg = async () => {
    if (!msg.trim()) return;
    if (await run(() => api.sendAdminMessage(me.id, m.id, msg.trim()), { ok: 'پیام ارسال شد' })) setMsg('');
  };
  const toggleActive = async () => {
    const to = !m.active;
    if (!window.confirm(to ? `حساب «${m.name}» دوباره فعال شود؟` : `حساب «${m.name}» غیرفعال شود؟ او دیگر نمی‌تواند وارد شود و در رتبه‌بندی دیده نمی‌شود.`)) return;
    if (await run(() => api.setActive(me.id, m.id, to), { ok: to ? 'حساب فعال شد' : 'حساب غیرفعال شد' })) { invalidate(''); reload(); }
  };
  const remove = async () => {
    if (await run(() => api.deleteUser(me.id, m.id), { ok: 'عضو حذف شد' })) { setAsk(null); invalidate(''); onGone(); }
  };
  const removeReports = async (revoke) => {
    const out = await run(() => api.deleteUserReports(me.id, m.id, revoke), { ok: (r) => `${nf(r?.deleted || 0)} گزارش حذف شد` });
    if (out) { setAsk(null); invalidate(''); after(); }
  };

  const canDelete = m.id !== me.id && (me.role === 'super' || (me.role === 'admin' && m.role === 'member'));
  const canDanger = m.role !== 'super' && m.id !== me.id;
  const tabs = [['xp', 'XP و مهارت‌ها'], ['act', 'فعالیت هفتگی'], ['msg', 'پیام'], ['reps', 'گزارش‌ها'], ['view', 'پیش‌نمایش پنل'], ...(canDanger ? [['danger', 'مدیریت حساب']] : [])];

  return (
    <div className="clay pad">
      <div className="mhead"><Avatar name={m.name} size={64} />
        <div><h2>{m.name} <RoleBadge role={m.role} />{!m.active && <span className="badge inactive">غیرفعال</span>}</h2>
          <p className="muted">{[m.field, m.city, m.age ? `${nf(m.age)} ساله` : '', m.phone].filter(Boolean).join(' · ')}</p>
          <span className="chip">لول {nf(level(m.xp))} · {nf(m.xp)} XP</span></div></div>
      {canDelete && (
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button type="button" className="btn small danger" onClick={() => setAsk('user')} disabled={busy}><Icon n="trash" size={16} /> حذف عضو</button>
        </div>
      )}
      <div className="seg" role="tablist" aria-label="بخش‌های ویرایش عضو" style={{ margin: '14px 0' }}>
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'xp' && (
        <>
          <div className="clay-in"><h3>XP کل <small className="muted">(روی لول اثر دارد و در تاریخچه ثبت می‌شود)</small></h3>
            <label htmlFor="ed-xp">مقدار XP</label>
            <input id="ed-xp" type="number" min="0" value={xp} onChange={(e) => setXp(e.target.value)} />
            <label htmlFor="ed-reason">دلیل تغییر (اختیاری)</label>
            <div className="row"><input id="ed-reason" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: پاداش پروژه" /><button type="button" className="btn small" onClick={saveXp} disabled={busy}>ذخیره</button></div></div>
          <div className="clay-in"><h3>تاریخچه XP</h3><XpLog userId={m.id} xp={m.xp} /></div>
          <div className="clay-in"><h3>مهارت‌ها</h3>
            {skills.length === 0 && <small className="muted">مهارتی ثبت نشده.</small>}
            {skills.map((s) => (
              <div className="row skillrow" key={s.id}>
                <input aria-label="نام مهارت" maxLength={60} value={s.name} onChange={(e) => editSkill(s.id, 'name', e.target.value)} />
                <input aria-label="XP مهارت" type="number" min="0" value={s.xp} onChange={(e) => editSkill(s.id, 'xp', e.target.value)} style={{ maxWidth: 110 }} />
                <button type="button" className="btn small" onClick={() => saveSkill(s)} disabled={busy} aria-label="ذخیره مهارت"><Icon n="check" size={16} /></button>
                <button type="button" className="btn small danger" onClick={() => delSkill(s)} disabled={busy} aria-label="حذف مهارت"><Icon n="trash" size={16} /></button>
              </div>
            ))}
            <div className="row skillnew"><input aria-label="مهارت جدید" maxLength={60} placeholder="مهارت جدید..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addSkill()} /><button type="button" className="btn small" onClick={addSkill} disabled={busy}><Icon n="plus" size={16} /> افزودن</button></div>
          </div>
        </>
      )}
      {tab === 'act' && (
        <div className="clay-in"><h3>فعالیت ۷ روز اخیر</h3>
          {!acts ? (sk.error ? <ErrorState error={sk.error} onRetry={sk.reload} /> : <div className="skeleton" />) : (
            <>
              <div className="days">{days.map((d) => (
                <label key={d.day}>{d.label}<input type="number" min="0" value={acts.edit[d.day] ?? 0} onChange={(e) => setActs({ ...acts, edit: { ...acts.edit, [d.day]: e.target.value } })} /></label>
              ))}</div>
              <button type="button" className="btn small" onClick={saveActs} disabled={busy}>ذخیره تغییرات</button>
            </>
          )}</div>
      )}
      {tab === 'msg' && (
        <div className="clay-in"><h3>پیام برای {m.name}</h3>
          <textarea rows="4" maxLength={MAX_MSG_CHARS} aria-label="متن پیام" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="متن پیام..." />
          <button type="button" className="btn small" onClick={sendMsg} disabled={busy || !msg.trim()}><Icon n="send" size={16} /> ارسال پیام</button></div>
      )}
      {tab === 'reps' && <MemberReports me={me} m={m} onChange={() => { invalidate(''); after(); }} onDeleteAll={() => setAsk('reports')} />}
      {tab === 'view' && <Growth user={m} />}
      {tab === 'danger' && (
        <div className="clay-in">
          <h3>مدیریت حساب</h3>
          <p className="muted">غیرفعال‌کردن، حساب را از رتبه‌بندی و ورود حذف می‌کند ولی اطلاعات می‌ماند و قابل بازگشت است.</p>
          <button type="button" className="btn small" onClick={toggleActive} disabled={busy}>{m.active ? 'غیرفعال‌کردن حساب' : 'فعال‌کردن حساب'}</button>
          {canDelete && (
            <>
              <p className="muted" style={{ marginTop: 16 }}>حذف دائمی (مثلاً حساب تست یا اسپم) همه‌ی اطلاعات این عضو را پاک می‌کند.</p>
              <button type="button" className="btn small danger" onClick={() => setAsk('user')} disabled={busy}><Icon n="trash" size={16} /> حذف دائمی عضو</button>
            </>
          )}
        </div>
      )}
      {ask === 'user' && <ConfirmDelete title={`حذف «${m.name}»`} text="این عضو برای همیشه حذف می‌شود، همراه با گزارش‌ها، مهارت‌ها و پیام‌هایش. این کار برگشت‌پذیر نیست." onCancel={() => setAsk(null)} onConfirm={remove} busy={busy} />}
      {ask === 'reports' && <ConfirmDelete title={`حذف همه‌ی گزارش‌های «${m.name}»`} text="همه‌ی گزارش‌های این عضو حذف می‌شود." revokeLabel="XP و فعالیتی که این گزارش‌ها داده‌اند هم کم شود" onCancel={() => setAsk(null)} onConfirm={removeReports} busy={busy} />}
    </div>
  );
}

/* ---------- گزارش‌ها ---------- */
function ReportsTab({ me, onChange }) {
  const [filter, setFilter] = useState('pending');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [sel, setSel] = useState(() => new Set());
  const [ask, setAsk] = useState(null); // { ids, xp }
  const [run, busy] = useAction();
  const paged = usePaged((offset, limit) => api.adminReports(me.id, filter, offset, limit, { q: dq }), [filter, dq, me.id], 20);
  useEffect(() => { setSel(new Set()); }, [filter, dq]);
  const mark = async (r) => { if (await run(() => api.markReviewed(me.id, r.id), { ok: 'علامت‌گذاری شد' })) { paged.reload(); onChange(); } };
  const toggle = (id) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = paged.items.length > 0 && paged.items.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(paged.items.map((r) => r.id)));
  const xpOf = (ids) => paged.items.filter((r) => ids.includes(r.id)).reduce((t, r) => t + (r.xp_awarded || 0), 0);
  const askDelete = (ids) => setAsk({ ids, xp: xpOf(ids) });
  const del = async (revoke) => {
    const out = await run(() => api.deleteReports(me.id, ask.ids, revoke), { ok: (r) => `${nf(r?.deleted || 0)} گزارش حذف شد` });
    if (out) { setAsk(null); setSel(new Set()); invalidate(''); paged.reload(); onChange(); }
  };
  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="فیلتر وضعیت">
          <button type="button" aria-pressed={filter === 'pending'} className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>بررسی‌نشده</button>
          <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>همه</button>
        </div>
        <div className="searchbox"><Icon n="search" size={18} /><input aria-label="جستجو در گزارش‌ها" placeholder="جستجوی نام عضو یا متن گزارش..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {paged.items.length > 0 && (
        <div className="row wrap bulkbar">
          <label className="check"><input type="checkbox" checked={allOn} onChange={toggleAll} /> <span>انتخاب همه</span></label>
          {sel.size > 0 && <button type="button" className="btn small danger" disabled={busy} onClick={() => askDelete([...sel])}><Icon n="trash" size={16} /> حذف {nf(sel.size)} گزارش انتخاب‌شده</button>}
        </div>
      )}
      {paged.items.length === 0 && paged.loading && <div className="skeleton" />}
      {paged.items.length === 0 && !paged.loading && !paged.error && <Empty icon="check" text={dq ? 'گزارشی پیدا نشد.' : filter === 'pending' ? 'همه گزارش‌ها بررسی شده‌اند.' : 'گزارشی وجود ندارد.'} />}
      {paged.items.map((r) => (
        <ReportCard key={r.id} r={r} me={me} busy={busy} selected={sel.has(r.id)} onSelect={toggle} onMark={mark} onDelete={(x) => askDelete([x.id])} onChange={() => { paged.reload(); onChange(); }} />
      ))}
      <LoadMore paged={paged} />
      {ask && <ConfirmDelete title={ask.ids.length > 1 ? `حذف ${nf(ask.ids.length)} گزارش` : 'حذف گزارش'} text="گزارش‌های انتخاب‌شده برای همیشه حذف می‌شوند." revokeLabel={ask.xp ? `${nf(ask.xp)} XP و فعالیت این گزارش‌ها هم کم شود` : null} onCancel={() => setAsk(null)} onConfirm={del} busy={busy} />}
    </div>
  );
}

/* ---------- نقش‌ها و سرپرستی ---------- */
function TeamTab({ me }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const { data: admins, reload: reloadAdmins } = useQuery('admin-candidates', api.adminCandidates, { stale: 0 });
  const paged = usePaged((offset, limit) => api.adminMembers(me, { q: dq, offset, limit }), [dq, me.id], 30);
  const [run, busy] = useAction();
  const upd = async (id, patch) => {
    // نقش و سرپرست در یک update اتمیک تغییر می‌کنند؛ آزادسازی زیرمجموعه‌ها و جلوگیری از حلقه با تریگر دیتابیس انجام می‌شود
    if (await run(() => api.updateMember(id, patch), { ok: 'ذخیره شد' })) { invalidate(''); reloadAdmins(); }
    paged.reload();
  };
  const rows = paged.items.filter((m) => m.id !== me.id);
  return (
    <div className="clay pad">
      <h3>نقش‌ها و سرپرستی</h3>
      <p className="muted">نقش هر عضو و ادمین سرپرست او را مشخص کنید.</p>
      <div className="searchbox"><Icon n="search" size={18} /><input aria-label="جستجوی عضو" placeholder="جستجو..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th scope="col">نام</th><th scope="col">حوزه</th><th scope="col">نقش</th><th scope="col">سرپرست</th></tr></thead>
        <tbody>{rows.map((m) => (
          <tr key={m.id}>
            <td data-label="نام"><b>{m.name}</b>{!m.active && <span className="badge inactive">غیرفعال</span>}</td><td data-label="حوزه">{m.field || '—'}</td>
            <td data-label="نقش"><select aria-label={`نقش ${m.name}`} disabled={busy} value={m.role} onChange={(e) => upd(m.id, { role: e.target.value })}><option value="member">عضو</option><option value="admin">ادمین</option><option value="super">سوپر ادمین</option></select></td>
            <td data-label="سرپرست"><select aria-label={`سرپرست ${m.name}`} disabled={busy} value={m.supervisor_id || ''} onChange={(e) => upd(m.id, { supervisor_id: e.target.value || null })}>
              <option value="">بدون سرپرست</option>
              {(admins || []).filter((a) => a.id !== m.id).map((a) => <option key={a.id} value={a.id}>{a.name} ({roleName[a.role]})</option>)}
            </select></td>
          </tr>
        ))}</tbody>
      </table></div>
      {rows.length === 0 && !paged.loading && !paged.error && <Empty icon="users" text="عضوی پیدا نشد." />}
      <LoadMore paged={paged} />
    </div>
  );
}

/* ---------- حوزه‌ها (افزودن، تغییر نام، حذف) ---------- */
function FieldsTab() {
  const { data: list, error, reload } = useQuery('fields', api.listFields, { stale: 0 });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [run, busy] = useAction();
  const done = () => { invalidate('fields'); invalidate('stats'); reload(); };
  const add = async () => {
    if (!name.trim()) return;
    if (await run(() => api.addField(name), { ok: 'حوزه اضافه شد' })) { setName(''); done(); }
  };
  const rename = async () => {
    if (!editing?.name.trim()) return;
    if (await run(() => api.renameField(editing.id, editing.name), { ok: 'نام حوزه تغییر کرد (برای همه اعضا اعمال شد)' })) { setEditing(null); done(); }
  };
  const del = async (f) => {
    const n = await run(() => api.fieldUsage(f.name));
    if (n === undefined) return;
    if (!window.confirm(n ? `${nf(n)} عضو در حوزه «${f.name}» هستند و بدون حوزه می‌شوند. حذف شود؟` : `حوزه «${f.name}» حذف شود؟`)) return;
    if (await run(() => api.deleteField(f.id), { ok: 'حوزه حذف شد' })) done();
  };
  return (
    <div className="clay pad narrow">
      <h3>حوزه‌های فعالیت (فرم ثبت‌نام)</h3>
      {error && !list && <ErrorState error={error} onRetry={reload} />}
      {(list || []).map((f) => (
        <div className="row between fieldrow" key={f.id}>
          {editing?.id === f.id ? (
            <>
              <input aria-label="نام جدید حوزه" maxLength={60} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && rename()} />
              <button type="button" className="btn small" onClick={rename} disabled={busy} aria-label="ذخیره نام"><Icon n="check" size={16} /></button>
              <button type="button" className="btn small ghost" onClick={() => setEditing(null)} aria-label="انصراف"><Icon n="close" size={16} /></button>
            </>
          ) : (
            <>
              <span>{f.name}</span>
              <span className="row">
                <button type="button" className="btn small ghost" onClick={() => setEditing({ id: f.id, name: f.name })} aria-label={`تغییر نام ${f.name}`}><Icon n="edit" size={16} /></button>
                <button type="button" className="btn small danger" onClick={() => del(f)} disabled={busy} aria-label={`حذف ${f.name}`}><Icon n="trash" size={16} /></button>
              </span>
            </>
          )}
        </div>
      ))}
      <div className="row"><input aria-label="حوزه جدید" maxLength={60} placeholder="حوزه جدید..." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && add()} /><button type="button" className="btn small" onClick={add} disabled={busy}><Icon n="plus" size={16} /> افزودن</button></div>
    </div>
  );
}

export default function Admin({ me, sub, onSub, onChange }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const dq = useDebounced(q, 300);
  const tab = ['members', 'reports', 'team', 'fields'].includes(sub) ? sub : 'members';
  const narrow = useNarrow(860);
  const counts = useQuery(`admin-counts:${me.id}`, () => api.adminCounts(me.id), { stale: 15000 });
  const paged = usePaged((offset, limit) => api.adminMembers(me, { q: dq, offset, limit }), [dq, me.id], 30);
  const c = counts.data || { members: 0, pending: 0, today: 0, xp: 0 };

  const reloadAll = () => { counts.reload(); paged.reload(); onChange && onChange(); };
  const current = paged.items.find((m) => m.id === sel);
  const tabs = [['members', 'مدیریت اعضا'], ['reports', 'گزارش‌ها'], ...(me.role === 'super' ? [['team', 'نقش‌ها و سرپرستی']] : []), ['fields', 'حوزه‌های فعالیت']];

  return (
    <div>
      <div className="pagehead"><h2>پنل مدیریت</h2><RoleBadge role={me.role} /></div>
      {counts.error && <ErrorState error={counts.error} onRetry={counts.reload} />}
      <div className="tiles">
        <Tile icon="users" label={me.role === 'super' ? 'کل اعضا' : 'اعضای تحت سرپرستی'} value={nf(c.members)} />
        <Tile icon="file" label="گزارش بررسی‌نشده" value={nf(c.pending)} />
        <Tile icon="trend" label="گزارش‌های امروز" value={nf(c.today)} />
        <Tile icon="zap" label="مجموع XP اعضا" value={nf(c.xp)} />
      </div>
      <div className="seg" role="tablist" aria-label="بخش‌های مدیریت" style={{ margin: '16px 0' }}>
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onSub(k)}>{l}{k === 'reports' && c.pending > 0 && <i className="dot">{nf(c.pending)}</i>}</button>
        ))}
      </div>

      {tab === 'members' && (
        <div className="split">
          <div className="side">
            <div className="searchbox"><Icon n="search" size={18} /><input aria-label="جستجوی عضو" placeholder="جستجو..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {paged.items.length === 0 && !paged.loading && !paged.error && <Empty icon="users" text={dq ? 'عضوی پیدا نشد.' : 'در حال حاضر عضوی تحت سرپرستی شما نیست. سوپر ادمین باید اعضا را به شما اختصاص دهد.'} />}
            {paged.items.length === 0 && paged.loading && <div className="skeleton" />}
            {paged.items.map((m) => (
              <div key={m.id} className={'clay mini ' + (sel === m.id ? 'active' : '') + (m.active ? '' : ' off')} aria-pressed={sel === m.id}
                {...clickable(() => { setSel(m.id); if (!narrow) setTimeout(() => document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); })}>
                <Avatar name={m.name} size={40} /><div className="grow"><b>{m.name}</b><br /><small className="muted">{roleName[m.role]} · لول {nf(level(m.xp))}{m.active ? '' : ' · غیرفعال'}</small></div>
              </div>
            ))}
            <LoadMore paged={paged} />
          </div>
          {!narrow && <div id="editor">{current ? <MemberEditor key={current.id} me={me} m={current} reload={reloadAll} onGone={() => { setSel(null); reloadAll(); }} /> : <Empty icon="user" text="یک عضو را از لیست انتخاب کنید." />}</div>}
          {narrow && current && (
            <Modal onClose={() => setSel(null)} label="ویرایش عضو">
              <MemberEditor key={current.id} me={me} m={current} reload={reloadAll} onGone={() => { setSel(null); reloadAll(); }} />
            </Modal>
          )}
        </div>
      )}
      {tab === 'reports' && <ReportsTab me={me} onChange={reloadAll} />}
      {tab === 'team' && me.role === 'super' && <TeamTab me={me} />}
      {tab === 'fields' && <FieldsTab />}
    </div>
  );
}
