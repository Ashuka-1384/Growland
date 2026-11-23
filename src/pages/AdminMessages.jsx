import { useEffect } from 'react';
import { fmt } from '../db.js';
import * as api from '../api.js';
import { useQuery, invalidate } from '../hooks.js';
import { Avatar, Empty, ErrorState, Skeleton } from '../ui.jsx';

/* ---------- پیام ادمین (وضعیت خوانده‌شده روی سرور ذخیره می‌شود) ---------- */
export default function AdminMessages({ user, onRead }) {
  const { data: list, error, reload } = useQuery(`msgs:${user.id}`, () => api.adminMessages(user.id), { stale: 0 });
  useEffect(() => {
    if (!list || !list.some((m) => !m.read_at)) return;
    // علامت‌گذاری «خوانده‌شد» کار پس‌زمینه است؛ اگر شکست بخورد، دفعه بعد دوباره امتحان می‌شود
    api.markMsgsRead(user.id).then(() => { invalidate('lastmsg:'); onRead && onRead(); }).catch(() => {});
  }, [list, user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="pagehead"><h2>پیام ادمین</h2></div>
      {error && !list ? <ErrorState error={error} onRetry={reload} />
        : list === null ? <Skeleton rows={3} height={84} />
        : list.length === 0 ? <Empty icon="mail" text="پیامی وجود ندارد." />
        : list.map((m) => (
          <div key={m.id} className={'clay pad rep row top' + (m.read_at ? '' : ' unread')}>
            <Avatar name={m.sender?.name} size={44} />
            <div className="grow"><div className="row between"><b>{m.sender?.name}{!m.read_at && <span className="sr"> (جدید)</span>}</b><small className="muted">{fmt(m.created_at)}</small></div><p>{m.content}</p></div>
          </div>
        ))}
    </div>
  );
}
