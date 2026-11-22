import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { configured, store, syncClock, nf, level, tierOf } from './db.js';
import * as api from './api.js';
import { clearCache, useLive } from './hooks.js';
import { NotifyProvider, useNotify } from './notify.jsx';
import { closeModalRoute, useRoute } from './router.js';
import Auth from './Auth.jsx';
import MyPanel from './pages/MyPanel.jsx';
import Members from './pages/Members.jsx';
import SubmitReport from './pages/SubmitReport.jsx';
import AdminMessages from './pages/AdminMessages.jsx';
import Profile from './pages/Profile.jsx';
import { Avatar, Bg, ErrorBoundary, ErrorState, Icon, RoleBadge, Spinner, ThemeToggle } from './ui.jsx';

// بسته‌های سنگین فقط وقتی لازم‌اند لود می‌شوند
const Landing = lazy(() => import('./Landing.jsx'));
const Admin = lazy(() => import('./Admin.jsx'));

const TITLES = { panel: 'پنل رشد', members: 'اعضا', report: 'ارسال گزارش', messages: 'پیام ادمین', profile: 'پروفایل', admin: 'پنل مدیریت' };
const REFRESH_MIN_GAP = 30000;

const Fallback = () => <div className="auth"><Spinner /></div>;

/** نشست کاربر: خطای شبکه هرگز باعث خروج نمی‌شود؛ فقط «کاربر واقعاً وجود ندارد/غیرفعال است» خروج می‌زند */
function useSession() {
  const { toast } = useNotify();
  const [s, setS] = useState({ status: configured ? 'loading' : 'out', user: null, error: null });
  const seq = useRef(0);
  const userRef = useRef(null);
  const lastFetch = useRef(0);
  const lastToast = useRef(0);
  userRef.current = s.user;

  const load = useCallback(async (id) => {
    const my = ++seq.current;
    const uid = id || store.get('gl_uid');
    if (!uid) { setS({ status: 'out', user: null, error: null }); return; }
    lastFetch.current = Date.now();
    try {
      const u = await api.fetchSelf(uid);
      if (my !== seq.current) return;
      if (u && u.active !== false) {
        store.set('gl_uid', u.id);
        setS({ status: 'in', user: u, error: null });
      } else {
        store.remove('gl_uid');
        setS({ status: 'out', user: null, error: null });
        if (u) toast('حساب شما غیرفعال شده است.', 'err');
      }
    } catch (e) {
      if (my !== seq.current) return;
      const err = api.toApiError(e);
      if (userRef.current) {
        // کاربر وارد است: نشست حفظ می‌شود و فقط یک اعلان (حداکثر دقیقه‌ای یک‌بار) نشان می‌دهیم
        if (Date.now() - lastToast.current > 60000) { lastToast.current = Date.now(); toast(err.message, 'err'); }
      } else {
        setS({ status: 'error', user: null, error: err });
      }
    }
  }, [toast]);

  const logout = useCallback(() => {
    seq.current++;
    store.remove('gl_uid');
    clearCache();
    setS({ status: 'out', user: null, error: null });
  }, []);

  // بارگذاری اولیه + همگام‌سازی ساعت با سرور
  useEffect(() => {
    if (!configured) return;
    syncClock();
    load();
  }, [load]);

  // تازه‌سازی بی‌صدا هنگام بازگشت به تب (به‌جای هر تغییر تب)
  useEffect(() => {
    if (s.status !== 'in') return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > REFRESH_MIN_GAP) load(userRef.current?.id);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onVis); };
  }, [s.status, load]);

  return { ...s, load, logout };
}

function Shell() {
  const { status, user, error, load, logout } = useSession();
  const [route, go] = useRoute();
  const [badges, setBadges] = useState({ msgs: 0, threads: 0, admin: 0 });
  const mainRef = useRef(null);
  const first = useRef(true);

  const uid = user?.id;
  const role = user?.role;
  const refreshBadges = useCallback(async () => {
    if (!uid) return;
    try {
      const [u, c] = await Promise.all([api.unread(uid), role !== 'member' ? api.adminCounts(uid) : null]);
      setBadges({ msgs: u?.msgs || 0, threads: u?.threads || 0, admin: c?.pending || 0 });
    } catch { /* نشانگرها پس‌زمینه‌اند؛ خطا نمایش داده نمی‌شود و polling بعدی دوباره تلاش می‌کند */ }
  }, [uid, role]);

  useEffect(() => { refreshBadges(); }, [refreshBadges, route[0]]);
  useLive({
    enabled: !!uid, every: 60000, onTick: refreshBadges,
    channels: uid ? [[`admin-msgs-${uid}`, 'admin_messages', `user_id=eq.${uid}`], [`report-msgs-${uid}`, 'report_messages', null]] : [],
  });

  const isAdmin = role && role !== 'member';
  const tab = Object.keys(TITLES).includes(route[0]) && !(route[0] === 'admin' && !isAdmin) ? route[0] : 'panel';

  // عنوان صفحه، اسکرول و فوکوس (برای کیبورد و صفحه‌خوان) با هر تغییر مسیر
  useEffect(() => {
    if (status !== 'in') { document.title = 'GrowLand | گرولند'; return; }
    document.title = `${TITLES[tab]} | GrowLand`;
    window.scrollTo(0, 0);
    if (first.current) first.current = false; else mainRef.current?.focus({ preventScroll: true });
  }, [tab, status, route[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // کاربر واردشده روی /login یا مسیر نامعتبر → مسیر درست در URL
  useEffect(() => {
    if (status === 'in' && route[0] !== tab) go(tab, { replace: true });
  }, [status, route, tab, go]);

  if (!configured) {
    return <div className="auth"><div className="clay authbox"><img src="/logo.jpg" className="logo" alt="" /><p>اطلاعات Supabase تنظیم نشده است. متغیرهای <b>VITE_SUPABASE_URL</b> و <b>VITE_SUPABASE_KEY</b> را در Vercel ست کنید یا فایل <b>src/config.js</b> را پر کنید.</p></div></div>;
  }
  if (status === 'loading') return <Fallback />;
  if (status === 'error') {
    return (
      <div className="auth"><div className="clay authbox center">
        <img src="/logo.jpg" className="logo" alt="GrowLand" />
        <ErrorState error={error} onRetry={() => load()} />
        <button type="button" className="btn small ghost" onClick={logout}>خروج از حساب</button>
      </div></div>
    );
  }

  if (status === 'out') {
    const m = route[0] === 'login' || route[0] === 'register' ? route[0] : null;
    return (
      <Suspense fallback={<Fallback />}>
        {m
          ? <Auth mode={m} onMode={(x) => go(x, { replace: true })} onBack={() => go('')} onLogin={(id) => { go('panel', { replace: true }); load(id); }} />
          : <Landing onAuth={(x) => { go(x); window.scrollTo(0, 0); }} />}
      </Suspense>
    );
  }

  const refresh = () => load(user.id);
  const tabs = [['panel', 'chart', 'رشد'], ['members', 'users', 'اعضا'], ['report', 'file', 'گزارش'], ['messages', 'mail', 'پیام'], ['profile', 'user', 'پروفایل']];
  if (isAdmin) tabs.push(['admin', 'shield', 'مدیریت']);
  const badge = (k) => (k === 'messages' ? badges.msgs : k === 'report' ? badges.threads : k === 'admin' ? badges.admin : 0);
  const tabGo = (k) => go(k);
  const lv = level(user.xp);

  return (
    <div className="shell">
      <button type="button" className="skiplink" onClick={() => mainRef.current?.focus()}>پرش به محتوا</button>
      <Bg />
      <aside className="sidebar clay">
        <img src="/logo.jpg" alt="GrowLand" className="side-logo" />
        <nav aria-label="منوی اصلی">
          {tabs.map(([k, ic]) => (
            <button key={k} type="button" className={'navbtn ' + (tab === k ? 'on' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => tabGo(k)}>
              <Icon n={ic} /><span>{TITLES[k]}</span>{badge(k) > 0 && <i className="dot" aria-label={`${nf(badge(k))} مورد جدید`}>{nf(badge(k))}</i>}
            </button>
          ))}
        </nav>
        <div className="row between" style={{ marginBottom: 10 }}><small className="muted">پوسته نمایش</small><ThemeToggle /></div>
        <div className="usercard">
          <Avatar name={user.name} size={42} t={tierOf(lv)} />
          <div className="grow"><b>{user.name}</b><br /><small className="en muted">LV {nf(lv)}</small> <RoleBadge role={user.role} /></div>
          <button type="button" className="btn small danger" title="خروج" aria-label="خروج از حساب" onClick={() => { logout(); go(''); }}><Icon n="out" size={16} /></button>
        </div>
      </aside>
      <header className="mobtop clay">
        <img src="/logo.jpg" alt="" className="mini-logo" /><b className="grow">{user.name}</b><span className="chip en">LV {nf(lv)}</span><ThemeToggle />
        <button type="button" className="btn small danger" aria-label="خروج از حساب" onClick={() => { logout(); go(''); }}><Icon n="out" size={16} /></button>
      </header>
      <main className="content" id="main-content" tabIndex={-1} ref={mainRef} key={tab}>
        <ErrorBoundary>
          {tab === 'panel' && <MyPanel user={user} go={tabGo} />}
          {tab === 'members' && <Members selId={route[1] || null} onSelect={(id) => (id ? go(`members/${id}`, { modal: true }) : closeModalRoute(go, 'members'))} />}
          {tab === 'report' && <SubmitReport user={user} refresh={refresh} onRead={refreshBadges} />}
          {tab === 'messages' && <AdminMessages user={user} onRead={refreshBadges} />}
          {tab === 'profile' && <Profile user={user} refresh={refresh} />}
          {tab === 'admin' && isAdmin && (
            <Suspense fallback={<div className="skeleton" />}>
              <Admin me={user} sub={route[1]} onSub={(s) => go(`admin/${s}`)} onChange={refreshBadges} />
            </Suspense>
          )}
        </ErrorBoundary>
      </main>
      <nav className="bottomnav clay" aria-label="منوی اصلی موبایل">
        {tabs.map(([k, ic, short]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} aria-label={TITLES[k]} onClick={() => tabGo(k)}><Icon n={ic} size={22} /><small>{short}</small>{badge(k) > 0 && <i className="dot" aria-label={`${nf(badge(k))} مورد جدید`}>{nf(badge(k))}</i>}</button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NotifyProvider>
        <Shell />
      </NotifyProvider>
    </ErrorBoundary>
  );
}
