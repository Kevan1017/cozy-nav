/**
 * 字体管理组合式函数
 * - 提供三种字体的字体栈与按需加载（本地化 web font，由 vite 打包，不依赖外部 CDN）
 * - 供 main.js（挂载前预加载，避免 FOUT 字体抖动）与 App.vue（切换字体）共用
 *
 * 字体选型原则：字形规整、字宽与系统黑体接近，减少切换时的布局位移
 *   system: Noto Sans SC 思源黑体 — unicode-range 分包按需加载
 *   kai:   LXGW WenKai Mono 霞鹜文楷（等宽）
 *   serif: Noto Serif SC 思源宋体
 */
const FONT_STACKS = {
  // 黑体（思源黑体优先，回退系统无衬线）— 拉丁字符也走思源字形，保证中英文粗细一致
  system: `'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans CN', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  // 楷体（web font: 霞鹜文楷等宽 → PC 系统楷体 fallback → 衬线兜底）
  kai: `'LXGW WenKai Mono', 'LXGW WenKai', 'Kaiti SC', 'KaiTi', 'STKaiti', 'Kaiti TC', sans-serif`,
  // 宋体（web font: Noto Serif SC → PC 系统宋体 fallback → 衬线兜底）
  serif: `'Noto Serif SC', Georgia, 'Source Han Serif CN', 'Songti SC', 'STSong', 'SimSun', 'NSimSun', serif`,
};

/** 字体 CSS 动态加载器（字体已通过 npm 包本地化，vite 打包进构建产物） */
const WEB_FONT_IMPORTS = {
  // Noto Sans SC 常规/半粗/粗体（fontsource 包，unicode-range 分包）
  system: () => Promise.all([
    import('@fontsource/noto-sans-sc/400.css'),
    import('@fontsource/noto-sans-sc/600.css'),
    import('@fontsource/noto-sans-sc/700.css'),
  ]),
  // LXGW WenKai Mono 常规字重（官方 webfont 包，unicode-range 分包）
  kai: () => import('lxgw-wenkai-webfont/lxgwwenkaimono-regular.css'),
  // Noto Serif SC 常规 + 粗体（fontsource 包）
  serif: () => Promise.all([
    import('@fontsource/noto-serif-sc/400.css'),
    import('@fontsource/noto-serif-sc/700.css'),
  ]),
};

/** 已加载的字体集合（避免重复加载） */
const loadedFonts = new Set();

/**
 * 按需加载 web font（动态 import，仅触发一次），返回加载完成的 Promise
 * 字体 CSS 已被 vite 插件改写为 font-display: optional：
 *   - 字体在 100ms 内就绪（缓存命中）→ 本次渲染即用 web font，无抖动
 *   - 字体未就绪（冷启动）→ 本次用回退字体且不再替换，同样无 FOUT
 * 故无需手动预热字体数据（会强制下载全部分包，浪费带宽）
 * @param {string} fontFamily - system / kai / serif
 * @returns {Promise<void>|undefined} CSS 加载完成的 Promise（已加载过则返回 undefined）
 */
export function loadWebFont(fontFamily) {
  const loader = WEB_FONT_IMPORTS[fontFamily];
  if (!loader || loadedFonts.has(fontFamily)) return undefined;
  loadedFonts.add(fontFamily);
  return loader().catch(() => {
    loadedFonts.delete(fontFamily); // 失败允许重试，字体回退系统默认
  });
}

/**
 * 应用字体族到 html 元素（设置 --app-font CSS 变量并加载对应 web font）
 * @param {string} fontFamily - system / kai / serif
 * @returns {Promise<void>|undefined} 字体 CSS 加载完成的 Promise（未加载过时返回）
 */
export function applyFontFamily(fontFamily) {
  const stack = FONT_STACKS[fontFamily] || FONT_STACKS.system;
  document.documentElement.style.setProperty('--app-font', stack);
  return loadWebFont(fontFamily);
}

export { FONT_STACKS };
