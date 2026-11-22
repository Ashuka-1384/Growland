/**
 * قوانین بازی و توابع خالص گرولند.
 * این فایل هیچ وابستگی به مرورگر یا Supabase ندارد و با `npm test` تست می‌شود.
 * ثابت‌ها باید با تابع gl_cfg() در supabase.sql یکی بمانند.
 */

/* ---------- ثابت‌های بازی (تنها منبع حقیقت در کلاینت) ---------- */
export const TZ = 'Asia/Tehran';
export const LEVEL_XP = 1000;
export const MIN_CHARS = 150;
export const MIN_WORDS = 15;
export const MIN_DISTINCT = 20;
export const REPORT_XP = 100;
export const DAILY_REPORT_CAP = 3;
export const MAX_REPORT_CHARS = 5000;
export const MAX_MSG_CHARS = 2000;
export const MIN_AGE = 5;
export const MAX_AGE = 120;

export const roleName = { member: 'عضو', admin: 'ادمین', super: 'سوپر ادمین' };

/* ---------- لول و XP ---------- */
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
export const level = (xp) => Math.floor(Math.max(0, num(xp)) / LEVEL_XP) + 1;
export const xpInto = (xp) => Math.max(0, num(xp)) % LEVEL_XP;
export const xpToNext = (xp) => LEVEL_XP - xpInto(xp);

/* ---------- تاریخ (همیشه به وقت تهران) ---------- */
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** timestamp (ms) → «YYYY-MM-DD» به وقت تهران */
export function tehranDay(ms) {
  const p = {};
  for (const x of dayFmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
export const dayOfTs = (ts) => tehranDay(new Date(ts).getTime());

/** جمع/تفریق روز روی رشته‌ی تاریخ؛ مستقل از timezone دستگاه */
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const daysAgo = (n, today) => addDays(today, -n);
export const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
export const weekdayName = (day) => WEEKDAYS[weekdayOf(day)];

/** ۷ روز اخیر (قدیمی‌ترین اول) نسبت به today */
export function last7(today) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, label: weekdayName(day) });
  }
  return out;
}

/** تعداد روزهای متوالی فعالیت؛ اگر امروز فعالیتی نیست از دیروز می‌شمارد */
export function streakOf(acts, today) {
  const set = new Set((acts || []).filter((a) => a.count > 0).map((a) => a.day));
  let d = today;
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/* نمایش تاریخ شمسی */
export const fmt = (ts) => new Date(ts).toLocaleString('fa-IR', { timeZone: TZ });
export const fmtDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fa-IR', { timeZone: 'UTC' });
export const nf = (n) => Number(n || 0).toLocaleString('fa-IR');

/* ---------- نرمال‌سازی متن فارسی ---------- */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const CHAR_MAP = { '\u064A': '\u06CC', '\u0643': '\u06A9', '\u0629': '\u0647', '\u06C0': '\u0647', '\u0623': '\u0627', '\u0625': '\u0627', '\u0671': '\u0627' };

/** ارقام فارسی و عربی → انگلیسی */
export const fa2en = (s) =>
  String(s ?? '')
    .replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c)))
    .trim();

/** برای ذخیره: ي→ی ، ك→ک و فاصله‌های اضافه (معادل gl_fa در SQL) */
export const fixFa = (s) =>
  String(s ?? '')
    .replace(/\u064A/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(/\s+/g, ' ')
    .trim();

/** برای جستجو و مقایسه (معادل gl_norm در SQL) */
export const normFa = (s) =>
  fa2en(s)
    .replace(/[\u064A\u0643\u0629\u06C0\u0623\u0625\u0671]/g, (c) => CHAR_MAP[c])
    .replace(/[\u200C\u200D\u0640\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** فرار دادن % _ \ برای الگوی ilike */
export const escLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

/* ---------- دسترسی ---------- */
export const canManage = (admin, member) =>
  !!admin && !!member && (admin.role === 'super' || (admin.role === 'admin' && member.supervisor_id === admin.id));

/* ---------- اعتبارسنجی گزارش (همان قوانین submit_report در SQL) ---------- */
export function reportStats(text) {
  const norm = String(text ?? '').trim().replace(/\s+/g, ' ');
  return {
    chars: norm.length,
    words: norm ? norm.split(' ').length : 0,
    distinct: new Set([...norm.toLowerCase().replace(/\s/g, '')]).size,
  };
}

/**
 * @returns {{ ok: boolean, reason: null|'empty'|'too_short'|'few_words'|'low_variety', chars: number, words: number, distinct: number }}
 */
export function reportEligibility(text) {
  const s = reportStats(text);
  let reason = null;
  if (s.chars === 0) reason = 'empty';
  else if (s.chars < MIN_CHARS) reason = 'too_short';
  else if (s.words < MIN_WORDS) reason = 'few_words';
  else if (s.distinct < MIN_DISTINCT) reason = 'low_variety';
  return { ok: reason === null, reason, ...s };
}

/** متن راهنما برای دلیل XP نگرفتن (پاسخ سرور یا بررسی کلاینت) */
export function reasonText(reason) {
  switch (reason) {
    case 'too_short': return `برای دریافت XP حداقل ${nf(MIN_CHARS)} حرف لازم است.`;
    case 'few_words': return `برای دریافت XP حداقل ${nf(MIN_WORDS)} کلمه لازم است.`;
    case 'low_variety': return 'متن گزارش تنوع کافی ندارد؛ لطفاً توضیح واقعی بنویسید.';
    case 'daily_cap': return `سقف ${nf(DAILY_REPORT_CAP)} گزارش امتیازدار در روز تکمیل شده است.`;
    case 'duplicate': return 'این متن قبلاً ثبت شده است؛ گزارش تکراری XP ندارد.';
    default: return '';
  }
}

/* ---------- اعتبارسنجی پروفایل/ثبت‌نام (یک تعریف برای هر دو) ---------- */
/** @returns {string} پیام خطا یا رشته‌ی خالی */
export function validateProfile(f, { needPassword = true } = {}) {
  const name = fixFa(f.name);
  const city = fixFa(f.city);
  const age = parseInt(fa2en(f.age), 10);
  if (!name || name.length > 80) return 'اسم را وارد کنید (حداکثر ۸۰ حرف)';
  if (!(age >= MIN_AGE && age <= MAX_AGE)) return `سن باید بین ${nf(MIN_AGE)} تا ${nf(MAX_AGE)} باشد`;
  if (!city || city.length > 80) return 'شهر را وارد کنید (حداکثر ۸۰ حرف)';
  if (!/^09\d{9}$/.test(fa2en(f.phone))) return 'شماره موبایل باید به شکل 09123456789 باشد';
  if (needPassword && !f.password) return 'رمز عبور را وارد کنید';
  if (f.password && f.password.length > 100) return 'رمز عبور بیش از حد طولانی است';
  return '';
}

/* ---------- سطوح تخصص ---------- */
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
export const tierOf = (lv) => {
  let t = TIERS[0];
  for (const x of TIERS) if (lv >= x.min) t = x;
  return t;
};
export const nextTier = (lv) => TIERS.find((t) => t.min > lv) || null;

/** بازه‌ی XP یک سطح تخصص: [lo, hi) ؛ hi=null یعنی بدون سقف */
export function tierXpRange(en) {
  const i = TIERS.findIndex((t) => t.en === en);
  if (i < 0) return null;
  return { lo: (TIERS[i].min - 1) * LEVEL_XP, hi: TIERS[i + 1] ? (TIERS[i + 1].min - 1) * LEVEL_XP : null };
}

/* ---------- دستاوردها ---------- */
/** stats: { reports (گزارش‌های امتیازدار), streak, level, skills, maxSkill } */
export const ACHIEVEMENTS = [
  { id: 'first', icon: 'file', name: 'آغاز فعالیت', desc: 'ثبت اولین گزارش امتیازدار', ok: (s) => s.reports >= 1 },
  { id: 'r10', icon: 'check', name: 'ثبات عملکرد', desc: 'ثبت ۱۰ گزارش امتیازدار', ok: (s) => s.reports >= 10 },
  { id: 'r50', icon: 'chart', name: 'تعهد حرفه‌ای', desc: 'ثبت ۵۰ گزارش امتیازدار', ok: (s) => s.reports >= 50 },
  { id: 'r100', icon: 'trophy', name: 'پشتکار مثال‌زدنی', desc: 'ثبت ۱۰۰ گزارش امتیازدار', ok: (s) => s.reports >= 100 },
  { id: 's3', icon: 'target', name: 'انضباط', desc: '۳ روز فعالیت پیوسته', ok: (s) => s.streak >= 3 },
  { id: 's7', icon: 'trend', name: 'پایداری هفتگی', desc: '۷ روز فعالیت پیوسته', ok: (s) => s.streak >= 7 },
  { id: 's30', icon: 'shield', name: 'استمرار ماهانه', desc: '۳۰ روز فعالیت پیوسته', ok: (s) => s.streak >= 30 },
  { id: 's100', icon: 'flame', name: 'تعهد بلندمدت', desc: '۱۰۰ روز فعالیت پیوسته', ok: (s) => s.streak >= 100 },
  { id: 'l2', icon: 'star', name: 'ارتقا به کارآموز', desc: 'رسیدن به لول ۲', ok: (s) => s.level >= 2 },
  { id: 'l4', icon: 'star', name: 'ارتقا به حرفه‌ای', desc: 'رسیدن به لول ۴', ok: (s) => s.level >= 4 },
  { id: 'l7', icon: 'zap', name: 'ارتقا به متخصص', desc: 'رسیدن به لول ۷', ok: (s) => s.level >= 7 },
  { id: 'l11', icon: 'trophy', name: 'ارتقا به خبره', desc: 'رسیدن به لول ۱۱', ok: (s) => s.level >= 11 },
  { id: 'l16', icon: 'trophy', name: 'ارتقا به استاد', desc: 'رسیدن به لول ۱۶', ok: (s) => s.level >= 16 },
  { id: 'sk3', icon: 'grid', name: 'تنوع مهارتی', desc: 'ثبت حداقل ۳ مهارت', ok: (s) => s.skills >= 3 },
  { id: 'sk500', icon: 'target', name: 'تسلط تخصصی', desc: 'رسیدن یک مهارت به ۵۰۰ XP', ok: (s) => s.maxSkill >= 500 },
];

/** خطاهای ثبت گزارش که سرور برمی‌گرداند */
export const isCeleb = (oldXp, newXp) => {
  const a = level(oldXp), b = level(newXp);
  return b > a ? { level: b, tierUp: tierOf(b).en !== tierOf(a).en } : null;
};
