import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server:{
    proxy:{
      '/api': 'https://localhost:5000' // Redirects all /api requests to your backend
    }
  }
});
