import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 빌드 결과를 dist/index.html 한 파일로 만든다 — 인터넷 없이 더블클릭으로 열린다.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
