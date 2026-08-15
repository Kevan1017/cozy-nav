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

/** 字体 key → @font-face 家族名（unicode-range 分片的 family 值，用于 face.load 强制下载匹配） */
const FONT_FAMILY_NAMES = {
  system: 'Noto Sans SC',
  kai: 'LXGW WenKai Mono',
  serif: 'Noto Serif SC',
};

/** 预下载是否已触发（无论成败只触发一次） */
let prefetchStarted = false;

/**
 * 按需加载 web font（动态 import，仅触发一次），返回加载完成的 Promise
 * 字体 CSS 已被 vite 插件改写为 font-display: swap：
 *   - 字体就绪（缓存命中）→ 本次渲染即用 web font，无抖动
 *   - 字体未就绪（移动端冷启动）→ 先用回退字体渲染，字体下载完成后替换；
 *     避免 optional 的 100ms 限制导致慢网络下字体永远不生效（Android 无楷体/宋体回退 → 切换无感）
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
 * 首次交互后预下载其余字体（"交互后加载"策略）
 * 新用户首屏只加载当前默认字体（system），避免与首屏资源抢带宽；
 * 用户第一次点击/滚动/键盘输入时，后台开始下载尚未加载的字体，
 * 等真正切换字体时基本已就绪、无需等待。事件触发后自动移除监听，只执行一次。
 *
 * 说明：unicode-range 分包下仅 import CSS 不会下载字体文件（浏览器只在文本
 * 实际使用该字体时下载对应分片），故需在 CSS 注册完成后遍历 document.fonts，
 * 对每个 face 调用 load() 强制下载字体分片，预下载才真正生效。
 */
export function prefetchFontsOnInteraction() {
  if (prefetchStarted) return;
  const pending = Object.keys(WEB_FONT_IMPORTS).filter((k) => !loadedFonts.has(k));
  if (pending.length === 0) return;

  const trigger = () => {
    prefetchStarted = true;
    window.removeEventListener('pointerdown', trigger);
    window.removeEventListener('keydown', trigger);
    window.removeEventListener('scroll', trigger, { passive: true });
    // 并行加载字体 CSS，注册 @font-face 后再强制下载分片
    Promise.all(pending.map(loadWebFont)).then(() => {
      // wanted 是家族名集合（face.family 是 'LXGW WenKai Mono' 等家族名，不是字体 key）
      const wanted = new Set(pending.map((k) => FONT_FAMILY_NAMES[k]).filter(Boolean));
      for (const face of document.fonts) {
        // face.family 可能带引号，去掉后与字体 key 匹配
        if (wanted.has(face.family.replace(/['"]/g, ''))) {
          try { face.load(); } catch { /* 单个分片失败不阻塞其余 */ }
        }
      }
    });
  };

  window.addEventListener('pointerdown', trigger);
  window.addEventListener('keydown', trigger);
  window.addEventListener('scroll', trigger, { passive: true });
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
