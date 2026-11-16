import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT');
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ستون‌های عمومی (بدون رمز عبور و شماره موبایل)
export const PUBLIC_COLS = 'id,name,age,city,field,role,xp,supervisor_id,created_at';
export const level = (xp) => Math.floor(Math.max(0, xp || 0) / 1000) + 1;
export const xpInto = (xp) => Math.max(0, xp || 0) % 1000;
export const roleName = { member: 'عضو', admin: 'ادمین', super: 'سوپر ادمین' };
export const MIN_CHARS = 150;
export const REPORT_XP = 100;

const pad = (n) => String(n).padStart(2, '0');
export const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmt = (s) => new Date(s).toLocaleString('fa-IR');
const DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// ۷ روز اخیر (قدیمی‌ترین اول)
export function last7() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ day: dstr(d), label: DAYS[d.getDay()] });
  }
  return out;
}

export const fa2en = (s) =>
  String(s || '')
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .trim();

export const canManage = (admin, member) =>
  !!admin && (admin.role === 'super' || (admin.role === 'admin' && member.supervisor_id === admin.id));

// ثبت یک فعالیت برای امروز
export async function bumpToday(userId) {
  const day = dstr(new Date());
  const { data } = await sb.from('activity').select('*').eq('user_id', userId).eq('day', day).maybeSingle();
  if (data) await sb.from('activity').update({ count: data.count + 1 }).eq('id', data.id);
  else await sb.from('activity').insert({ user_id: userId, day, count: 1 });
}

export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dstr(d); };
// تعداد روزهای متوالی فعالیت
export function streakOf(acts) {
  const set = new Set(acts.filter((a) => a.count > 0).map((a) => a.day));
  const d = new Date();
  if (!set.has(dstr(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dstr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const nf = (n) => Number(n || 0).toLocaleString('fa-IR');

/* ---------- رتبه‌ها (Tier) ---------- */
const glow = (hex, a = 0.45) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const mk = (min, name, en, c) => ({ min, name, en, c, g: glow(c) });
export const TIERS = [
  mk(1, 'تازه‌وارد', 'ROOKIE', '#00e5ff'),
  mk(2, 'کاوشگر', 'EXPLORER', '#5dff7a'),
  mk(4, 'جنگجو', 'WARRIOR', '#a77bff'),
  mk(7, 'استاد', 'MASTER', '#ff3df0'),
  mk(11, 'افسانه', 'LEGEND', '#ffd23f'),
  mk(16, 'اسطوره', 'MYTHIC', '#ff5a3d'),
];
export const tierOf = (lv) => { let t = TIERS[0]; for (const x of TIERS) if (lv >= x.min) t = x; return t; };
export const nextTier = (lv) => TIERS.find((t) => t.min > lv) || null;

/* ---------- دستاورد‌ها ---------- */
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🌱', name: 'اولین گام', desc: 'اولین گزارشت رو بفرست', ok: (s) => s.reports >= 1 },
  { id: 'r10', icon: '📝', name: 'ده گزارش', desc: '۱۰ گزارش ثبت کن', ok: (s) => s.reports >= 10 },
  { id: 'r50', icon: '🏗️', name: 'پرکار', desc: '۵۰ گزارش ثبت کن', ok: (s) => s.reports >= 50 },
  { id: 's3', icon: '🔥', name: 'سه روز پیوسته', desc: '۳ روز پشت‌سرهم فعال باش', ok: (s) => s.streak >= 3 },
  { id: 's7', icon: '⚡', name: 'هفته آتشین', desc: '۷ روز پیوسته فعالیت', ok: (s) => s.streak >= 7 },
  { id: 's30', icon: '🛡️', name: 'اراده پولادین', desc: '۳۰ روز پیوسته فعالیت', ok: (s) => s.streak >= 30 },
  { id: 'l2', icon: '⭐', name: 'لول ۲', desc: 'به لول ۲ برس', ok: (s) => s.level >= 2 },
  { id: 'l5', icon: '🚀', name: 'لول ۵', desc: 'به لول ۵ برس', ok: (s) => s.level >= 5 },
  { id: 'l10', icon: '👑', name: 'لول ۱۰', desc: 'به لول ۱۰ برس', ok: (s) => s.level >= 10 },
  { id: 'sk3', icon: '🎯', name: 'چندمهارته', desc: 'حداقل ۳ مهارت داشته باش', ok: (s) => s.skills >= 3 },
  { id: 'sk500', icon: '💎', name: 'متخصص', desc: 'یک مهارت را به ۵۰۰ XP برسان', ok: (s) => s.maxSkill >= 500 },
];
