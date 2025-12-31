import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server:{
    proxy:{
      '/api': 'http://10.10.35.219:5000/' // Redirects all /api requests to your backend
    },
    
    host: true, // bind to 0.0.0.0
    watch: {
      usePolling: true, // necessary for Docker on Windows/macOS
    },
  }
});
