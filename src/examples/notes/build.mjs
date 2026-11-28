import { join } from 'node:path';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

for (const ui of ['vue', 'react']) {
  await build({
    configFile: false,
    root: join(import.meta.dirname, 'ui', ui),
    plugins: ui === 'vue' ? [vue()] : [],
    build: { outDir: join(import.meta.dirname, 'dist', 'ui', ui), emptyOutDir: true },
  });
}
