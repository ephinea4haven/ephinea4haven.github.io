import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: '/index.html',
    // Dev-only: force browser to always re-fetch, never cache.
    // Avoids stale stylesheet cache when HMR fails to connect.
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});
