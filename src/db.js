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

/* ---------- سطوح تخصص (Tier) ---------- */
const glow = (hex, a = 0.3) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const mk = (min, name, en, c) => ({ min, name, en, c, g: glow(c) });
export const TIERS = [
  mk(1, 'نوآموز', 'NOVICE', '#7b8fb0'),
  mk(2, 'کارآموز', 'APPRENTICE', '#0ea5e9'),
  mk(4, 'حرفه‌ای', 'PROFESSIONAL', '#10b981'),
  mk(7, 'متخصص', 'SPECIALIST', '#8b5cf6'),
  mk(11, 'خبره', 'EXPERT', '#f59e0b'),
  mk(16, 'استاد', 'MASTER', '#e11d48'),
];
export const tierOf = (lv) => { let t = TIERS[0]; for (const x of TIERS) if (lv >= x.min) t = x; return t; };
export const nextTier = (lv) => TIERS.find((t) => t.min > lv) || null;

/* ---------- دستاوردها ---------- */
export const ACHIEVEMENTS = [
  { id: 'first', icon: 'file', name: 'آغاز فعالیت', desc: 'ثبت اولین گزارش', ok: (s) => s.reports >= 1 },
  { id: 'r10', icon: 'check', name: 'ثبات عملکرد', desc: 'ثبت ۱۰ گزارش', ok: (s) => s.reports >= 10 },
  { id: 'r50', icon: 'chart', name: 'تعهد حرفه‌ای', desc: 'ثبت ۵۰ گزارش', ok: (s) => s.reports >= 50 },
  { id: 's3', icon: 'target', name: 'انضباط', desc: '۳ روز فعالیت پیوسته', ok: (s) => s.streak >= 3 },
  { id: 's7', icon: 'trend', name: 'پایداری هفتگی', desc: '۷ روز فعالیت پیوسته', ok: (s) => s.streak >= 7 },
  { id: 's30', icon: 'shield', name: 'استمرار ماهانه', desc: '۳۰ روز فعالیت پیوسته', ok: (s) => s.streak >= 30 },
  { id: 'l2', icon: 'star', name: 'ارتقا به کارآموز', desc: 'رسیدن به لول ۲', ok: (s) => s.level >= 2 },
  { id: 'l4', icon: 'star', name: 'ارتقا به حرفه‌ای', desc: 'رسیدن به لول ۴', ok: (s) => s.level >= 4 },
  { id: 'l7', icon: 'zap', name: 'ارتقا به متخصص', desc: 'رسیدن به لول ۷', ok: (s) => s.level >= 7 },
  { id: 'l11', icon: 'trophy', name: 'ارتقا به خبره', desc: 'رسیدن به لول ۱۱', ok: (s) => s.level >= 11 },
  { id: 'sk3', icon: 'grid', name: 'تنوع مهارتی', desc: 'ثبت حداقل ۳ مهارت', ok: (s) => s.skills >= 3 },
  { id: 'sk500', icon: 'target', name: 'تسلط تخصصی', desc: 'رسیدن یک مهارت به ۵۰۰ XP', ok: (s) => s.maxSkill >= 500 },
];
