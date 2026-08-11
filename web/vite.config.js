import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    // 字体包 CSS 预改写：font-display swap → optional
    // swap 会让文本先用系统字体渲染、字体就绪后替换，造成 FOUT 字体抖动；
    // optional 保证"要么 100ms 内用上缓存字体、要么本次用回退字体且不再替换"，彻底消除抖动
    {
      name: 'font-display-optional',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.css') && /fontsource|lxgw-wenkai/.test(id)) {
          return code.replace(/font-display:\s*swap/g, 'font-display: optional');
        }
        return null;
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/favicons': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/logo': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // 构建时注入版本号，用于前端版本比对和缓存破坏
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // 文件名加 hash，每次构建自动刷新浏览器缓存
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
        // 将 echarts 相关库拆分为独立 vendor chunk：
        // 仅在访问后台 Dashboard 时加载，避免 echarts 体积拖累 Dashboard 页面 chunk，并可独立长缓存
        manualChunks(id) {
          if (
            id.includes('node_modules') &&
            (id.includes('echarts') || id.includes('zrender'))
          ) {
            return 'echarts-vendor';
          }
        },
        // 生产构建时移除 console.*（Vite 8 用 oxc minifier，配置走 rolldownOptions）
        // 仅在 build 阶段生效，dev 阶段保留 console 便于调试
        ...(command === 'build' ? {
          minify: {
            compress: { dropConsole: true, dropDebugger: true },
          },
        } : {}),
      },
    },
    target: 'es2020',
  },
}));
