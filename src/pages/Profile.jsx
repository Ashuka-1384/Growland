import { useState } from 'react';
import { level, nf, tierOf, validateProfile } from '../db.js';
import * as api from '../api.js';
import { useAction, useQuery } from '../hooks.js';
import { useNotify } from '../notify.jsx';
import { PushToggle } from '../PwaBits.jsx';
import { Avatar, Field, Icon, RoleBadge, Tile, TierBadge } from '../ui.jsx';

/* ---------- پروفایل ---------- */
export default function Profile({ user, refresh }) {
  const { data: fields } = useQuery('fields', api.listFields, { stale: 60000 });
  const { data: sup } = useQuery(`sup:${user.supervisor_id}`, () => api.memberById(user.supervisor_id), { enabled: !!user.supervisor_id, stale: 60000 });
  const [run, busy] = useAction();
  const { toast } = useNotify();
  // رمز عبور هرگز از سرور خوانده نمی‌شود؛ خالی‌گذاشتن یعنی «بدون تغییر»
  const [f, setF] = useState({ name: user.name, age: user.age || '', city: user.city || '', phone: user.phone, password: '', field: user.field || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const t = tierOf(level(user.xp));
  const names = [...new Set([f.field, ...(fields || []).map((x) => x.name)])].filter(Boolean);

  const save = async () => {
    const msg = validateProfile(f, { needPassword: false });
    if (msg) { toast(msg, 'err'); return; }
    const ok = await run(() => api.updateProfile(user.id, f), { ok: 'اطلاعات ذخیره شد' });
    if (ok) { setF((x) => ({ ...x, password: '' })); refresh(); }
  };
  return (
    <div>
      <div className="pagehead"><h2>پروفایل</h2></div>
      <div className="split2">
        <div className="clay pad center" style={{ '--tc': t.c, '--tg': t.g }}>
          <Avatar name={user.name} size={96} t={t} />
          <h2>{user.name}</h2><TierBadge t={t} /> <RoleBadge role={user.role} />
          <p className="muted">{[user.field, user.city].filter(Boolean).join(' · ')}</p>
          <div className="tiles two"><Tile icon="zap" label="XP" value={nf(user.xp)} /><Tile icon="star" label="لول" value={nf(level(user.xp))} /></div>
          {sup && <p className="muted">سرپرست شما: <b>{sup.name}</b></p>}
        </div>
        <div className="clay pad">
          <h3>ویرایش اطلاعات حساب</h3>
          <Field label="اسم"><input value={f.name} maxLength={80} onChange={set('name')} autoComplete="name" /></Field>
          <div className="row">
            <Field label="سن" className="grow"><input value={f.age} inputMode="numeric" onChange={set('age')} /></Field>
            <Field label="شهر" className="grow"><input value={f.city} maxLength={80} onChange={set('city')} /></Field>
          </div>
          <Field label="شماره موبایل"><input value={f.phone} inputMode="tel" autoComplete="tel" onChange={set('phone')} /></Field>
          <Field label="رمز عبور جدید (در صورت عدم تغییر خالی بگذارید)"><input type="password" value={f.password} autoComplete="new-password" onChange={set('password')} /></Field>
          <Field label="حوزه فعالیت">
            <select value={f.field} onChange={set('field')}><option value="">—</option>{names.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <button type="button" className="btn" onClick={save} disabled={busy}><Icon n="check" size={16} /> {busy ? '...' : 'ذخیره تغییرات'}</button>
        </div>
      </div>
      <div className="clay pad" style={{ marginTop: 14 }}><PushToggle user={user} /></div>
    </div>
  );
}
