import { useEffect, useState } from 'react';
import { sb, configured } from './db.js';
import Auth from './Auth.jsx';
import Admin from './Admin.jsx';
import { Members, MyPanel, SubmitReport, AdminMessages, Profile } from './pages.jsx';
import { Avatar } from './ui.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('members');

  const refresh = async (id) => {
    const uid = id || localStorage.getItem('gl_uid');
    if (!uid) return setReady(true);
    const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) { setUser(data); localStorage.setItem('gl_uid', data.id); }
    else { localStorage.removeItem('gl_uid'); setUser(null); }
    setReady(true);
  };
  useEffect(() => { if (configured) refresh(); else setReady(true); }, []);

  if (!configured) return <div className="auth"><div className="clay authbox"><img src="/logo.jpg" className="logo" /><p>فایل <b>src/config.js</b> را با اطلاعات Supabase پر کن.</p></div></div>;
  if (!ready) return <div className="auth"><p>در حال بارگذاری...</p></div>;
  if (!user) return <Auth onLogin={(id) => { setTab('members'); refresh(id); }} />;

  const isAdmin = user.role === 'admin' || user.role === 'super';
  const tabs = [['members', 'اعضا'], ['panel', 'پنل رشد'], ['report', 'ارسال گزارش'], ['msgs', 'پیام ادمین'], ['profile', 'پروفایل']];
  if (isAdmin) tabs.push(['admin', 'پنل مدیریت']);

  return (
    <div className="app">
      <header className="clay top">
        <img src="/logo.jpg" alt="GrowLand" className="mini-logo" />
        <nav>{tabs.map(([k, l]) => <button key={k} className={'btn small ' + (tab === k ? '' : 'ghost')} onClick={() => setTab(k)}>{l}</button>)}</nav>
        <div className="who"><Avatar name={user.name} size={36} /><span>{user.name}</span>
          <button className="btn small danger" onClick={() => { localStorage.removeItem('gl_uid'); setUser(null); }}>خروج</button></div>
      </header>
      <main>
        {tab === 'members' && <Members />}
        {tab === 'panel' && <MyPanel user={user} />}
        {tab === 'report' && <SubmitReport user={user} refresh={() => refresh(user.id)} />}
        {tab === 'msgs' && <AdminMessages user={user} />}
        {tab === 'profile' && <Profile user={user} refresh={() => refresh(user.id)} />}
        {tab === 'admin' && isAdmin && <Admin me={user} />}
      </main>
    </div>
  );
}
