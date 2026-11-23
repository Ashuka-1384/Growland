import { useEffect, useState } from 'react';
import { store } from './db.js';

/**
 * صف ارسال آفلاین: گزارشی که به‌خاطر قطعی اینترنت ارسال نشد در گوشی می‌ماند
 * و با برگشتن اینترنت به‌ترتیب ارسال می‌شود. پیش‌نویس گزارش هم خودکار ذخیره می‌شود.
 */
const OUT = (uid) => `gl_outbox_${uid}`;
const DRAFT = (uid) => `gl_draft_${uid}`;

export function outboxGet(uid) {
  try { const l = JSON.parse(store.get(OUT(uid)) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function outboxPut(uid, list) {
  if (list.length) store.set(OUT(uid), JSON.stringify(list)); else store.remove(OUT(uid));
  window.dispatchEvent(new Event('gl-outbox'));
}
export function outboxAdd(uid, content) {
  const l = outboxGet(uid);
  l.push({ content, at: Date.now() });
  outboxPut(uid, l);
}

let flushing = false;
/** submit(uid, content) را برای هر مورد صدا می‌زند؛ خطای شبکه = توقف و تلاش بعدی، خطای دیگر = حذف مورد */
export async function outboxFlush(uid, submit, onResult) {
  if (flushing || !uid) return;
  flushing = true;
  try {
    const l = outboxGet(uid);
    while (l.length) {
      try {
        const res = await submit(uid, l[0].content);
        l.shift(); outboxPut(uid, l);
        onResult?.({ ok: true, res });
      } catch (e) {
        if (e?.network) break;
        l.shift(); outboxPut(uid, l);
        onResult?.({ ok: false, error: e });
      }
    }
  } finally { flushing = false; }
}

export function useOutbox(uid) {
  const [n, setN] = useState(() => outboxGet(uid).length);
  useEffect(() => {
    const f = () => setN(outboxGet(uid).length);
    f();
    window.addEventListener('gl-outbox', f);
    return () => window.removeEventListener('gl-outbox', f);
  }, [uid]);
  return n;
}

export const draftGet = (uid) => store.get(DRAFT(uid)) || '';
export const draftSet = (uid, text) => { if (text) store.set(DRAFT(uid), text); else store.remove(DRAFT(uid)); };
