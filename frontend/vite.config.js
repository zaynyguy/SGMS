import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server:{
    proxy:{
      '/api': 'https://sgms-production.up.railway.app' // Redirects all /api requests to your backend
    }
  }
});
