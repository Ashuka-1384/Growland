// Webhook دیتابیس: با هر پیام جدید ادمین / پیام جدید زیر گزارش، اعلان پوش می‌فرستد.
// (راه‌اندازی: supabase/push-webhooks.sql یا Dashboard > Database > Webhooks)
import { clip, initPush, sendToUsers, supabaseAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { type, table, record } = req.body || {};
  if (type !== 'INSERT' || !record) return res.status(200).json({ skipped: true });

  try {
    initPush();
    const sb = supabaseAdmin();
    let targets = [];
    let payload = null;

    if (table === 'admin_messages') {
      targets = [record.user_id];
      payload = { title: 'پیام جدید از ادمین', body: clip(record.content), url: '/#/messages', tag: 'admin-msg' };
    } else if (table === 'report_messages') {
      const { data: rep } = await sb.from('reports').select('user_id').eq('id', record.report_id).maybeSingle();
      if (rep) {
        if (record.sender_id !== rep.user_id) {
          targets = [rep.user_id];
          payload = { title: 'پاسخ جدید به گزارش شما', body: clip(record.content), url: '/#/report', tag: `thread-${record.report_id}` };
        } else {
          const { data: owner } = await sb.from('profiles').select('name,supervisor_id').eq('id', rep.user_id).maybeSingle();
          if (owner?.supervisor_id) {
            targets = [owner.supervisor_id];
            payload = { title: `پیام جدید از ${owner.name}`, body: clip(record.content), url: '/#/admin', tag: `thread-${record.report_id}` };
          }
        }
      }
    }

    if (!payload) return res.status(200).json({ skipped: true });
    return res.status(200).json(await sendToUsers(sb, targets, payload));
  } catch (e) {
    console.error('push error', e);
    return res.status(500).json({ error: 'push_failed' });
  }
}
