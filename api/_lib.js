// کمک‌های مشترک توابع سرور Vercel (فایل‌های با پیشوند _ به‌عنوان endpoint منتشر نمی‌شوند)
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL as CFG_URL } from '../src/config.js';

export const supabaseAdmin = () =>
  createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || CFG_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let ready = false;
export function initPush() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@growland.app',
    process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  ready = true;
}

export const clip = (s, n = 110) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/** ارسال اعلان به همه‌ی دستگاه‌های چند کاربر؛ اشتراک‌های منقضی‌شده (404/410) حذف می‌شوند */
export async function sendToUsers(sb, userIds, payload) {
  if (!userIds.length) return { sent: 0, removed: 0 };
  const { data: subs, error } = await sb.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', userIds);
  if (error) throw error;
  const body = JSON.stringify(payload);
  let sent = 0;
  const dead = [];
  await Promise.allSettled(
    (subs || []).map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 })
        .then(() => { sent += 1; })
        .catch((e) => { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint); }),
    ),
  );
  if (dead.length) await sb.from('push_subscriptions').delete().in('endpoint', dead);
  return { sent, removed: dead.length };
}
