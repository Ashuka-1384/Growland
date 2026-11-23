import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { configured, store, syncClock, nf, level, tierOf, isCeleb } from './db.js';
import * as api from './api.js';
import { clearCache, invalidate, useLive } from './hooks.js';
import { NotifyProvider, useNotify } from './notify.jsx';
import { closeModalRoute, useRoute } from './router.js';
import Auth from './Auth.jsx';
import InstallButton from './InstallButton.jsx';
import PwaBits from './PwaBits.jsx';
import { haptic, setBadge, useNavHidden } from './pwa.js';
import { outboxFlush } from './offline.js';
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

/** نسخه‌ی ذخیره‌شده‌ی پروفایل: اپ بدون اینترنت هم باز می‌شود (گزارش آفلاین در صف می‌رود) */
const readSelf = (uid) => {
  try { const u = JSON.parse(store.get('gl_self') || 'null'); return u && u.id === uid && u.active !== false ? u : null; } catch { return null; }
};

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
        store.set('gl_self', JSON.stringify(u));
        setS({ status: 'in', user: u, error: null });
      } else {
        store.remove('gl_uid');
        store.remove('gl_self');
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
        const cached = err.network ? readSelf(uid) : null;
        setS(cached ? { status: 'in', user: cached, error: null } : { status: 'error', user: null, error: err });
      }
    }
  }, [toast]);

  const logout = useCallback(() => {
    seq.current++;
    store.remove('gl_uid');
    store.remove('gl_self');
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
  const { toast, celebrate } = useNotify();
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
      setBadge((u?.msgs || 0) + (u?.threads || 0) + (c?.pending || 0)); // عدد روی آیکون اپ
    } catch { /* نشانگرها پس‌زمینه‌اند؛ خطا نمایش داده نمی‌شود و polling بعدی دوباره تلاش می‌کند */ }
  }, [uid, role]);

  useEffect(() => { refreshBadges(); }, [refreshBadges, route[0]]);
  useLive({
    enabled: !!uid, every: 60000, onTick: refreshBadges,
    channels: uid ? [[`admin-msgs-${uid}`, 'admin_messages', `user_id=eq.${uid}`], [`report-msgs-${uid}`, 'report_messages', null]] : [],
  });

  const navHidden = useNavHidden(status === 'in');
  const [rev, setRev] = useState(0);
  const ptrRef = useRef(null);

  // ارسال گزارش‌های آفلاین با برگشتن اینترنت
  const flushOutbox = useCallback(() => {
    if (!uid) return;
    outboxFlush(uid, api.submitReport, ({ ok, res, error: e }) => {
      if (!ok) { toast(api.toApiError(e).message, 'err'); return; }
      if (res.earned > 0) toast(`گزارش آفلاین ارسال شد: +${nf(res.earned)} XP`, 'xp'); else toast('گزارش آفلاین ارسال شد.');
      const c = isCeleb(res.old_xp, res.xp);
      if (c) celebrate(c);
      invalidate('growth:');
      load(uid);
    });
  }, [uid, toast, celebrate, load]);
  useEffect(() => {
    flushOutbox();
    window.addEventListener('online', flushOutbox);
    return () => window.removeEventListener('online', flushOutbox);
  }, [flushOutbox]);

  // کشیدن صفحه به پایین برای تازه‌سازی (Pull-to-refresh)
  useEffect(() => {
    if (status !== 'in') return undefined;
    let y0 = null;
    let d = 0;
    const start = (e) => {
      const skip = e.target.closest?.('[role=dialog], textarea, input, select');
      y0 = window.scrollY <= 0 && e.touches.length === 1 && !skip ? e.touches[0].clientY : null;
      d = 0;
    };
    const move = (e) => {
      if (y0 === null) return;
      d = Math.max(0, e.touches[0].clientY - y0) * 0.5;
      const p = ptrRef.current;
      if (p) { p.style.transform = `translateY(${Math.min(d, 80) - 60}px)`; p.style.opacity = String(Math.min(1, d / 60)); }
    };
    const end = () => {
      if (y0 === null) return;
      const fire = d >= 60;
      y0 = null; d = 0;
      const p = ptrRef.current;
      if (p) { p.style.transform = ''; p.style.opacity = '0'; }
      if (fire) { haptic(15); invalidate(''); load(uid); refreshBadges(); setRev((n) => n + 1); }
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    };
  }, [status, uid, load, refreshBadges]);

  // پیش‌بارگذاری بسته‌ی مدیریت در زمان بیکاری (باز شدن فوری پنل ادمین)
  useEffect(() => {
    if (status !== 'in' || !role || role === 'member') return;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
    idle(() => { import('./Admin.jsx').catch(() => {}); });
  }, [status, role]);

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
        <img src="/logo-256.webp" alt="GrowLand" className="side-logo" width="120" height="120" />
        <nav aria-label="منوی اصلی">
          {tabs.map(([k, ic]) => (
            <button key={k} type="button" className={'navbtn ' + (tab === k ? 'on' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => tabGo(k)}>
              <Icon n={ic} /><span>{TITLES[k]}</span>{badge(k) > 0 && <i className="dot" aria-label={`${nf(badge(k))} مورد جدید`}>{nf(badge(k))}</i>}
            </button>
          ))}
        </nav>
        <div className="row between" style={{ marginBottom: 10 }}><small className="muted">پوسته نمایش</small><ThemeToggle /></div>
        <div style={{ marginBottom: 10 }}><InstallButton className="btn small" /></div>
        <div className="usercard">
          <Avatar name={user.name} size={42} t={tierOf(lv)} />
          <div className="grow"><b>{user.name}</b><br /><small className="en muted">LV {nf(lv)}</small> <RoleBadge role={user.role} /></div>
          <button type="button" className="btn small danger" title="خروج" aria-label="خروج از حساب" onClick={() => { logout(); go(''); }}><Icon n="out" size={16} /></button>
        </div>
      </aside>
      <header className="mobtop clay">
        <img src="/logo-256.webp" alt="" className="mini-logo" width="48" height="48" /><b className="grow">{user.name}</b><span className="chip en">LV {nf(lv)}</span><InstallButton /><ThemeToggle />
        <button type="button" className="btn small danger" aria-label="خروج از حساب" onClick={() => { logout(); go(''); }}><Icon n="out" size={16} /></button>
      </header>
      <main className="content" id="main-content" tabIndex={-1} ref={mainRef} key={`${tab}:${rev}`}>
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
      <div className="ptr" ref={ptrRef} aria-hidden="true"><i /></div>
      {tab !== 'report' && (
        <button type="button" className={'fab' + (navHidden ? ' low' : '')} aria-label="ارسال گزارش جدید" onClick={() => { haptic(10); go('report'); }}><Icon n="plus" size={26} /></button>
      )}
      <nav className={'bottomnav clay' + (navHidden ? ' hide' : '')} aria-label="منوی اصلی موبایل">
        {tabs.map(([k, ic, short]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} aria-label={TITLES[k]} onClick={() => { haptic(8); tabGo(k); }}><Icon n={ic} size={22} /><small>{short}</small>{badge(k) > 0 && <i className="dot" aria-label={`${nf(badge(k))} مورد جدید`}>{nf(badge(k))}</i>}</button>
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
        <PwaBits />
      </NotifyProvider>
    </ErrorBoundary>
  );
}
