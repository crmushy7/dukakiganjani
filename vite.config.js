import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/, // 👈 THIS is the real fix
  },
});