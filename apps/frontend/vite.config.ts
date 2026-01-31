import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // optional dev proxy if you set VITE_API_URL to ''
    }
  }
});
