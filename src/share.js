import { level, tierOf, xpInto, LEVEL_XP, nf } from './db.js';

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

/** ساخت کارت دستاورد (PNG) و اشتراک‌گذاری با Web Share؛ اگر پشتیبانی نشد دانلود می‌شود */
export async function shareCard({ user, streak = 0, rank = null }) {
  const W = 1080, H = 1350;
  const lv = level(user.xp);
  const t = tierOf(lv);
  try { await Promise.all([document.fonts.load('800 60px Vazirmatn'), document.fonts.load('900 60px Orbitron')]); } catch { /* ignore */ }

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#222c47'); bg.addColorStop(1, '#0e1425');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 560);
  glow.addColorStop(0, t.c + '66'); glow.addColorStop(1, t.c + '00');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  const logo = await loadImg('/logo.jpg');
  if (logo) { ctx.save(); round(ctx, W / 2 - 100, 70, 200, 200, 40); ctx.clip(); ctx.drawImage(logo, W / 2 - 100, 70, 200, 200); ctx.restore(); }

  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#edf2fb';
  ctx.font = '800 78px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(user.name, W / 2, 400, W - 140);
  ctx.fillStyle = t.c;
  ctx.font = '600 44px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(`${t.name} · ${t.en}`, W / 2, 470);

  ctx.direction = 'ltr';
  ctx.fillStyle = t.c;
  ctx.font = '900 250px Orbitron, sans-serif';
  ctx.fillText(`LV ${lv}`, W / 2, 740);

  // نوار پیشرفت
  const bx = 150, bw = W - 300, by = 800;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; round(ctx, bx, by, bw, 34, 17); ctx.fill();
  ctx.fillStyle = t.c; round(ctx, bx, by, Math.max(34, (bw * xpInto(user.xp)) / LEVEL_XP), 34, 17); ctx.fill();

  // آمار
  ctx.direction = 'rtl';
  const stats = [[nf(user.xp), 'مجموع XP'], [nf(streak), 'روز پیوسته'], [rank ? nf(rank) : '—', 'رتبه']];
  stats.forEach(([v, l], i) => {
    const cx = 180 + i * ((W - 360) / 2);
    ctx.fillStyle = '#edf2fb'; ctx.font = '800 76px Vazirmatn, Tahoma, sans-serif'; ctx.fillText(v, cx, 1010);
    ctx.fillStyle = '#9eabc9'; ctx.font = '400 36px Vazirmatn, Tahoma, sans-serif'; ctx.fillText(l, cx, 1070);
  });

  ctx.fillStyle = '#9eabc9';
  ctx.font = '600 40px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText('رشد خود را اندازه‌گیری کنید', W / 2, 1220);
  ctx.fillStyle = '#4ade80';
  ctx.direction = 'ltr';
  ctx.font = '900 46px Orbitron, sans-serif';
  ctx.fillText('GrowLand', W / 2, 1290);

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('canvas');
  const file = new File([blob], 'growland-card.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'GrowLand', text: `من در گرولند به لول ${nf(lv)} رسیدم!` });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = 'growland-card.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
