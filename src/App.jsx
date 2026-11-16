import { useEffect, useState } from 'react';
import { sb, configured, canManage, nf, level, tierOf } from './db.js';
import Landing from './Landing.jsx';
import Auth from './Auth.jsx';
import Admin from './Admin.jsx';
import { Members, MyPanel, SubmitReport, AdminMessages, Profile } from './pages.jsx';
import { Avatar, Icon, ToastHost, CelebrateHost, RoleBadge, Bg, ThemeToggle } from './ui.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('landing');   // landing | auth
  const [authMode, setAuthMode] = useState('login');
  const [tab, setTab] = useState('panel');
  const [badges, setBadges] = useState({ msgs: 0, admin: 0 });

  const refresh = async (id) => {
    const uid = id || localStorage.getItem('gl_uid');
    if (!uid) return setReady(true);
    const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) { setUser(data); localStorage.setItem('gl_uid', data.id); }
    else { localStorage.removeItem('gl_uid'); setUser(null); }
    setReady(true);
  };
  useEffect(() => { if (configured) refresh(); else setReady(true); }, []);

  const loadBadges = async () => {
    if (!user) return;
    const seen = localStorage.getItem('gl_seen_' + user.id) || '1970-01-01T00:00:00Z';
    const m = await sb.from('admin_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', seen);
    let admin = 0;
    if (user.role !== 'member') {
      const { data } = await sb.from('profiles').select('id,supervisor_id');
      const ids = (data || []).filter((p) => canManage(user, p)).map((p) => p.id);
      if (ids.length) {
        let rq = sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        if (user.role !== 'super') rq = rq.in('user_id', ids);
        admin = (await rq).count || 0;
      }
    }
    setBadges({ msgs: m.count || 0, admin });
  };
  const goTab = (k) => {
    if (k === 'msgs') { localStorage.setItem('gl_seen_' + user.id, new Date().toISOString()); setBadges((b) => ({ ...b, msgs: 0 })); }
    setTab(k); window.scrollTo(0, 0);
  };
  useEffect(() => { loadBadges(); }, [user?.id, user?.role, tab]);
  // با هر تغییر تب، اطلاعات کاربر (XP، نقش، ...) تازه می‌شود
  useEffect(() => { if (user) refresh(user.id); }, [tab]);

  if (!configured) return <div className="auth"><div className="clay authbox"><img src="/logo.jpg" className="logo" alt="" /><p>فایل <b>src/config.js</b> را با اطلاعات Supabase پر کنید.</p></div></div>;
  if (!ready) return <div className="auth"><div className="spinner" /></div>;
  if (!user) {
    return (
      <>
        <ToastHost />
        {view === 'landing'
          ? <Landing onAuth={(m) => { setAuthMode(m); setView('auth'); window.scrollTo(0, 0); }} />
          : <Auth key={authMode} initial={authMode} onBack={() => setView('landing')} onLogin={(id) => { setTab('panel'); refresh(id); }} />}
      </>
    );
  }

  const isAdmin = user.role !== 'member';
  const cur = tab === 'admin' && !isAdmin ? 'panel' : tab;
  // [کلید، عنوان، آیکون، عنوان کوتاه برای موبایل]
  const tabs = [['panel', 'پنل رشد', 'chart', 'رشد'], ['members', 'اعضا', 'users', 'اعضا'], ['report', 'ارسال گزارش', 'file', 'گزارش'], ['msgs', 'پیام ادمین', 'mail', 'پیام'], ['profile', 'پروفایل', 'user', 'پروفایل']];
  if (isAdmin) tabs.push(['admin', 'پنل مدیریت', 'shield', 'مدیریت']);
  const badge = (k) => (k === 'msgs' ? badges.msgs : k === 'admin' ? badges.admin : 0);
  const logout = () => { localStorage.removeItem('gl_uid'); setUser(null); setView('landing'); };

  return (
    <div className="shell">
      <Bg />
      <ToastHost />
      <CelebrateHost />
      <aside className="sidebar clay">
        <img src="/logo.jpg" alt="GrowLand" className="side-logo" />
        <nav>
          {tabs.map(([k, l, ic]) => (
            <button key={k} className={'navbtn ' + (cur === k ? 'on' : '')} onClick={() => goTab(k)}>
              <Icon n={ic} /><span>{l}</span>{badge(k) > 0 && <i className="dot">{nf(badge(k))}</i>}
            </button>
          ))}
        </nav>
        <div className="row between" style={{ marginBottom: 10 }}><small className="muted">پوسته نمایش</small><ThemeToggle /></div>
        <div className="usercard">
          <Avatar name={user.name} size={42} t={tierOf(level(user.xp))} />
          <div className="grow"><b>{user.name}</b><br /><small className="en muted">LV {nf(level(user.xp))}</small> <RoleBadge role={user.role} /></div>
          <button className="btn small danger" title="خروج" onClick={logout}><Icon n="out" size={16} /></button>
        </div>
      </aside>
      <header className="mobtop clay">
        <img src="/logo.jpg" alt="" className="mini-logo" /><b className="grow">{user.name}</b><span className="chip en">LV {nf(level(user.xp))}</span><ThemeToggle />
        <button className="btn small danger" onClick={logout}><Icon n="out" size={16} /></button>
      </header>
      <main className="content" key={cur}>
        {cur === 'panel' && <MyPanel user={user} go={goTab} />}
        {cur === 'members' && <Members />}
        {cur === 'report' && <SubmitReport user={user} refresh={() => refresh(user.id)} />}
        {cur === 'msgs' && <AdminMessages user={user} />}
        {cur === 'profile' && <Profile user={user} refresh={() => refresh(user.id)} />}
        {cur === 'admin' && isAdmin && <Admin me={user} onChange={loadBadges} />}
      </main>
      <nav className="bottomnav clay">
        {tabs.map(([k, l, ic, short]) => (
          <button key={k} className={cur === k ? 'on' : ''} onClick={() => goTab(k)}><Icon n={ic} size={22} /><small>{short}</small>{badge(k) > 0 && <i className="dot">{nf(badge(k))}</i>}</button>
        ))}
      </nav>
    </div>
  );
}
