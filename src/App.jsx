import { useEffect, useState } from 'react';
import { sb, configured, canManage, nf } from './db.js';
import Landing from './Landing.jsx';
import Auth from './Auth.jsx';
import Admin from './Admin.jsx';
import { Members, MyPanel, SubmitReport, AdminMessages, Profile } from './pages.jsx';
import { Avatar, Icon, ToastHost, RoleBadge } from './ui.jsx';

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
        const r = await sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('user_id', ids);
        admin = r.count || 0;
      }
    }
    setBadges({ msgs: m.count || 0, admin });
  };
  const goTab = (k) => {
    if (k === 'msgs') { localStorage.setItem('gl_seen_' + user.id, new Date().toISOString()); setBadges((b) => ({ ...b, msgs: 0 })); }
    setTab(k); window.scrollTo(0, 0);
  };
  useEffect(() => { loadBadges(); }, [user?.id, tab]);

  if (!configured) return <div className="auth"><div className="clay authbox"><img src="/logo.jpg" className="logo" alt="" /><p>فایل <b>src/config.js</b> را با اطلاعات Supabase پر کن.</p></div></div>;
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
  const tabs = [['panel', 'پنل رشد', 'chart'], ['members', 'اعضا', 'users'], ['report', 'ارسال گزارش', 'file'], ['msgs', 'پیام ادمین', 'mail'], ['profile', 'پروفایل', 'user']];
  if (isAdmin) tabs.push(['admin', 'پنل مدیریت', 'shield']);
  const badge = (k) => (k === 'msgs' ? badges.msgs : k === 'admin' ? badges.admin : 0);
  const logout = () => { localStorage.removeItem('gl_uid'); setUser(null); setView('landing'); };

  return (
    <div className="shell">
      <ToastHost />
      <aside className="sidebar clay">
        <img src="/logo.jpg" alt="GrowLand" className="side-logo" />
        <nav>
          {tabs.map(([k, l, ic]) => (
            <button key={k} className={'navbtn ' + (tab === k ? 'on' : '')} onClick={() => goTab(k)}>
              <Icon n={ic} /><span>{l}</span>{badge(k) > 0 && <i className="dot">{nf(badge(k))}</i>}
            </button>
          ))}
        </nav>
        <div className="usercard">
          <Avatar name={user.name} size={42} />
          <div className="grow"><b>{user.name}</b><br /><RoleBadge role={user.role} /></div>
          <button className="btn small danger" title="خروج" onClick={logout}><Icon n="out" size={16} /></button>
        </div>
      </aside>
      <header className="mobtop clay">
        <img src="/logo.jpg" alt="" className="mini-logo" /><b>{user.name}</b>
        <button className="btn small danger" onClick={logout}><Icon n="out" size={16} /></button>
      </header>
      <main className="content" key={tab}>
        {tab === 'panel' && <MyPanel user={user} go={goTab} />}
        {tab === 'members' && <Members />}
        {tab === 'report' && <SubmitReport user={user} refresh={() => refresh(user.id)} />}
        {tab === 'msgs' && <AdminMessages user={user} />}
        {tab === 'profile' && <Profile user={user} refresh={() => refresh(user.id)} />}
        {tab === 'admin' && isAdmin && <Admin me={user} onChange={loadBadges} />}
      </main>
      <nav className="bottomnav clay">
        {tabs.map(([k, l, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => goTab(k)}><Icon n={ic} size={22} /><small>{l.split(' ')[0] === 'ارسال' ? 'گزارش' : l.split(' ')[0] === 'پنل' ? (k === 'admin' ? 'مدیریت' : 'رشد') : l.split(' ')[0]}</small>{badge(k) > 0 && <i className="dot">{nf(badge(k))}</i>}</button>
        ))}
      </nav>
    </div>
  );
}
