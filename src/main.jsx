import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import App from './App.jsx';
import { store } from './db.js';
import './styles.css';
import { registerSW } from './pwa.js';

// پوسته: انتخاب دستی کاربر اولویت دارد؛ وگرنه از تنظیم دستگاه (روشن/تیره) پیروی می‌کند
const mq = window.matchMedia('(prefers-color-scheme: light)');
const sysTheme = () => (mq.matches ? 'light' : 'dim');
document.documentElement.dataset.theme = store.get('gl_theme') || sysTheme();
mq.addEventListener?.('change', () => { if (!store.get('gl_theme')) document.documentElement.dataset.theme = sysTheme(); });
// رنگ نوار وضعیت گوشی با پوسته هماهنگ می‌ماند
const THEME_COLOR = { dim: '#1c2439', light: '#eaf0f7' };
const syncThemeColor = () => document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEME_COLOR[document.documentElement.dataset.theme] || THEME_COLOR.dim);
new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
syncThemeColor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerSW();
