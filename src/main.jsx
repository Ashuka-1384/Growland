import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
try { document.documentElement.dataset.theme = localStorage.getItem('gl_theme') || 'dim'; } catch (e) { document.documentElement.dataset.theme = 'dim'; }
createRoot(document.getElementById('root')).render(<App />);
