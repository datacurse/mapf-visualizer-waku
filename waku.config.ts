import { defineConfig } from 'waku/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  vite: {
    ssr: { noExternal: ['two.js'] },
    plugins: [
      tsconfigPaths({ root: fileURLToPath(new URL('.', import.meta.url)) }),
    ]
  }
})
