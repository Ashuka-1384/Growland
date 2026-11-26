import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssMinify: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // کتابخانه‌های سنگین جدا می‌شوند تا بین دیپلوی‌ها کش مرورگر حفظ شود
        manualChunks: {
          react: ['react', 'react-dom'],
          postgrest: ['@supabase/postgrest-js'],
        },
      },
    },
  },
});
