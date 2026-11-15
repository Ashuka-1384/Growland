import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT');
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ستون‌های عمومی (بدون رمز عبور و شماره موبایل)
export const PUBLIC_COLS = 'id,name,age,city,field,role,xp,supervisor_id,created_at';
export const level = (xp) => Math.floor((xp || 0) / 1000) + 1;
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
    .replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
    .replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
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
