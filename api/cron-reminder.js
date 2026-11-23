// Vercel Cron: هر روز ساعت ۱۸:۰۰ تهران به کسانی که امروز گزارش امتیازدار نداده‌اند یادآوری می‌فرستد.
// (زمان‌بندی در vercel.json؛ Vercel خودکار هدر Authorization: Bearer CRON_SECRET را می‌فرستد)
import { initPush, sendToUsers, supabaseAdmin } from './_lib.js';

const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    initPush();
    const sb = supabaseAdmin();
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }); // YYYY-MM-DD

    const { data: subs, error } = await sb.from('push_subscriptions').select('user_id');
    if (error) throw error;
    const ids = [...new Set((subs || []).map((s) => s.user_id))];

    const done = new Set();
    const inactive = new Set();
    for (const part of chunks(ids, 200)) {
      const [{ data: acts }, { data: profs }] = await Promise.all([
        sb.from('activity').select('user_id').eq('day', day).gt('count', 0).in('user_id', part),
        sb.from('profiles').select('id,active').in('id', part),
      ]);
      (acts || []).forEach((a) => done.add(a.user_id));
      (profs || []).forEach((p) => { if (p.active === false) inactive.add(p.id); });
    }
    const targets = ids.filter((id) => !done.has(id) && !inactive.has(id));
    const out = await sendToUsers(sb, targets, {
      title: 'یادآوری گزارش روزانه',
      body: 'امروز گزارش رشدت را ثبت کردی؟ زنجیره فعالیتت را حفظ کن.',
      url: '/#/report',
      tag: 'daily-reminder',
    });
    return res.status(200).json({ targets: targets.length, ...out });
  } catch (e) {
    console.error('cron error', e);
    return res.status(500).json({ error: 'cron_failed' });
  }
}
