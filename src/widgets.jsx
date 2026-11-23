import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, LEVEL_XP, REPORT_XP, MAX_MSG_CHARS, level, xpInto, xpToNext, streakOf, last7, nextTier, tierOf, fmt, nf, today as serverToday } from './db.js';
import * as api from './api.js';
import { useAction, useLive, useQuery, invalidate } from './hooks.js';
import { Avatar, Bars, Empty, ErrorState, Heatmap, Icon, Radar, RoleBadge, Ring, Skeleton, Tile, XpBar } from './ui.jsx';

/* ---------- تاریخچه XP ---------- */
function XpHistory({ user }) {
  const { data, error, reload } = useQuery(`xph:${user.id}:${user.xp}`, () => api.xpHistory(user.id, 10), { stale: 15000 });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={2} height={56} />;
  if (!data.length) return <Empty icon="zap" text="هنوز تغییری در XP ثبت نشده است." />;
  return (
    <ul className="xplist">
      {data.map((e) => (
        <li key={e.id} className="row between">
          <div><b>{e.reason || 'تغییر XP'}</b><br /><small className="muted">{fmt(e.created_at)}{e.by?.name && e.kind === 'admin' ? ` · توسط ${e.by.name}` : ''}</small></div>
          <span className={e.delta >= 0 ? 'ok' : 'neg'} dir="ltr">{e.delta >= 0 ? '+' : '−'}{nf(Math.abs(e.delta))} XP</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- چالش‌های هفتگی (از فعالیت ۷ روز اخیر محاسبه می‌شود) ---------- */
function WeeklyMissions({ activeDays, reports, streak }) {
  const items = [
    ['۵ روز فعالیت در ۷ روز اخیر', activeDays, 5],
    ['۷ گزارش امتیازدار در ۷ روز اخیر', reports, 7],
    ['زنجیره‌ی فعالیت ۷ روزه', streak, 7],
  ];
  return (
    <div className="clay pad missions">
      <h3>چالش‌های هفتگی</h3>
      {items.map(([label, cur, max]) => {
        const done = cur >= max;
        return (
          <div key={label} className={'mission' + (done ? ' done' : '')}>
            <div className="row between"><span>{done && <Icon n="check" size={14} />} {label}</span><small className={done ? 'ok' : 'muted'}>{nf(Math.min(cur, max))} از {nf(max)}</small></div>
            <XpBar value={Math.min(cur, max)} max={max} height={10} label={label} />
          </div>
        );
      })}
    </div>
  );
}

/* ---------- نمایش رشد یک نفر ---------- */
export function Growth({ user, mine, go }) {
  const { data, error, reload } = useQuery(`growth:${user.id}:${user.xp}`, () => api.growth(user.id), { stale: 15000 });
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <div className="skeleton" />;

  const { skills, acts, streak, longest } = data;
  const today = data.today || serverToday();
  const week = last7(today).reduce((t, d) => t + (acts.find((a) => a.day === d.day)?.count || 0), 0);
  const maxSk = Math.max(...skills.map((s) => s.xp), 1);
  // دستاوردها فقط از «گزارش‌های امتیازدار» حساب می‌شوند (همان تعریفی که streak و نمودار دارند)
  const stats = { xp: user.xp, level: level(user.xp), streak: streak ?? streakOf(acts, today), skills: skills.length, reports: data.valid_reports, maxSkill: Math.max(0, ...skills.map((s) => s.xp)) };
  const done = ACHIEVEMENTS.filter((a) => a.ok(stats)).length;
  const todayCount = acts.find((a) => a.day === today)?.count || 0;
  const activeDays = last7(today).filter((d) => (acts.find((a) => a.day === d.day)?.count || 0) > 0).length;

  return (
    <div>
      <div className="tiles">
        <Tile icon="zap" label="مجموع XP" value={nf(user.xp)} />
        <Tile icon="flame" label="روز فعالیت پیوسته" value={nf(stats.streak)} sub={longest > stats.streak ? `بهترین: ${nf(longest)} روز` : undefined} />
        <Tile icon="trend" label="فعالیت این هفته" value={nf(week)} />
        <Tile icon="file" label="گزارش‌ها" value={nf(data.reports)} sub={`${nf(data.valid_reports)} امتیازدار`} />
      </div>
      {mine && (
        <div className={'clay quest ' + (todayCount ? 'done' : '')}>
          <div className="quest-i"><Icon n={todayCount ? 'check' : 'target'} size={24} /></div>
          <div className="grow"><b>{todayCount ? 'هدف امروز محقق شد' : 'هدف امروز: ثبت یک گزارش امتیازدار'}</b>
            <p className="muted">{todayCount ? `فعالیت امروز ثبت شده است. زنجیره فعالیت شما ${nf(stats.streak)} روز است.` : `برای حفظ زنجیره فعالیت و دریافت ${nf(REPORT_XP)} XP، گزارش امروز را ثبت کنید.`}</p></div>
          {!todayCount && go && <button type="button" className="btn small" onClick={() => go('report')}>ارسال گزارش</button>}
        </div>
      )}
      {mine && <WeeklyMissions activeDays={activeDays} reports={week} streak={stats.streak} />}
      <div className="grid2">
        <div className="clay-in"><h3>نمودار راداری مهارت‌ها</h3><Radar skills={skills} /></div>
        <div className="clay-in"><h3>فعالیت هفتگی</h3><Bars acts={acts} today={today} /></div>
      </div>
      <div className="clay-in">
        <h3>مهارت‌ها</h3>
        {skills.length === 0 && <Empty text="هنوز مهارتی ثبت نشده است. مهارت‌ها توسط ادمین تنظیم می‌شوند." />}
        {skills.map((s) => (
          <div key={s.id} className="skill">
            <div className="row between"><b>{s.name}</b><small className="muted">{nf(s.xp)} XP</small></div>
            <XpBar value={s.xp} max={maxSk} height={10} label={`مهارت ${s.name}`} />
          </div>
        ))}
      </div>
      <div className="clay-in"><h3>نقشه فعالیت ۱۲ هفته اخیر</h3><Heatmap acts={acts} today={today} /></div>
      <div className="clay-in">
        <div className="row between"><h3>دستاوردها</h3><span className="chip">{nf(done)} از {nf(ACHIEVEMENTS.length)}</span></div>
        <div className="ach">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className={'ach-i ' + (a.ok(stats) ? 'on' : '')} title={a.desc}>
              <div className="ach-e"><Icon n={a.icon} size={24} /></div><b>{a.name}</b><small>{a.desc}</small>
              <span className="sr">{a.ok(stats) ? 'کسب شده' : 'کسب نشده'}</span>
            </div>
          ))}
        </div>
      </div>
      {mine && <div className="clay-in"><h3>تاریخچه XP</h3><XpHistory user={user} /></div>}
    </div>
  );
}

/* ---------- پروفایل عمومی یک عضو (وقتی روی کارتش کلیک می‌شود) ---------- */
export function MemberProfile({ m }) {
  const lv = level(m.xp), t = tierOf(lv), nt = nextTier(lv);
  return (
    <div>
      <div className="mp-head" style={{ '--tc': t.c, '--tg': t.g }}>
        <Ring value={xpInto(m.xp)} max={LEVEL_XP} size={140} stroke={8}>
          <Avatar name={m.name} size={100} t={t} />
        </Ring>
        <div className="grow">
          <small className="tier en">{t.en}</small>
          <h2 className="mp-name">{m.name} <RoleBadge role={m.role} /></h2>
          <div className="tier-name">{t.name}</div>
          <p className="muted">{[m.field, m.city, m.age ? `${nf(m.age)} ساله` : ''].filter(Boolean).join(' · ') || '—'}</p>
          <div className="row wrap">
            <span className="chip big-chip"><span className="en">LV</span> {nf(lv)}</span>
            {m.rank && <span className="chip"><Icon n="trophy" size={14} /> رتبه {nf(m.rank)}</span>}
            <span className="chip"><Icon n="zap" size={14} /> {nf(m.xp)} XP</span>
          </div>
        </div>
      </div>
      <XpBar value={xpInto(m.xp)} label="پیشرفت تا لول بعد" />
      <small className="muted">
        {nf(xpToNext(m.xp))} XP تا لول {nf(lv + 1)}{nt ? ` · ${nf(nt.min - lv)} لول تا رتبه «${nt.name}»` : ' · به بالاترین رتبه رسیده است'}
      </small>
      <Growth user={m} />
    </div>
  );
}

/* ---------- گفتگوی دوطرفه روی گزارش ---------- */
export function Thread({ report, me, onSent, onRead }) {
  const { data: msgs, error, reload } = useQuery(`thread:${report.id}`, () => api.threadMessages(report.id), { stale: 0 });
  const [text, setText] = useState('');
  const [run, busy] = useAction();
  const mineReport = me.id === report.user_id;

  // پاسخ‌های جدید به‌صورت زنده (Realtime + polling سبک)
  useLive({ every: 30000, channels: [[`thread-${report.id}`, 'report_messages', `report_id=eq.${report.id}`]], onTick: reload });

  // عضو صاحب گزارش با باز کردن گفتگو، پاسخ‌ها را «خوانده‌شده» می‌کند
  const count = msgs?.length || 0;
  useEffect(() => {
    if (!mineReport || !count) return;
    // علامت «خوانده‌شد» یک کار پس‌زمینه است؛ شکست آن نباید گفتگو را مختل کند و در تلاش بعدی دوباره امتحان می‌شود
    api.markThreadRead(me.id, report.id).then(() => onRead && onRead()).catch(() => {});
  }, [mineReport, count, me.id, report.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const ok = await run(() => api.sendReportMessage(me.id, report.id, body));
    if (ok) {
      setText('');
      invalidate('admin-reports');
      reload();
      onSent && onSent();
    }
  };

  return (
    <div className="thread">
      {error && !msgs && <ErrorState error={error} onRetry={reload} />}
      <div role="log" aria-live="polite" aria-label="پیام‌های گفتگو">
        {msgs && msgs.length === 0 && <small className="muted">هنوز پیامی در این گفتگو نیست.</small>}
        {(msgs || []).map((m) => (
          <div key={m.id} className={'msg ' + (m.sender_id === me.id ? 'mine' : '')}>
            <b>{m.sender?.name}</b><p>{m.content}</p><small className="muted">{fmt(m.created_at)}</small>
          </div>
        ))}
      </div>
      <div className="row">
        <input
          value={text} maxLength={MAX_MSG_CHARS} disabled={busy} aria-label="متن پیام یا پاسخ"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
          placeholder="پیام یا پاسخ..."
        />
        <button type="button" className="btn small" onClick={send} disabled={busy || !text.trim()} aria-label="ارسال پیام"><Icon n="send" size={16} /></button>
      </div>
    </div>
  );
}
