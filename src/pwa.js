import { useEffect, useState } from 'react';

/* ---------- ثبت سرویس‌ورکر و مدیریت بروزرسانی ---------- */
let reg = null;
let waiting = null;
let updating = false;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
const subscribeStore = (f) => { listeners.add(f); return () => listeners.delete(f); };

function trackWaiting(r) {
  const check = () => {
    if (r.waiting && navigator.serviceWorker.controller) { waiting = r.waiting; emit(); }
  };
  check();
  r.addEventListener('updatefound', () => {
    const w = r.installing;
    if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
  });
}

/** فقط در نسخه‌ی ساخته‌شده (نه dev) */
export function registerSW() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) window.location.reload(); // فقط وقتی کاربر خودش «بروزرسانی» را زده
  });
  window.addEventListener('load', async () => {
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
      trackWaiting(reg);
      const check = () => reg.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    } catch { /* بدون سرویس‌ورکر هم اپ کار می‌کند */ }
  });
}

export function applyUpdate() {
  if (!waiting) return;
  updating = true;
  waiting.postMessage('SKIP_WAITING');
}

export function useUpdateReady() {
  const [, force] = useState(0);
  useEffect(() => subscribeStore(() => force((n) => n + 1)), []);
  return !!waiting;
}

/* ---------- نصب ---------- */
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

/** وضعیت نصب: canInstall (اندروید/کروم)، ios (راهنمای Home Screen)، installed */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => subscribeStore(() => force((n) => n + 1)), []);
  const installed = isStandalone();
  return {
    installed,
    canInstall: !!deferred && !installed,
    ios: isIOS() && !installed,
    install: async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      emit();
    },
  };
}

/* ---------- لرزش، نشان آیکون، وضعیت اینترنت ---------- */
export const haptic = (pattern = 10) => { try { navigator.vibrate?.(pattern); } catch { /* ignore */ } };

/** عدد روی آیکون اپ (Badging API؛ روی پشتیبانی‌نکننده‌ها بی‌اثر است) */
export const setBadge = (n) => {
  try {
    Promise.resolve(n > 0 ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.()).catch(() => {});
  } catch { /* ignore */ }
};

export function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

/** مخفی‌شدن نوار پایین هنگام اسکرول به پایین */
export function useNavHidden(enabled) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let last = window.scrollY;
    let busy = false;
    const on = () => {
      if (busy) return;
      busy = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const d = y - last;
        if (Math.abs(d) > 8) { setHidden(d > 0 && y > 120); last = y; }
        busy = false;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [enabled]);
  return hidden;
}

/* ---------- Push ---------- */
const VAPID = import.meta.env?.VITE_VAPID_PUBLIC_KEY || '';
export const pushSupported = () =>
  !!VAPID && import.meta.env.PROD && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
export async function getPushSub() {
  const r = await navigator.serviceWorker.ready;
  return r.pushManager.getSubscription();
}
export async function subscribePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const r = await navigator.serviceWorker.ready;
  const sub = (await r.pushManager.getSubscription())
    || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }));
  return sub.toJSON();
}
export async function unsubscribePush() {
  const sub = await getPushSub();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
