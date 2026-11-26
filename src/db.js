import { PostgrestClient } from '@supabase/postgrest-js';
import { SUPABASE_URL as CFG_URL, SUPABASE_KEY as CFG_KEY } from './config.js';
import { tehranDay } from './rules.js';

// قوانین و توابع خالص از rules.js می‌آیند (برای سازگاری با importهای قبلی از اینجا هم export می‌شوند)
export * from './rules.js';

/**
 * تنظیمات اتصال: اگر متغیرهای VITE_SUPABASE_URL / VITE_SUPABASE_KEY در Vercel ست شده باشند
 * همان‌ها استفاده می‌شوند، وگرنه مقدار config.js (برای سازگاری با دیپلوی فعلی).
 */
const URL = import.meta.env?.VITE_SUPABASE_URL || CFG_URL;
const KEY = import.meta.env?.VITE_SUPABASE_KEY || CFG_KEY;

export const configured = !!URL && !URL.includes('YOUR-PROJECT') && !!KEY && !KEY.includes('YOUR-ANON');

/** fetch با timeout تا درخواست بی‌پایان معلق نماند */
const FETCH_TIMEOUT = 20000;
function timeoutFetch(input, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  if (init.signal) init.signal.addEventListener('abort', () => ctl.abort());
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
}

// فقط PostgREST (بدون Realtime/Auth/Storage): بسته‌ی جاوااسکریپت بسیار سبک‌تر و بدون WebSocket
const headers = { apikey: KEY || 'anon' };
if (/^eyJ/.test(KEY || '')) headers.Authorization = `Bearer ${KEY}`;
export const sb = new PostgrestClient(`${(URL || 'http://localhost').replace(/\/$/, '')}/rest/v1`, {
  headers,
  fetch: timeoutFetch,
});

/* ---------- ستون‌ها ---------- */
// ستون‌های عمومی (بدون رمز عبور و شماره موبایل)
export const PUBLIC_COLS = 'id,name,age,city,field,role,xp,supervisor_id,created_at,rank';
// اطلاعات خود کاربر (رمز عبور هرگز به کلاینت برنمی‌گردد)
export const SELF_COLS = 'id,name,age,city,phone,field,role,xp,supervisor_id,created_at,active';

/* ---------- localStorage امن (در حالت خصوصی یا مسدود، خطا نمی‌دهد) ---------- */
const mem = new Map();
export const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch { mem.set(k, v); }
  },
  remove(k) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    mem.delete(k);
  },
};

/* ---------- ساعت: «امروز» از سرور و به وقت تهران ---------- */
let offset = 0;
export const nowMs = () => Date.now() + offset;
export const today = () => tehranDay(nowMs());
export async function syncClock() {
  try {
    const t0 = Date.now();
    const { data, error } = await sb.rpc('gl_now');
    if (error || !data) return;
    const t1 = Date.now();
    offset = new Date(data).getTime() - (t0 + t1) / 2;
  } catch { /* اگر شکست خورد، ساعت دستگاه (با منطقه زمانی تهران) استفاده می‌شود */ }
}
