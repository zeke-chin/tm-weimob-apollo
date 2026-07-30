import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

const REPOSITORY_URL = 'https://github.com/zeke-chin/tm-weimob-apollo';
const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest/download`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: 'Weimob Apollo 配置增强',
        namespace: 'tm-weimob-apollo',
        homepageURL: REPOSITORY_URL,
        supportURL: `${REPOSITORY_URL}/issues`,
        downloadURL: `${LATEST_RELEASE_URL}/tm-weimob-apollo.user.js`,
        updateURL: `${LATEST_RELEASE_URL}/tm-weimob-apollo.meta.js`,
        match: [
          'https://apollo.internal.hsmob.com/*',
          'http://apollo.qa.internal.hsmob.com/*',
        ],
      },
      build: {
        fileName: 'tm-weimob-apollo.user.js',
        metaFileName: true,
      },
    }),
  ],
});
