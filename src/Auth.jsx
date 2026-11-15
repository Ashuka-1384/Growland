import { useEffect, useState } from 'react';
import { sb, fa2en } from './db.js';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [fields, setFields] = useState([]);
  const [f, setF] = useState({ name: '', age: '', city: '', phone: '', password: '', field: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    sb.from('fields').select('*').order('id').then(({ data }) => {
      setFields(data || []);
      if (data?.[0]) setF((p) => ({ ...p, field: p.field || data[0].name }));
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const phone = fa2en(f.phone);
    if (!/^09\d{9}$/.test(phone)) return setErr('شماره موبایل باید به شکل 09123456789 باشد');
    if (!f.password) return setErr('رمز عبور را وارد کن');
    setBusy(true);
    if (mode === 'login') {
      const { data } = await sb.from('profiles').select('id').eq('phone', phone).eq('password', f.password).maybeSingle();
      setBusy(false);
      if (!data) return setErr('شماره یا رمز عبور اشتباه است');
      return onLogin(data.id);
    }
    const age = parseInt(fa2en(f.age), 10);
    if (!f.name.trim() || !f.city.trim() || !(age > 0 && age < 120)) { setBusy(false); return setErr('همه فیلدها را درست پر کن'); }
    const { data, error } = await sb.from('profiles')
      .insert({ name: f.name.trim(), age, city: f.city.trim(), phone, password: f.password, field: f.field })
      .select('id').single();
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'این شماره قبلا ثبت‌نام کرده' : 'خطا در ثبت‌نام: ' + error.message);
    onLogin(data.id);
  };

  return (
    <div className="auth">
      <form className="clay authbox" onSubmit={submit}>
        <img src="/logo.jpg" alt="GrowLand" className="logo" />
        <div className="tabs2">
          <button type="button" className={'btn ' + (mode === 'login' ? '' : 'ghost')} onClick={() => setMode('login')}>ورود</button>
          <button type="button" className={'btn ' + (mode === 'register' ? '' : 'ghost')} onClick={() => setMode('register')}>ثبت‌نام</button>
        </div>
        {mode === 'register' && (
          <>
            <input placeholder="اسم" value={f.name} onChange={set('name')} />
            <input placeholder="سن" inputMode="numeric" value={f.age} onChange={set('age')} />
            <input placeholder="شهر" value={f.city} onChange={set('city')} />
          </>
        )}
        <input placeholder="شماره موبایل" inputMode="tel" value={f.phone} onChange={set('phone')} />
        <input placeholder="رمز عبور" type="password" value={f.password} onChange={set('password')} />
        {mode === 'register' && (
          <select value={f.field} onChange={set('field')}>
            {fields.map((x) => <option key={x.id}>{x.name}</option>)}
          </select>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? '...' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
      </form>
    </div>
  );
}
