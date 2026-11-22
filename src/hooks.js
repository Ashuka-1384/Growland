import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, subscribe } from './api.js';
import { useNotify } from './notify.jsx';

/* ---------- کش سبک (stale-while-revalidate) ---------- */
const cache = new Map();
export const invalidate = (prefix = '') => {
  for (const [k, v] of cache) if (k.startsWith(prefix)) v.ts = 0;
};
export const clearCache = () => cache.clear();

/**
 * useQuery(key, fetcher): داده‌ی کش‌شده را فوراً نشان می‌دهد و در صورت کهنه‌بودن دوباره می‌گیرد.
 * اگر key تغییر کند، پاسخ‌های قدیمی نادیده گرفته می‌شوند.
 */
export function useQuery(key, fetcher, { stale = 30000, enabled = true } = {}) {
  const fnRef = useRef(fetcher);
  fnRef.current = fetcher;
  const [st, setSt] = useState(() => ({ key, data: cache.get(key)?.data ?? null, error: null, loading: enabled }));
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    const h = cache.get(key);
    if (h) h.ts = 0;
    setNonce((n) => n + 1);
  }, [key]);

  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    const hit = cache.get(key);
    setSt((s) => ({ key, data: hit ? hit.data : s.key === key ? s.data : null, error: null, loading: !(hit && Date.now() - hit.ts < stale) }));
    if (hit && Date.now() - hit.ts < stale) return undefined;
    Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => {
          cache.set(key, { data, ts: Date.now() });
          if (!dead) setSt({ key, data, error: null, loading: false });
        },
        (e) => { if (!dead) setSt((s) => ({ ...s, error: toApiError(e), loading: false })); },
      );
    return () => { dead = true; };
  }, [key, enabled, nonce, stale]);

  return { data: st.key === key ? st.data : null, error: st.error, loading: st.loading, reload };
}

/* ---------- صفحه‌بندی با «بیشتر» ---------- */
export function usePaged(fetchPage, deps, pageSize = 24) {
  const [st, setSt] = useState({ items: [], total: null, loading: true, error: null, done: false });
  const fnRef = useRef(fetchPage);
  fnRef.current = fetchPage;
  const gen = useRef(0);

  const start = useCallback((offset, keep) => {
    const g = offset === 0 ? ++gen.current : gen.current;
    setSt((s) => ({ ...s, items: offset === 0 && !keep ? [] : s.items, loading: true, error: null }));
    Promise.resolve()
      .then(() => fnRef.current(offset, pageSize))
      .then(
        ({ rows, total }) => {
          if (g !== gen.current) return;
          setSt((s) => ({
            items: offset === 0 ? rows : [...s.items, ...rows],
            total: total ?? s.total,
            loading: false, error: null, done: rows.length < pageSize,
          }));
        },
        (e) => { if (g === gen.current) setSt((s) => ({ ...s, loading: false, error: toApiError(e) })); },
      );
  }, [pageSize]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { start(0, false); }, deps);

  return {
    ...st,
    loadMore: () => !st.loading && !st.done && start(st.items.length, true),
    reload: () => start(0, true),
  };
}

/* ---------- اجرای عملیات با busy و پیام خطا ---------- */
export function useAction() {
  const { toast } = useNotify();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /**
   * run(fn, { ok }) → نتیجه‌ی fn یا undefined در صورت خطا.
   * همزمان فقط یک اجرا مجاز است (جلوگیری از ارسال تکراری با Enter/کلیک مجدد).
   */
  const run = useCallback(async (fn, { ok, okType } = {}) => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    try {
      const out = await fn();
      if (ok) toast(typeof ok === 'function' ? ok(out) : ok, okType);
      return out === undefined ? true : out;
    } catch (e) {
      toast(toApiError(e).message, 'err');
      return undefined;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }, [toast]);

  return [run, busy];
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** پایش Realtime + polling سبک؛ فقط وقتی تب قابل مشاهده است */
export function useLive({ enabled = true, every = 60000, channels = [], onTick }) {
  const cb = useRef(onTick);
  cb.current = onTick;
  const key = JSON.stringify(channels);
  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    let debounce;
    const fire = () => { clearTimeout(debounce); debounce = setTimeout(() => cb.current?.(), 400); };
    const visible = () => document.visibilityState === 'visible';
    const tick = () => { if (visible()) cb.current?.(); };
    const onVis = () => { if (visible()) fire(); };
    timer = setInterval(tick, every);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', fire);
    const unsubs = JSON.parse(key).map(([name, table, filter]) => subscribe(name, table, filter, fire));
    return () => {
      clearInterval(timer);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', fire);
      unsubs.forEach((u) => u());
    };
  }, [enabled, every, key]);
}
