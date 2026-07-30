import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: 'Weimob Apollo 配置增强',
        namespace: 'weimob-apollo',
        match: [
          'https://apollo.internal.hsmob.com/*',
          'http://apollo.qa.internal.hsmob.com/*',
        ],
      },
    }),
  ],
});
