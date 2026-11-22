import { LEVEL_XP, level, xpInto, xpToNext, nextTier, tierOf, nf } from '../db.js';
import * as api from '../api.js';
import { useQuery } from '../hooks.js';
import { Avatar, CountUp, Icon, Ring, XpBar, clickable } from '../ui.jsx';
import { Growth } from '../widgets.jsx';

/* ---------- پنل رشد من ---------- */
export default function MyPanel({ user, go }) {
  const { data: rank } = useQuery(`rank:${user.id}:${user.xp}`, () => api.myRank(user.id), { stale: 20000 });
  const { data: msgs } = useQuery(`lastmsg:${user.id}`, () => api.adminMessages(user.id, 1), { stale: 20000 });
  const msg = msgs?.[0];
  const lv = level(user.xp), t = tierOf(lv), nt = nextTier(lv), into = xpInto(user.xp);
  return (
    <div>
      <div className="clay hud" style={{ '--tc': t.c, '--tg': t.g }}>
        <div className="hud-av">
          <Ring value={into} max={LEVEL_XP} size={176} stroke={10}><Avatar name={user.name} size={126} t={t} /></Ring>
          <span className="hud-lv"><small className="en">LV</small> <CountUp to={lv} dur={800} /></span>
        </div>
        <div className="grow">
          <small className="tier en">{t.en} · {t.name}</small>
          <h1 className="hello">{user.name}</h1>
          <p className="muted">{[user.field, user.city].filter(Boolean).join(' · ')}</p>
          <XpBar value={into} height={18} label="پیشرفت تا لول بعد" />
          <div className="row between"><small className="muted">{nf(into)} / {nf(LEVEL_XP)} XP</small><small className="ok">{nf(xpToNext(user.xp))} XP تا لول {nf(lv + 1)}</small></div>
          {nt && <small className="muted">{nf(nt.min - lv)} لول تا رتبه «{nt.name}» ({nt.en})</small>}
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button type="button" className="btn small" onClick={() => go('report')}><Icon n="file" size={16} /> ارسال گزارش</button>
            <span className="chip"><Icon n="trophy" size={14} /> رتبه {rank ? nf(rank) : '...'}</span>
            <span className="chip"><Icon n="zap" size={14} /> <CountUp to={user.xp} /> XP</span>
          </div>
        </div>
      </div>
      {msg && (
        <div className="clay pad msgcard" {...clickable(() => go('messages'))} aria-label="مشاهده پیام‌های ادمین">
          <Icon n="mail" size={22} />
          <div className="grow"><b>آخرین پیام از {msg.sender?.name}</b><p className="clip">{msg.content}</p></div>
        </div>
      )}
      <Growth user={user} mine go={go} />
    </div>
  );
}
