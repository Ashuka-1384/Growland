import { useEffect, useState } from 'react';
import { sb, level, xpInto, nf, TIERS, tierOf, PUBLIC_COLS } from './db.js';
import { Icon, Reveal, Avatar, Ring, Bg, MemberCard, CountUp, XpBar, Modal, ThemeToggle } from './ui.jsx';
import { MemberProfile } from './pages.jsx';

const FEATURES = [
  ['chart', 'پنل رشد شخصی', 'لول، XP، دستاوردها، نقشه فعالیت و مهارت‌های شما در یک پنل یکپارچه.'],
  ['file', 'گزارش‌دهی دوطرفه', 'گزارش روزانه ثبت کنید، بازخورد بگیرید و روی همان گزارش با سرپرست خود گفتگو کنید.'],
  ['zap', 'سیستم لول و XP', 'هر گزارش ۱۵۰ حرفی ۱۰۰ XP دارد و هر ۱۰۰۰ XP یک لول بالاتر است.'],
  ['target', 'نمودار راداری مهارت‌ها', 'توازن مهارت‌های خود را ببینید و نقاط قوت و ضعف را شناسایی کنید.'],
  ['shield', 'سرپرستی و مدیریت', 'هر ادمین سرپرست گروهی از اعضا است و گزارش‌ها و پیشرفت آن‌ها را پیگیری می‌کند.'],
  ['trophy', 'تالار افتخار', 'رتبه‌بندی شفاف بر اساس عملکرد و نمایش برترین اعضا.'],
];
const STEPS = [
  ['۱', 'ثبت‌نام', 'حساب کاربری بسازید و حوزه فعالیت خود را انتخاب کنید.'],
  ['۲', 'ثبت گزارش', 'فعالیت‌های روزانه را گزارش دهید و XP دریافت کنید.'],
  ['۳', 'دریافت بازخورد', 'سرپرست شما گزارش را بررسی و راهنمایی می‌کند.'],
  ['۴', 'ارتقای سطح', 'لول و رتبه شما با ثبات در فعالیت افزایش می‌یابد.'],
];
const FAQ = [
  ['ثبت‌نام و استفاده رایگان است؟', 'بله، همه امکانات گرولند رایگان است.'],
  ['XP چگونه کسب می‌شود؟', 'با ثبت هر گزارش بالای ۱۵۰ حرف، ۱۰۰ XP دریافت می‌کنید. ادمین‌ها نیز می‌توانند XP را تنظیم کنند.'],
  ['سطوح تخصص چگونه تعیین می‌شوند؟', 'سطح تخصص بر اساس لول شما تعیین می‌شود: نوآموز، کارآموز، حرفه‌ای، متخصص، خبره و استاد.'],
  ['دیگران چه اطلاعاتی از من می‌بینند؟', 'لول، XP، مهارت‌ها و نمودارهای رشد. محتوای گزارش‌ها فقط برای سرپرست و سوپر ادمین قابل مشاهده است.'],
  ['آیا می‌توانم اطلاعاتم را تغییر دهم؟', 'بله، از بخش «پروفایل» همه اطلاعات حساب قابل ویرایش است.'],
];
const RANGE = (i) => (TIERS[i + 1] ? `لول ${nf(TIERS[i].min)} تا ${nf(TIERS[i + 1].min - 1)}` : `لول ${nf(TIERS[i].min)} به بالا`);

export default function Landing({ onAuth }) {
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState({});
  const [reports, setReports] = useState(0);
  const [fields, setFields] = useState([]);
  const [faq, setFaq] = useState(0);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    (async () => {
      const [p, s, r, f] = await Promise.all([
        sb.from('profiles').select(PUBLIC_COLS).order('xp', { ascending: false }),
        sb.from('skills').select('id,user_id,name,xp'),
        sb.from('reports').select('id', { count: 'exact', head: true }),
        sb.from('fields').select('*').order('id'),
      ]);
      const g = {}; (s.data || []).forEach((x) => (g[x.user_id] = [...(g[x.user_id] || []), x]));
      setUsers(p.data || []); setSkills(g); setReports(r.count || 0); setFields(f.data || []);
    })();
  }, []);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const totalXp = users.reduce((t, x) => t + x.xp, 0);
  const top3 = users.slice(0, 3);
  const hall = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const rankOf = (m) => users.findIndex((x) => x.id === m.id) + 1;

  return (
    <div className="landing">
      <Bg />
      <header className="lnav clay">
        <img src="/logo.jpg" alt="GrowLand" className="mini-logo" />
        <nav className="llinks">
          <a onClick={() => go('hall')}>تالار افتخار</a><a onClick={() => go('features')}>امکانات</a>
          <a onClick={() => go('tiers')}>سطوح تخصص</a><a onClick={() => go('how')}>نحوه کار</a><a onClick={() => go('faq')}>سوالات متداول</a>
        </nav>
        <div className="row">
          <ThemeToggle />
          <button className="btn small ghost" onClick={() => onAuth('login')}>ورود</button>
          <button className="btn small" onClick={() => onAuth('register')}>ثبت‌نام</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="pill en"><Icon n="zap" size={14} /> GROW TOGETHER, GO FURTHER</span>
          <h1>رشد خود را <span className="grad">اندازه‌گیری کنید</span></h1>
          <p>گرولند سامانه ثبت و پیگیری رشد فردی است: گزارش‌های روزانه، امتیاز تجربه (XP)، سطح‌بندی مهارت‌ها و بازخورد سرپرست، همه در یک پنل.</p>
          <div className="row wrap">
            <button className="btn big" onClick={() => onAuth('register')}>ثبت‌نام و شروع</button>
            <button className="btn big ghost" onClick={() => go('hall')}>مشاهده برترین‌ها</button>
          </div>
          <div className="hero-stats">
            <div><b><CountUp to={users.length} /></b><small>عضو فعال</small></div>
            <div><b><CountUp to={reports} /></b><small>گزارش ثبت‌شده</small></div>
            <div><b><CountUp to={totalXp} /></b><small>XP کسب‌شده</small></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="clay mock" style={{ '--tc': '#10b981', '--tg': 'rgba(16,185,129,.3)' }}>
            <div className="row between"><small className="muted">نمونه پنل رشد</small><span className="chip">حرفه‌ای</span></div>
            <div className="mock-body">
              <Ring value={640} max={1000} size={130} stroke={9}><b className="big-n en">5</b><small className="en muted">LEVEL</small></Ring>
              <div className="mock-bars">{[40, 70, 55, 90, 65, 100, 80].map((h, i) => <i key={i} style={{ height: h + '%' }} />)}</div>
            </div>
            <div className="skill"><div className="row between"><small>برنامه نویسی</small><small className="en">80%</small></div><XpBar value={80} max={100} height={8} /></div>
            <div className="skill"><div className="row between"><small>تولید محتوا</small><small className="en">55%</small></div><XpBar value={55} max={100} height={8} /></div>
          </div>
          <div className="clay float f1"><Icon n="trend" size={16} /> ۱۲ روز فعالیت پیوسته</div>
          <div className="clay float f2"><Icon n="zap" size={16} /> +۱۰۰ XP</div>
        </div>
      </section>

      {top3.length > 0 && (
        <section id="hall" className="sec">
          <Reveal><h2 className="sec-t">تالار افتخار</h2><p className="sec-s">برترین اعضای گرولند بر اساس XP. برای مشاهده مسیر رشد هر عضو روی کارت او کلیک کنید.</p></Reveal>
          <Reveal><div className="hall">
            {hall.map((m) => <MemberCard key={m.id} m={m} rank={rankOf(m)} skills={skills[m.id]} onClick={() => setSel(m)} />)}
          </div></Reveal>
          {users.length > 3 && (
            <Reveal><div className="clay board">
              {users.slice(3, 8).map((m, i) => { const t = tierOf(level(m.xp)); return (
                <div key={m.id} className="boardrow" onClick={() => setSel(m)}>
                  <span className="rank en">{nf(i + 4)}</span><Avatar name={m.name} size={44} t={t} />
                  <div className="grow"><b>{m.name}</b><br /><small className="muted">{m.field} · {t.name}</small></div>
                  <div className="boardxp"><XpBar value={xpInto(m.xp)} height={6} /></div>
                  <span className="chip">لول {nf(level(m.xp))} · {nf(m.xp)} XP</span>
                </div>); })}
            </div></Reveal>
          )}
          <div className="center" style={{ marginTop: 18 }}><button className="btn" onClick={() => onAuth('register')}>به جمع اعضا بپیوندید</button></div>
        </section>
      )}

      <section id="features" className="sec">
        <Reveal><h2 className="sec-t">امکانات</h2><p className="sec-s">ابزارهای لازم برای ثبت و پیگیری رشد</p></Reveal>
        <div className="fgrid">
          {FEATURES.map(([ic, t, d], i) => (
            <Reveal key={t} delay={i * 70}><div className="clay feat"><div className="tile-i"><Icon n={ic} size={24} /></div><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="tiers" className="sec">
        <Reveal><h2 className="sec-t">سطوح تخصص</h2><p className="sec-s">شش سطح؛ با افزایش لول، سطح تخصص شما ارتقا می‌یابد.</p></Reveal>
        <div className="tierpath">
          {TIERS.map((t, i) => (
            <Reveal key={t.en} delay={i * 80}><div className="tier-card" style={{ '--tc': t.c, '--tg': t.g }}>
              <small className="en">{t.en}</small><b>{t.name}</b><span>{RANGE(i)}</span>
            </div></Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="sec">
        <Reveal><h2 className="sec-t">نحوه کار</h2></Reveal>
        <div className="steps">
          {STEPS.map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 90}><div className="clay step"><div className="num">{n}</div><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section className="sec">
        <Reveal>
          <div className="clay levelbox">
            <div><h2 className="sec-t left">قوانین امتیازدهی</h2>
              <p>هر گزارش با حداقل <b>۱۵۰ حرف</b> برابر <b>۱۰۰ XP</b> است و با هر <b>۱۰۰۰ XP</b> یک لول بالاتر می‌روید. مهارت‌ها نیز XP جداگانه دارند تا توانایی‌های شما قابل مقایسه باشد.</p>
              <button className="btn" onClick={() => onAuth('register')}>شروع ثبت گزارش</button></div>
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
          <h2>مسیر رشد خود را از امروز ثبت کنید</h2><p>ثبت‌نام رایگان است و کمتر از یک دقیقه زمان می‌برد.</p>
          <button className="btn big" onClick={() => onAuth('register')}>ایجاد حساب رایگان</button>
        </div></Reveal>
      </section>

      <footer className="foot"><img src="/logo.jpg" alt="" className="mini-logo" /><small className="muted en">GrowLand — Grow Together, Go Further</small></footer>
      {sel && <Modal onClose={() => setSel(null)}><MemberProfile m={sel} rank={rankOf(sel)} /></Modal>}
    </div>
  );
}
