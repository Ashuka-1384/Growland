import { useEffect, useState } from 'react';
import { validateProfile, fa2en } from './db.js';
import * as api from './api.js';
import { useQuery } from './hooks.js';
import { Bg, ErrorState, Field, Icon, ThemeToggle } from './ui.jsx';

export default function Auth({ mode = 'login', onMode, onLogin, onBack }) {
  const { data: fields, error: fieldsError, reload: reloadFields } = useQuery('fields', api.listFields, { stale: 60000 });
  const [f, setF] = useState({ name: '', age: '', city: '', phone: '', password: '', field: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { setErr(''); }, [mode]);
  // اولین حوزه به‌صورت پیش‌فرض انتخاب می‌شود
  useEffect(() => {
    if (fields?.length && !f.field) setF((p) => ({ ...p, field: fields[0].name }));
  }, [fields]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (mode === 'login') {
      if (!/^09\d{9}$/.test(fa2en(f.phone))) return setErr('شماره موبایل باید به شکل 09123456789 باشد');
      if (!f.password) return setErr('رمز عبور را وارد کنید');
    } else {
      const msg = validateProfile(f);
      if (msg) return setErr(msg);
      if (fieldsError || !fields?.length) return setErr('فهرست حوزه‌ها بارگذاری نشده است؛ دوباره تلاش کنید');
      if (!f.field) return setErr('حوزه فعالیت را انتخاب کنید');
    }
    setBusy(true);
    try {
      const id = mode === 'login' ? await api.login(f.phone, f.password) : await api.register(f);
      onLogin(id);
    } catch (ex) {
      // «شماره یا رمز اشتباه» فقط برای پاسخ واقعی سرور است؛ خطای شبکه پیام جداگانه دارد
      setErr(ex.code === '23505' ? 'این شماره قبلاً ثبت‌نام کرده است' : ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Bg />
      <div className="themefab"><ThemeToggle /></div>
      <div className="authwrap">
        <div className="authside">
          <img src="/logo.jpg" alt="GrowLand" className="logo" />
          <h1 className="h2like">{mode === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب کاربری'}</h1>
          <p>{mode === 'login' ? 'وارد شوید و مسیر رشد خود را ادامه دهید.' : 'ثبت‌نام کنید و فعالیت‌های خود را ثبت و پیگیری کنید.'}</p>
        </div>
        <form className="clay authbox" onSubmit={submit} noValidate>
          <button type="button" className="btn small ghost backbtn" onClick={onBack}><Icon n="back" size={16} /> بازگشت</button>
          <div className="seg" role="tablist" aria-label="ورود یا ثبت‌نام">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => onMode('login')}>ورود</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => onMode('register')}>ثبت‌نام</button>
          </div>
          {mode === 'register' && (
            <>
              <Field label="اسم"><input value={f.name} maxLength={80} autoComplete="name" onChange={set('name')} /></Field>
              <div className="row">
                <Field label="سن" className="grow"><input inputMode="numeric" value={f.age} onChange={set('age')} /></Field>
                <Field label="شهر" className="grow"><input value={f.city} maxLength={80} onChange={set('city')} /></Field>
              </div>
            </>
          )}
          <Field label="شماره موبایل"><input inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="09123456789" /></Field>
          <Field label="رمز عبور"><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></Field>
          {mode === 'register' && (
            fieldsError ? <ErrorState error={fieldsError} onRetry={reloadFields} /> : (
              <Field label="حوزه فعالیت">
                <select value={f.field} onChange={set('field')}>{(fields || []).map((x) => <option key={x.id}>{x.name}</option>)}</select>
              </Field>
            )
          )}
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? '...' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
        </form>
      </div>
    </div>
  );
}
