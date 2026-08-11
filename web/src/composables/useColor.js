/**
 * 颜色解析工具
 * 兼容两种存储格式：预设名称（如 "peach"）和 HEX 值（如 "#FF5500"）
 */

/** 将颜色值解析为可用的 CSS 颜色字符串 */
export function resolveColor(c, fallback = 'peach') {
  if (!c) return `var(--${fallback})`;
  // HEX 值直接返回
  if (c.startsWith('#')) return c;
  // 预设名称转为 CSS 变量引用
  return `var(--${c})`;
}

/** 判断是否为合法 HEX 颜色 */
export function isValidHex(c) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(c);
}

/**
 * 将颜色值转为当前模式下实际渲染的 HEX 值用于显示
 * 预设名称（如 "peach"）读取运行时 CSS 变量（亮/暗自适应），HEX 原样返回
 */
export function displayHex(c) {
  if (!c) return '';
  if (c.startsWith('#')) return c;
  const v = getComputedStyle(document.body).getPropertyValue(`--${c}`).trim();
  return v || c;
}

/** 预置颜色名列表（与 tokens.css 对齐），分类/书签头像颜色选择器共用 */
export const BG_COLORS = [
  'peach', 'mint', 'lav', 'sky', 'rose', 'butter',
  'coral', 'aqua', 'sage', 'lilac', 'sand', 'foam',
  'cherry', 'lemon', 'teal', 'mauve', 'fog', 'apricot',
  'seafoam', 'blush', 'mist', 'citrus', 'perwinkle', 'tangerine',
  'sage2', 'berry', 'dove', 'amber', 'turquoise', 'violet',
  'vermilion', 'emerald', 'saffron', 'mauve2', 'olive', 'magenta', 'jade'
];

/** 从数组中随机取一项（Emoji / 颜色等随机选择用） */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
