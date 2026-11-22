import { useState } from 'react';
import { useInstall } from './pwa.js';

/** دکمه «نصب اپ»: اندروید/کروم → پنجره نصب؛ iOS → راهنمای افزودن به Home Screen؛ بعد از نصب مخفی می‌شود */
export default function InstallButton({ className = 'btn small ghost' }) {
  const { canInstall, ios, installed, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed || (!canInstall && !ios)) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => (canInstall ? install() : setHelp(true))}>
        نصب اپ
      </button>
      {help && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setHelp(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
        >
          <div className="clay" onClick={(e) => e.stopPropagation()} style={{ padding: 20, maxWidth: 420, width: '100%' }}>
            <h3>نصب گرولند روی آیفون</h3>
            <p>۱. در Safari دکمه «اشتراک‌گذاری» (Share) را بزنید.</p>
            <p>۲. گزینه «Add to Home Screen» را انتخاب کنید.</p>
            <p>۳. روی «Add» بزنید.</p>
            <button type="button" className="btn small" onClick={() => setHelp(false)}>متوجه شدم</button>
          </div>
        </div>
      )}
    </>
  );
}
