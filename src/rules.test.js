import test from 'node:test';
import assert from 'node:assert/strict';
import {
  level, xpInto, xpToNext, tehranDay, addDays, last7, streakOf, normFa, fixFa, fa2en, escLike,
  canManage, reportEligibility, validateProfile, TIERS, tierOf, nextTier, tierXpRange, ACHIEVEMENTS,
  isCeleb, MIN_CHARS, LEVEL_XP, weekdayName,
} from './rules.js';

test('level و xpInto', () => {
  assert.equal(level(0), 1);
  assert.equal(level(999), 1);
  assert.equal(level(1000), 2);
  assert.equal(level(-50), 1);
  assert.equal(level(undefined), 1);
  assert.equal(level('2500'), 3);
  assert.equal(xpInto(1250), 250);
  assert.equal(xpToNext(1250), 750);
  assert.equal(xpToNext(0), LEVEL_XP);
});

test('tehranDay: مرز نیمه‌شب تهران (UTC+3:30)', () => {
  assert.equal(tehranDay(Date.parse('2026-11-19T20:29:59Z')), '2026-11-19');
  assert.equal(tehranDay(Date.parse('2026-11-19T20:30:00Z')), '2026-11-20');
  assert.equal(tehranDay(Date.parse('2026-12-31T21:00:00Z')), '2027-01-01');
});

test('addDays و last7 بدون وابستگی به timezone دستگاه', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  const w = last7('2026-11-20');
  assert.equal(w.length, 7);
  assert.equal(w[0].day, '2026-11-14');
  assert.equal(w[6].day, '2026-11-20');
  assert.equal(weekdayName('2026-11-20'), 'جمعه');
});

test('streakOf در مرز تاریخ', () => {
  const today = '2026-11-20';
  const mk = (...days) => days.map((day) => ({ day, count: 1 }));
  assert.equal(streakOf([], today), 0);
  assert.equal(streakOf(mk('2026-11-20', '2026-11-19', '2026-11-18'), today), 3);
  // امروز هنوز فعالیتی ندارد ولی دیروز داشته → زنجیره حفظ می‌شود
  assert.equal(streakOf(mk('2026-11-19', '2026-11-18'), today), 2);
  // دو روز پیش آخرین فعالیت بوده → زنجیره قطع است
  assert.equal(streakOf(mk('2026-11-18', '2026-11-17'), today), 0);
  // عبور از مرز ماه و سال
  assert.equal(streakOf(mk('2027-01-01', '2026-12-31', '2026-12-30'), '2027-01-01'), 3);
  // count صفر حساب نمی‌شود
  assert.equal(streakOf([{ day: today, count: 0 }], today), 0);
  // بیش از ۱۰۰ روز هم محدود نمی‌شود
  const long = []; for (let i = 0; i < 150; i++) long.push({ day: addDays(today, -i), count: 1 });
  assert.equal(streakOf(long, today), 150);
});

test('normFa: ي/ك، ارقام، نیم‌فاصله و اعراب', () => {
  assert.equal(normFa('علي'), normFa('علی'));
  assert.equal(normFa('كاظم'), normFa('کاظم'));
  assert.equal(normFa('علی‌رضا'), normFa('علیرضا'));
  assert.equal(normFa('محمَّد'), normFa('محمد'));
  assert.equal(normFa('  ۰۹۱۲  '), '0912');
  assert.equal(normFa('٠٩١٢'), '0912');
  assert.equal(normFa('Ali  REZA'), 'ali reza');
  assert.equal(normFa(null), '');
  assert.equal(fixFa('  علي   كريمي '), 'علی کریمی');
  assert.equal(fa2en('۰۹۳۳۳۱۶۷۲۷۹'), '09333167279');
  assert.equal(escLike('50%_a\\b'), '50\\%\\_a\\\\b');
});

test('reportEligibility: قوانین یکسان با سرور', () => {
  assert.equal(reportEligibility('').reason, 'empty');
  assert.equal(reportEligibility('سلام').reason, 'too_short');
  assert.equal(reportEligibility('  سلام  ').chars, 4);
  const spam = 'ا'.repeat(200);
  assert.equal(reportEligibility(spam).reason, 'few_words');
  const words = Array.from({ length: 40 }, () => 'سلام').join(' ');
  assert.equal(reportEligibility(words).reason, 'low_variety');
  const real = 'امروز یک ساعت روی پروژه کار کردم و بخش ثبت‌نام را تمام کردم؛ سپس خطاهای فرم را بررسی و چند مورد را اصلاح کردم تا تجربه کاربر بهتر شود و تست‌ها هم بدون مشکل اجرا شوند.';
  const r = reportEligibility(real);
  assert.ok(real.length >= MIN_CHARS);
  assert.equal(r.ok, true);
  assert.equal(r.reason, null);
  // فاصله‌های اضافه طول را بیشتر نمی‌کنند
  assert.equal(reportEligibility(' '.repeat(300) + 'سلام').chars, 4);
});

test('validateProfile', () => {
  const ok = { name: 'علی', age: '۲۵', city: 'تهران', phone: '۰۹۱۲۳۴۵۶۷۸۹', password: 'x' };
  assert.equal(validateProfile(ok), '');
  assert.match(validateProfile({ ...ok, age: '3' }), /سن/);
  assert.match(validateProfile({ ...ok, age: '121' }), /سن/);
  assert.match(validateProfile({ ...ok, city: ' ' }), /شهر/);
  assert.match(validateProfile({ ...ok, phone: '123' }), /موبایل/);
  assert.match(validateProfile({ ...ok, password: '' }), /رمز/);
  assert.equal(validateProfile({ ...ok, password: '' }, { needPassword: false }), '');
});

test('canManage', () => {
  const sup = { id: 's', role: 'super' };
  const adm = { id: 'a', role: 'admin' };
  assert.equal(canManage(sup, { id: 'x', supervisor_id: null }), true);
  assert.equal(canManage(adm, { id: 'x', supervisor_id: 'a' }), true);
  assert.equal(canManage(adm, { id: 'x', supervisor_id: 'b' }), false);
  assert.equal(canManage({ id: 'm', role: 'member' }, { id: 'x', supervisor_id: 'm' }), false);
  assert.equal(canManage(null, { id: 'x' }), false);
});

test('tiers', () => {
  assert.equal(tierOf(1).en, 'NOVICE');
  assert.equal(tierOf(3).en, 'APPRENTICE');
  assert.equal(tierOf(16).en, 'MASTER');
  assert.equal(tierOf(99).en, 'MASTER');
  assert.equal(nextTier(16), null);
  assert.equal(nextTier(1).en, 'APPRENTICE');
  assert.deepEqual(tierXpRange('NOVICE'), { lo: 0, hi: 1000 });
  assert.deepEqual(tierXpRange('MASTER'), { lo: 15000, hi: null });
  assert.equal(tierXpRange('nope'), null);
  assert.equal(TIERS.length, 6);
});

test('دستاوردها و celebrate', () => {
  const s = { reports: 100, streak: 100, level: 16, skills: 3, maxSkill: 500 };
  assert.ok(ACHIEVEMENTS.every((a) => a.ok(s)));
  assert.ok(ACHIEVEMENTS.every((a) => !a.ok({ reports: 0, streak: 0, level: 1, skills: 0, maxSkill: 0 })));
  assert.equal(isCeleb(950, 1050).level, 2);
  assert.equal(isCeleb(950, 1050).tierUp, true);
  assert.equal(isCeleb(1050, 1150), null);
  assert.equal(isCeleb(1950, 2050).tierUp, false);
});
