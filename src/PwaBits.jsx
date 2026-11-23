import { useEffect, useState } from 'react';
import * as api from './api.js';
import { useNotify } from './notify.jsx';
import { applyUpdate, getPushSub, pushSupported, subscribePush, unsubscribePush, useInstall, useOnline, useUpdateReady } from './pwa.js';

/** نوار آفلاین + اعلان «نسخه جدید آماده است» */
export default function PwaBits() {
  const online = useOnline();
  const ready = useUpdateReady();
  return (
    <>
      {!online && <div className="netbar" role="status">آفلاین هستید؛ گزارش‌های شما ذخیره می‌شود و با اتصال ارسال خواهد شد.</div>}
      {ready && (
        <div className="updbar clay" role="status">
          <span>نسخه جدید گرولند آماده است.</span>
          <button type="button" className="btn small" onClick={applyUpdate}>بروزرسانی</button>
        </div>
      )}
    </>
  );
}

/** فعال/غیرفعال‌کردن اعلان‌های پوش (در صفحه پروفایل) */
export function PushToggle({ user }) {
  const { toast } = useNotify();
  const { ios } = useInstall();
  const [state, setState] = useState('loading'); // loading | on | off | denied | unsupported
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    getPushSub()
      .then((s) => {
        setState(s ? 'on' : 'off');
        // اشتراک دستگاه را به حساب فعلی وصل نگه می‌داریم (مثلاً بعد از تعویض حساب)
        if (s) api.pushSave(user.id, s.toJSON()).catch(() => {});
      })
      .catch(() => setState('off'));
  }, [user.id]);

  const enable = async () => {
    setBusy(true);
    try {
      const sub = await subscribePush();
      await api.pushSave(user.id, sub);
      setState('on');
      toast('اعلان‌ها فعال شد');
    } catch (e) {
      if (Notification.permission === 'denied') setState('denied');
      else toast(e?.message === 'denied' ? 'اجازه‌ی اعلان داده نشد' : api.toApiError(e).message, 'err');
    } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const ep = await unsubscribePush();
      if (ep) await api.pushRemove(ep);
      setState('off');
      toast('اعلان‌ها غیرفعال شد');
    } catch (e) { toast(api.toApiError(e).message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div>
      <h3>اعلان‌ها</h3>
      {state === 'unsupported' && <p className="muted">{ios ? 'برای دریافت اعلان روی آیفون، ابتدا اپ را از Safari با Add to Home Screen نصب کنید.' : 'اعلان‌ها روی این مرورگر یا این نسخه در دسترس نیست.'}</p>}
      {state === 'denied' && <p className="muted">اعلان‌ها در تنظیمات مرورگر مسدود شده است. از تنظیمات سایت آن را فعال کنید.</p>}
      {(state === 'off' || state === 'on') && (
        <>
          <p className="muted">یادآوری گزارش روزانه، پیام جدید ادمین و پاسخ به گزارش‌ها را روی گوشی دریافت کنید.</p>
          <button type="button" className={'btn small ' + (state === 'on' ? 'ghost' : '')} disabled={busy} onClick={state === 'on' ? disable : enable}>
            {busy ? '...' : state === 'on' ? 'غیرفعال‌کردن اعلان‌ها' : 'فعال‌سازی اعلان‌ها'}
          </button>
        </>
      )}
    </div>
  );
}
