import { useCallback, useSyncExternalStore } from 'react';

/**
 * روتر سبک مبتنی بر hash (بدون وابستگی و بدون نیاز به تنظیم rewrite در Vercel).
 * مسیرها: #/panel  #/members  #/members/<id>  #/report  #/messages  #/profile  #/admin  #/login  #/register
 * دکمه Back مرورگر و اندروید کار می‌کند و رفرش صفحه، کاربر را سر جایش نگه می‌دارد.
 */
export const parseHash = (h) =>
  String(h || '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const snapshot = () => window.location.hash;

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  /**
   * go(path, { replace, modal })
   * modal: ورودیِ تاریخچه با نشانه‌ی glModal ثبت می‌شود تا بستن مودال بتواند به‌جای ساختن
   * ورودی جدید، با history.back() برگردد (دکمه Back مرورگر مودال را دوباره باز نمی‌کند).
   */
  const go = useCallback((path, { replace = false, modal = false } = {}) => {
    const target = '#/' + String(path).replace(/^#?\/?/, '');
    if (window.location.hash === target) return;
    if (replace || modal) {
      window.history[replace ? 'replaceState' : 'pushState'](modal ? { glModal: true } : null, '', target);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = target;
    }
  }, []);
  return [parseHash(hash), go];
}

/** بستن مودال مسیرمحور: اگر با go(..., {modal:true}) باز شده بود برمی‌گردد، وگرنه جایگزین می‌شود */
export const closeModalRoute = (go, fallback) => {
  if (window.history.state?.glModal) window.history.back();
  else go(fallback, { replace: true });
};
