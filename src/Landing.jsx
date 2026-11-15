import { useEffect, useState } from 'react';
import { sb, level, nf } from './db.js';
import { Icon, Reveal, Avatar, Ring, Bg } from './ui.jsx';

const FEATURES = [
  ['chart', 'پنل رشد شخصی', 'لول، XP، مهارت‌ها و فعالیت هفتگی‌ات را در یک نگاه ببین.'],
  ['file', 'گزارش‌دهی دوطرفه', 'گزارش بفرست، از ادمین بازخورد بگیر و در همان گزارش گفتگو کن.'],
  ['zap', 'سیستم لول و XP', 'هر گزارش ۱۵۰ حرفی ۱۰۰ XP می‌دهد؛ هر ۱۰۰۰ XP یک لول بالاتر.'],
  ['target', 'نمودار راداری مهارت‌ها', 'تعادل مهارت‌هایت را ببین و بفهم کجا باید قوی‌تر شوی.'],
  ['shield', 'سرپرست و مدیریت', 'هر ادمین سرپرست گروهی از افراد است و رشدشان را همراهی می‌کند.'],
  ['users', 'اجتماع رشد', 'کارت اعضا، رتبه‌بندی و الهام گرفتن از مسیر دیگران.'],
];
const STEPS = [
  ['۱', 'ثبت‌نام کن', 'با چند اطلاعات ساده و انتخاب حوزه فعالیتت حسابت ساخته می‌شود.'],
  ['۲', 'گزارش بفرست', 'هر روز کارهایی که انجام دادی را بنویس و XP بگیر.'],
  ['۳', 'بازخورد بگیر', 'سرپرستت گزارشت را بررسی می‌کند و راه بهتر را نشانت می‌دهد.'],
  ['۴', 'لول بگیر', 'مهارت‌هایت رشد می‌کنند و در اجتماع بالاتر می‌روی.'],
];
const FAQ = [
  ['ثبت‌نام و استفاده رایگان است؟', 'بله، ثبت‌نام و استفاده از همه امکانات گرولند رایگان است.'],
  ['چطور XP می‌گیرم؟', 'با هر گزارش بالای ۱۵۰ حرف ۱۰۰ XP می‌گیری. ادمین‌ها هم می‌توانند XP را تنظیم کنند.'],
  ['فرق XP کل و XP مهارت چیست؟', 'XP کل لول تو را تعیین می‌کند. XP مهارت‌ها فقط در نمودار راداری و لیست مهارت‌ها نمایش داده می‌شود.'],
  ['گزارش‌هایم را چه کسی می‌بیند؟', 'ادمینی که سرپرست توست و سوپر ادمین. ادمین‌های دیگر به گزارش‌های تو دسترسی ندارند.'],
  ['می‌توانم اطلاعاتم را تغییر دهم؟', 'بله، از بخش «پروفایل» اسم، سن، شهر، شماره، رمز و حوزه فعالیتت را هر وقت خواستی عوض کن.'],
];

export default function Landing({ onAuth }) {
  const [stats, setStats] = useState({ users: 0, reports: 0, xp: 0, top: [] });
  const [fields, setFields] = useState([]);
  const [faq, setFaq] = useState(0);
  useEffect(() => {
    (async () => {
      const [p, r, f] = await Promise.all([
        sb.from('profiles').select('id,name,field,xp,role').order('xp', { ascending: false }),
        sb.from('reports').select('id', { count: 'exact', head: true }),
        sb.from('fields').select('*').order('id'),
      ]);
      const list = p.data || [];
      setStats({ users: list.length, reports: r.count || 0, xp: list.reduce((t, x) => t + x.xp, 0), top: list.slice(0, 5) });
      setFields(f.data || []);
    })();
  }, []);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="landing">
      <Bg />
      <header className="lnav clay">
        <img src="/logo.jpg" alt="GrowLand" className="mini-logo" />
        <nav className="llinks">
          <a onClick={() => go('features')}>ویژگی‌ها</a><a onClick={() => go('how')}>نحوه کار</a>
          <a onClick={() => go('levels')}>سیستم لول</a><a onClick={() => go('board')}>برترین‌ها</a><a onClick={() => go('faq')}>سوالات</a>
        </nav>
        <div className="row">
          <button className="btn small ghost" onClick={() => onAuth('login')}>ورود</button>
          <button className="btn small" onClick={() => onAuth('register')}>شروع رایگان</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="pill"><Icon n="leaf" size={16} /> سیستم ردیابی رشد و توسعه فردی</span>
          <h1>با هم <span className="grad">رشد کن</span>،<br />دورتر برو</h1>
          <p>گرولند جاییه که پیشرفتت دیده می‌شه. گزارش بده، XP بگیر، لول بزن و با کمک سرپرستت مسیر رشدت رو قدم به قدم بساز.</p>
          <div className="row wrap">
            <button className="btn big" onClick={() => onAuth('register')}>همین حالا شروع کن</button>
            <button className="btn big ghost" onClick={() => go('how')}>چطور کار می‌کنه؟</button>
          </div>
          <div className="hero-stats">
            <div><b>{nf(stats.users)}</b><small>عضو فعال</small></div>
            <div><b>{nf(stats.reports)}</b><small>گزارش ثبت‌شده</small></div>
            <div><b>{nf(stats.xp)}</b><small>XP کسب‌شده</small></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="clay mock">
            <div className="row between"><b>پنل رشد من</b><span className="chip">لول ۷</span></div>
            <div className="mock-body">
              <Ring value={640} max={1000} size={130} stroke={13}><b className="big-n">۶۴۰</b><small>XP</small></Ring>
              <div className="mock-bars">{[40, 70, 55, 90, 65, 100, 80].map((h, i) => <i key={i} style={{ height: h + '%' }} />)}</div>
            </div>
            <div className="skill"><div className="row between"><small>برنامه نویسی</small><small>۸۰٪</small></div><div className="bar"><div style={{ width: '80%' }} /></div></div>
            <div className="skill"><div className="row between"><small>تولید محتوا</small><small>۵۵٪</small></div><div className="bar"><div style={{ width: '55%' }} /></div></div>
          </div>
          <div className="clay float f1"><Icon n="flame" /> ۱۲ روز متوالی</div>
          <div className="clay float f2"><Icon n="zap" /> +۱۰۰ XP</div>
        </div>
      </section>

      <section id="features" className="sec">
        <Reveal><h2 className="sec-t">هر چی برای رشد لازم داری</h2><p className="sec-s">ساده، قدرتمند و کاملاً فارسی</p></Reveal>
        <div className="fgrid">
          {FEATURES.map(([ic, t, d], i) => (
            <Reveal key={t} delay={i * 70}><div className="clay feat"><div className="tile-i"><Icon n={ic} size={24} /></div><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="sec">
        <Reveal><h2 className="sec-t">مسیر رشد در ۴ قدم</h2></Reveal>
        <div className="steps">
          {STEPS.map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 90}><div className="clay step"><div className="num">{n}</div><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="levels" className="sec">
        <Reveal>
          <div className="clay levelbox">
            <div><h2 className="sec-t left">سیستم لول و XP</h2>
              <p>هر گزارش با حداقل <b>۱۵۰ حرف</b> برابر <b>۱۰۰ XP</b> است و با هر <b>۱۰۰۰ XP</b> یک لول بالاتر می‌روی. مهارت‌ها هم جداگانه XP می‌گیرند تا ببینی کدام توانایی‌ات قوی‌تر شده.</p>
              <button className="btn" onClick={() => onAuth('register')}>اولین گزارشت رو بفرست</button></div>
            <div className="ladder">{[1, 2, 3, 4, 5].map((l) => (
              <div key={l} className="clay-in rung" style={{ marginRight: (5 - l) * 14 }}><Icon n="star" size={18} /> لول {nf(l)} <small className="muted">{nf((l - 1) * 1000)} XP</small></div>
            ))}</div>
          </div>
        </Reveal>
      </section>

      {fields.length > 0 && (
        <section className="sec">
          <Reveal><h2 className="sec-t">حوزه‌های فعالیت</h2>
            <div className="chips center">{fields.map((f) => <span key={f.id} className="chip lg">{f.name}</span>)}</div></Reveal>
        </section>
      )}

      {stats.top.length > 0 && (
        <section id="board" className="sec">
          <Reveal><h2 className="sec-t">برترین اعضای گرولند</h2></Reveal>
          <Reveal><div className="clay board">
            {stats.top.map((m, i) => (
              <div key={m.id} className="boardrow"><span className="rank">{nf(i + 1)}</span><Avatar name={m.name} size={44} />
                <div className="grow"><b>{m.name}</b><br /><small className="muted">{m.field}</small></div>
                <span className="chip">لول {nf(level(m.xp))} · {nf(m.xp)} XP</span></div>
            ))}
          </div></Reveal>
        </section>
      )}

      <section className="sec">
        <Reveal><h2 className="sec-t">سه نقش، یک تیم</h2></Reveal>
        <div className="fgrid three">
          {[['user', 'عضو', 'گزارش می‌دهد، XP می‌گیرد و رشد می‌کند.'], ['shield', 'ادمین', 'سرپرست گروهی از اعضا؛ گزارش‌ها را بررسی و بازخورد می‌دهد.'], ['trophy', 'سوپر ادمین', 'نقش‌ها و سرپرستی‌ها را تعیین و کل سیستم را مدیریت می‌کند.']].map(([ic, t, d], i) => (
            <Reveal key={t} delay={i * 80}><div className="clay feat"><div className="tile-i"><Icon n={ic} size={24} /></div><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="faq" className="sec narrow-s">
        <Reveal><h2 className="sec-t">سوالات متداول</h2></Reveal>
        {FAQ.map(([q, a], i) => (
          <div key={q} className="clay faq" onClick={() => setFaq(faq === i ? -1 : i)}>
            <div className="row between"><b>{q}</b><span className={'chev ' + (faq === i ? 'open' : '')}>＋</span></div>
            {faq === i && <p>{a}</p>}
          </div>
        ))}
      </section>

      <section className="sec">
        <Reveal><div className="clay cta">
          <h2>آماده‌ای رشد کنی؟</h2><p>امروز اولین قدم رو بردار؛ گرولند کنارته.</p>
          <button className="btn big light" onClick={() => onAuth('register')}>ساخت حساب رایگان</button>
        </div></Reveal>
      </section>

      <footer className="foot"><img src="/logo.jpg" alt="" className="mini-logo" /><small className="muted">GrowLand — Grow Together, Go Further</small></footer>
    </div>
  );
}
