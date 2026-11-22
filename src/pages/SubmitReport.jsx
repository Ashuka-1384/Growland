import { useState } from 'react';
import { DAILY_REPORT_CAP, MAX_REPORT_CHARS, MIN_CHARS, MIN_WORDS, REPORT_XP, fmt, isCeleb, nf, reasonText, reportEligibility } from '../db.js';
import * as api from '../api.js';
import { useAction, usePaged, invalidate } from '../hooks.js';
import { useNotify } from '../notify.jsx';
import { Empty, Icon, LoadMore, Ring } from '../ui.jsx';
import { Thread } from '../widgets.jsx';

function ReportItem({ r, user, onChanged, onRead }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.content);
  const [run, busy] = useAction();
  // فقط گزارش‌های بدون XP و بررسی‌نشده قابل ویرایش/حذف‌اند (جلوگیری از سوءاستفاده از XP)
  const editable = r.xp_awarded === 0 && r.status === 'pending';
  const save = async () => { if (await run(() => api.editReport(user.id, r.id, text), { ok: 'گزارش ویرایش شد' })) { setEditing(false); onChanged(); } };
  const del = async () => {
    if (!window.confirm('این گزارش حذف شود؟')) return;
    if (await run(() => api.deleteReport(user.id, r.id), { ok: 'گزارش حذف شد' })) onChanged();
  };
  return (
    <div className="clay pad rep">
      <div className="row between"><small className="muted">{fmt(r.created_at)}</small>
        <span className={'chip ' + r.status}>{r.status === 'reviewed' ? 'بررسی شد' : 'در انتظار بررسی'}{r.xp_awarded ? ` · +${nf(r.xp_awarded)} XP` : ''}</span></div>
      {editing
        ? <textarea rows="5" maxLength={MAX_REPORT_CHARS} value={text} onChange={(e) => setText(e.target.value)} aria-label="ویرایش گزارش" />
        : <p>{r.content}</p>}
      <div className="row wrap">
        <button type="button" className="btn small ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'بستن گفتگو' : 'گفتگو با ادمین'}</button>
        {editable && !editing && <button type="button" className="btn small ghost" onClick={() => setEditing(true)}><Icon n="edit" size={14} /> ویرایش</button>}
        {editing && <button type="button" className="btn small" onClick={save} disabled={busy || !text.trim()}>ذخیره</button>}
        {editing && <button type="button" className="btn small ghost" onClick={() => { setEditing(false); setText(r.content); }}>انصراف</button>}
        {editable && !editing && <button type="button" className="btn small danger" onClick={del} disabled={busy} aria-label="حذف گزارش"><Icon n="trash" size={14} /></button>}
      </div>
      {open && <Thread report={r} me={user} onRead={onRead} />}
    </div>
  );
}

/* ---------- ارسال گزارش ---------- */
export default function SubmitReport({ user, refresh, onRead }) {
  const { toast, celebrate } = useNotify();
  const [text, setText] = useState('');
  const [run, busy] = useAction();
  const paged = usePaged((offset, limit) => api.myReports(user.id, offset, limit), [user.id], 10);
  const el = reportEligibility(text);
  const len = el.chars;

  const send = async () => {
    if (len < 1) return;
    const res = await run(() => api.submitReport(user.id, text));
    if (!res) return;
    setText('');
    if (res.earned > 0) toast(`+${nf(res.earned)} XP`, 'xp');
    else toast(`گزارش ثبت شد، اما XP نگرفت. ${reasonText(res.reason)}`);
    const c = isCeleb(res.old_xp, res.xp);
    if (c) celebrate(c);
    invalidate('growth:');
    paged.reload();
    refresh();
  };

  const hint = el.ok
    ? `واجد دریافت ${nf(REPORT_XP)} XP (حداکثر ${nf(DAILY_REPORT_CAP)} گزارش امتیازدار در روز)`
    : el.reason === 'few_words' ? `${nf(MIN_WORDS - el.words)} کلمه دیگر لازم است`
    : el.reason === 'low_variety' ? 'متن باید تنوع کافی داشته باشد'
    : `${nf(Math.max(0, MIN_CHARS - len))} حرف تا دریافت ${nf(REPORT_XP)} XP`;

  return (
    <div>
      <div className="pagehead"><h2>ارسال گزارش رشد</h2></div>
      <div className="split2">
        <div className="clay pad">
          <textarea rows="9" maxLength={MAX_REPORT_CHARS} value={text} onChange={(e) => setText(e.target.value)} aria-label="متن گزارش"
            placeholder="امروز چه کارهایی انجام دادید؟ چه چیزی آموختید؟ با چه چالشی روبه‌رو شدید؟" />
          <div className="row between wrap">
            <div className="row"><Ring value={len} max={MIN_CHARS} size={54} stroke={6} label={`${nf(len)} از ${nf(MIN_CHARS)} حرف`}><small className="tiny">{el.ok ? '✓' : nf(len)}</small></Ring>
              <small className={el.ok ? 'ok' : 'muted'} aria-live="polite">{hint}</small></div>
            <button type="button" className={'btn ' + (el.ok ? 'pulse' : '')} onClick={send} disabled={busy || len < 1}><Icon n="send" size={16} /> {busy ? '...' : el.ok ? `ارسال و دریافت ${nf(REPORT_XP)} XP` : 'ارسال گزارش'}</button>
          </div>
        </div>
        <div className="clay pad tips">
          <h3>نکات یک گزارش مؤثر</h3>
          <p>• مشخص بنویسید چه کاری انجام داده‌اید.</p><p>• نتیجه و آموخته‌های خود را ذکر کنید.</p>
          <p>• چالش‌ها و سؤالات خود را برای سرپرست بنویسید.</p>
          <p>• فقط گزارش‌های امتیازدار در زنجیره فعالیت، نمودار و دستاوردها حساب می‌شوند.</p>
        </div>
      </div>
      <h3>گزارش‌های قبلی من</h3>
      {paged.items.length === 0 && paged.loading ? <div className="skeleton" />
        : paged.items.length === 0 && !paged.error ? <Empty icon="file" text="هنوز گزارشی ثبت نشده است." />
        : paged.items.map((r) => <ReportItem key={r.id} r={r} user={user} onChanged={() => { invalidate('growth:'); paged.reload(); refresh(); }} onRead={onRead} />)}
      <LoadMore paged={paged} />
    </div>
  );
}
