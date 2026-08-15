import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    // 字体包 CSS 预改写：font-display optional → swap
    // optional 有 100ms 严格限制：慢网络（移动端）下载字体超时后本次用回退字体且不再替换，
    // 导致移动端永远显示系统回退字体（Android 无楷体/宋体 → 与 system 无差别）；
    // swap 保证字体就绪后必定替换：PC 缓存命中时 100ms 内就绪、几乎无感，移动端首载有一次替换但字体必生效
    {
      name: 'font-display-optional',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.css') && /fontsource|lxgw-wenkai/.test(id)) {
          return code.replace(/font-display:\s*optional/g, 'font-display: swap');
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
        // 不再手写 echarts 分包：
        // 此前 manualChunks 把 echarts/zrender 强制聚合为 echarts-vendor，
        // 但 rolldown 会把该 vendor 与其共享依赖打包成被全站引用的公共 chunk，
        // 导致首页 index.html 生成 <link rel="modulepreload"> 强制预加载 610KB 的 echarts-vendor。
        // 移除后 echarts 仅随 Dashboard / HealthMonitor 懒加载 chunk 加载（自动提取共享 chunk），
        // 首页不再加载任何 echarts 代码。
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
