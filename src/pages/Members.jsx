import { useState } from 'react';
import { TIERS, level, tierOf, xpInto, nf } from '../db.js';
import * as api from '../api.js';
import { useDebounced, usePaged, useQuery } from '../hooks.js';
import { Avatar, Empty, ErrorState, Icon, LoadMore, MemberCard, Modal, RoleBadge, Tile, TierBadge, XpBar } from '../ui.jsx';
import { MemberProfile } from '../widgets.jsx';

const PERIODS = [['all', 'کل زمان‌ها'], ['month', 'ماهانه'], ['week', 'هفتگی']];

function SelectedMember({ id, onClose }) {
  const { data: m, error, loading, reload } = useQuery(`member:${id}`, () => api.memberById(id), { stale: 20000 });
  return (
    <Modal onClose={onClose} label="پروفایل عضو">
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading && !m ? <div className="skeleton" />
        : m ? <MemberProfile m={m} />
        : <Empty icon="users" text="این عضو پیدا نشد." />}
    </Modal>
  );
}

function PeriodBoard({ days, onSelect }) {
  const { data, error, reload } = useQuery(`period:${days}`, () => api.leaderboardPeriod(days, 20), { stale: 60000 });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <div className="skeleton" />;
  if (!data.length) return <Empty icon="trophy" text="در این بازه هنوز XP ثبت نشده است." />;
  return (
    <div className="clay pad tablewrap"><table className="lb">
      <caption className="sr">رتبه‌بندی بر اساس XP کسب‌شده در بازه</caption>
      <thead><tr><th scope="col">رتبه</th><th scope="col">عضو</th><th scope="col">حوزه</th><th scope="col">XP بازه</th></tr></thead>
      <tbody>{data.map((m) => (
        <tr key={m.id}>
          <td className="en">{nf(m.rank)}</td>
          <td><button type="button" className="linkbtn" onClick={() => onSelect(m.id)}>{m.name}</button> <RoleBadge role={m.role} /></td>
          <td>{m.field || '—'}</td><td><b className="ok">+{nf(m.period_xp)}</b></td>
        </tr>))}</tbody>
    </table></div>
  );
}

/* ---------- پنل اعضا (صفحه‌بندی و فیلتر سمت سرور) ---------- */
export default function Members({ selId, onSelect }) {
  const [q, setQ] = useState('');
  const [fld, setFld] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState('xp');
  const [view, setView] = useState('cards');
  const [period, setPeriod] = useState('all');
  const dq = useDebounced(q, 300);

  const { data: fields } = useQuery('fields', api.listFields, { stale: 60000 });
  const { data: stats } = useQuery('stats', api.communityStats, { stale: 60000 });
  const paged = usePaged((offset, limit) => api.membersPage({ q: dq, field: fld, tier, sort, offset, limit }), [dq, fld, tier, sort]);

  const hallOn = !dq && !fld && !tier && sort === 'xp' && period === 'all' && view === 'cards' && paged.items.length >= 3;
  const hall = hallOn ? [paged.items[1], paged.items[0], paged.items[2]] : null;
  const grid = hallOn ? paged.items.slice(3) : paged.items;

  const ids = paged.items.map((m) => m.id);
  const { data: skills } = useQuery(`skills:${ids.join(',')}`, () => api.topSkills(ids), { enabled: ids.length > 0 && view === 'cards', stale: 60000 });
  const sk = skills || {};

  return (
    <div>
      <div className="pagehead"><h2>پنل اعضا</h2><span className="chip">{nf(stats?.members ?? paged.total ?? 0)} عضو فعال</span></div>
      <div className="tiles">
        <Tile icon="users" label="اعضای گرولند" value={nf(stats?.members)} />
        <Tile icon="zap" label="مجموع XP جامعه" value={nf(stats?.total_xp)} />
        <Tile icon="star" label="میانگین لول" value={nf(stats?.avg_level)} />
        <Tile icon="trophy" label="برترین عضو" value={stats?.top_name || '—'} />
      </div>

      <div className="seg" role="tablist" aria-label="بازه رتبه‌بندی" style={{ maxWidth: 360, marginBottom: 12 }}>
        {PERIODS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}
      </div>

      {period !== 'all' ? <PeriodBoard days={period === 'week' ? 7 : 30} onSelect={onSelect} /> : (
        <>
          {hall && (
            <>
              <h3 className="sec-h">تالار افتخار</h3>
              <div className="hall">
                {hall.map((m) => <MemberCard key={m.id} m={m} rank={m.rank} skills={sk[m.id]} onClick={() => onSelect(m.id)} />)}
              </div>
            </>
          )}

          <div className="filters">
            <div className="searchbox"><Icon n="search" size={18} /><input aria-label="جستجوی اسم یا شهر" placeholder="جستجوی اسم یا شهر..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value)}><option value="xp">بیشترین XP</option><option value="name">به ترتیب نام</option><option value="new">جدیدترین</option></select>
            <div className="seg viewseg"><button type="button" aria-pressed={view === 'cards'} className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>کارت</button><button type="button" aria-pressed={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>جدول</button></div>
          </div>
          <div className="chips" role="group" aria-label="فیلتر رتبه">
            <button type="button" aria-pressed={!tier} className={'chip pick ' + (!tier ? 'on' : '')} onClick={() => setTier('')}>همه رتبه‌ها</button>
            {TIERS.map((t) => <button type="button" key={t.en} aria-pressed={tier === t.en} className={'chip pick ' + (tier === t.en ? 'on' : '')} style={{ '--tc': t.c }} onClick={() => setTier(tier === t.en ? '' : t.en)}>{t.name}</button>)}
          </div>
          <div className="chips" role="group" aria-label="فیلتر حوزه">
            <button type="button" aria-pressed={!fld} className={'chip pick ' + (!fld ? 'on' : '')} onClick={() => setFld('')}>همه حوزه‌ها</button>
            {(fields || []).map((f) => <button type="button" key={f.id} aria-pressed={fld === f.name} className={'chip pick ' + (fld === f.name ? 'on' : '')} onClick={() => setFld(fld === f.name ? '' : f.name)}>{f.name}</button>)}
          </div>

          {paged.items.length === 0 && paged.loading ? <div className="skeleton" />
            : paged.items.length === 0 && !paged.error ? <Empty icon="users" text="عضوی پیدا نشد." />
            : view === 'cards' ? (
              grid.length > 0 && <div className="cards">{grid.map((m) => <MemberCard key={m.id} m={m} rank={m.rank} skills={sk[m.id]} onClick={() => onSelect(m.id)} />)}</div>
            ) : (
              <div className="clay pad tablewrap"><table className="lb">
                <caption className="sr">فهرست اعضا</caption>
                <thead><tr><th scope="col">رتبه</th><th scope="col">عضو</th><th scope="col">رتبه قدرت</th><th scope="col">حوزه</th><th scope="col">لول</th><th scope="col">XP</th></tr></thead>
                <tbody>{paged.items.map((m) => { const t = tierOf(level(m.xp)); return (
                  <tr key={m.id} onClick={() => onSelect(m.id)}>
                    <td className="en">{nf(m.rank)}</td>
                    <td><div className="row"><Avatar name={m.name} size={34} t={t} /><button type="button" className="linkbtn" onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}><b>{m.name}</b></button> <RoleBadge role={m.role} /></div></td>
                    <td><TierBadge t={t} /></td><td>{m.field || '—'}</td><td>{nf(level(m.xp))}</td>
                    <td><div style={{ minWidth: 110 }}><XpBar value={xpInto(m.xp)} height={7} label={`پیشرفت ${m.name}`} /><small className="muted">{nf(m.xp)}</small></div></td>
                  </tr>); })}</tbody>
              </table></div>
            )}
          <LoadMore paged={paged} />
        </>
      )}
      {selId && <SelectedMember id={selId} onClose={() => onSelect(null)} />}
    </div>
  );
}
