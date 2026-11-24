import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          jackattack: path.resolve(__dirname, 'jackattack/index.html'),
          ayo: path.resolve(__dirname, 'ayo/index.html'),
          rules: path.resolve(__dirname, 'rules/index.html'),
          ayoRules: path.resolve(__dirname, 'ayo-rules/index.html'),
          privacy: path.resolve(__dirname, 'privacy/index.html'),
        },
      },
    },
  };
});
