import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tierOf, nf } from './rules.js';
import { haptic } from './pwa.js';

/**
 * اعلان‌ها (Toast) و جشن ارتقای سطح با React Context
 * (جایگزین متغیرهای قابل‌تغییر سطح ماژول).
 */
const NotifyCtx = createContext({ toast: () => {}, celebrate: () => {} });
export const useNotify = () => useContext(NotifyCtx);

export function NotifyProvider({ children }) {
  const [list, setList] = useState([]);
  const [cel, setCel] = useState(null);
  const timers = useRef(new Set());
  const seq = useRef(0);

  useEffect(() => {
    const set = timers.current;
    return () => { set.forEach(clearTimeout); set.clear(); };
  }, []);

  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }, []);

  const toast = useCallback((m, t = 'ok') => {
    const id = ++seq.current;
    if (t === 'xp') haptic([20, 40, 20]); else if (t === 'err') haptic(40);
    setList((x) => [...x.slice(-3), { id, m, t }]);
    later(() => setList((x) => x.filter((i) => i.id !== id)), t === 'xp' ? 2600 : t === 'err' ? 5200 : 3200);
  }, [later]);

  const celebrate = useCallback((d) => {
    setCel(d);
    haptic([30, 50, 30, 50, 140]);
    later(() => setCel(null), 3600);
  }, [later]);

  const api = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);
  const t = cel ? tierOf(cel.level) : null;

  useEffect(() => {
    if (!cel) return undefined;
    const onKey = (e) => e.key === 'Escape' && setCel(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cel]);

  return (
    <NotifyCtx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="اعلان‌ها">
        {list.map((i) => (
          <div key={i.id} className={'toast ' + i.t} role={i.t === 'err' ? 'alert' : 'status'}>{i.m}</div>
        ))}
      </div>
      {cel && (
        <div className="celebrate" onClick={() => setCel(null)} style={{ '--tc': t.c, '--tg': t.g }} role="status" aria-live="polite">
          <div className="clay cel-box">
            <small>ارتقای سطح</small>
            <div className="cel-n en">{nf(cel.level)}</div>
            <b>{t.name} <span className="en muted">· {t.en}</span></b>
            {cel.tierUp && <p className="cel-tier">شما به سطح تخصصی «{t.name}» ارتقا یافتید.</p>}
          </div>
        </div>
      )}
    </NotifyCtx.Provider>
  );
}
