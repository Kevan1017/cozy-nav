<script setup>
/**
 * 悦行 应用根组件
 * 挂载 NConfigProvider（Naive UI 主题 + 自定义断点 + 亮暗切换 + 配色预设）
 * 主题模式：light / dark / auto
 * 配色预设：参考 themePresets.js，各模式 3 套
 */
import { onMounted, onUnmounted, ref, watch, computed, provide, shallowRef } from 'vue';
import { 
  NConfigProvider, 
  NMessageProvider, 
  NDialogProvider,
  darkTheme, 
  zhCN, 
  dateZhCN 
} from 'naive-ui';
import { useClock } from './composables/useClock.js';
import { usePrefsStore } from './stores/prefs.js';
import { lightThemeOverrides, darkThemeOverrides } from './theme/naiveTheme.js';
import { applyPresetCssVars, getPresetNaiveOverrides, mergeAdminCustomOverrides } from './composables/useThemePreset.js';
import { DEFAULT_PRESET_KEYS, getPresetByKey } from './theme/themePresets.js';
import { applyFontFamily } from './composables/useFont.js';
import VaultUnlockModal from './components/bookmark/VaultUnlockModal.vue';

const prefsStore = usePrefsStore();
const { hour } = useClock();

/** 预加载脚本已在 index.html 中根据 localStorage 设置了 html.dark 类 */
const preloadedIsDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
const dmChecked = ref(preloadedIsDark);

/** 当前主题模式（light / dark / auto） */
const themeMode = computed({
  get: () => prefsStore.theme,
  set: (val) => prefsStore.updateTheme(val).catch(() => {})
});

/** auto 模式下当前时间是否为暗色 */
const autoIsDark = computed(() => {
  const h = hour.value;
  return h >= 19 || h < 7;
});

/** 实际是否为暗色（解析三模式） */
const effectiveIsDark = computed(() => {
  if (themeMode.value === 'dark') return true;
  if (themeMode.value === 'light') return false;
  return autoIsDark.value;
});

/** 当前配色预设 key */
const currentPresetKey = computed(() => prefsStore.themePreset);

/** 根据当前模式解析应使用的预设 key */
const resolvedPresetKey = computed(() => {
  const key = currentPresetKey.value;
  const preset = getPresetByKey(key, effectiveIsDark.value ? 'dark' : 'light');
  return preset.key;
});

/** Naive UI theme overrides（可变 ref，用于应用预设覆盖） */
const naiveOverridesRef = shallowRef(effectiveIsDark.value ? darkThemeOverrides : lightThemeOverrides);

/** 每次模式或预设变化时，应用 CSS 变量 + 更新 Naive UI overrides */
function applyThemePreset() {
  const mode = effectiveIsDark.value ? 'dark' : 'light';
  const key = resolvedPresetKey.value;
  // 预设变量 + 自定义配色覆盖层
  applyPresetCssVars(key, mode, prefsStore.customTheme);
  const base = getPresetNaiveOverrides(key, mode) || (mode === 'dark' ? darkThemeOverrides : lightThemeOverrides);
  // 自定义的 --admin-* 变量同步合并进 naive overrides（后台组件由 naive 渲染）
  naiveOverridesRef.value = mergeAdminCustomOverrides(prefsStore.customTheme, mode, base);
}

/** 站点基本配置 → HTML 头部：title + meta keywords/description（不存在时创建） */
function upsertMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

function applySiteMeta() {
  document.title = prefsStore.siteTitle || '悦行';
  upsertMeta('description', prefsStore.siteDescription);
  upsertMeta('keywords', prefsStore.siteKeywords);
  // favicon 联动：上传了图片 Logo 时浏览器标签页图标跟随使用，否则用默认 favicon.svg
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = prefsStore.siteLogo || '/favicon.svg';
}

/** 给 naive-ui 的 theme */
const naiveTheme = computed(() => effectiveIsDark.value ? darkTheme : null);

/** 暴露给子组件 */
provide('isDark', effectiveIsDark);
provide('themeMode', themeMode);

/** 切换主题模式（供 TopBar/设置页调用） */
provide('setThemeMode', (mode) => {
  themeMode.value = mode;
});

/** 切换配色预设 */
provide('setThemePreset', (presetKey) => {
  prefsStore.updateThemePreset(presetKey).catch(() => {});
});

/** 自动模式下，时间变化时同步 dmChecked */
watch(autoIsDark, (val) => {
  if (themeMode.value === 'auto') dmChecked.value = val;
});

/** 监听模式变化，同步 dmChecked 和 html.dark 类 */
watch(effectiveIsDark, (val) => {
  dmChecked.value = val;
  if (val) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  applyThemePreset();
});

/** 监听预设 key 变化 */
watch(resolvedPresetKey, () => {
  applyThemePreset();
});

/** 监听自定义配色变化（设置面板改色/还原时即时应用） */
watch(() => prefsStore.customTheme, () => {
  applyThemePreset();
}, { deep: true });

/** 监听字体族变化 */
watch(() => prefsStore.fontFamily, (val) => {
  applyFontFamily(val);
});

/** 站点标题/描述/关键词/Logo 变化时同步 HTML 头部（浏览器标签页标题、meta 与 favicon） */
watch(
  () => [prefsStore.siteTitle, prefsStore.siteDescription, prefsStore.siteKeywords, prefsStore.siteLogo],
  () => applySiteMeta()
);

/**
 * 跨标签页同步：后台设置页改色/改站点配置时写入 localStorage，
 * 前台其他标签页收到 storage 事件后更新 store，由下方 watch 自动重新应用
 */
function onCrossTabPrefs(e) {
  // 自定义配色（沿用原逻辑）
  if (e.key === 'customTheme') {
    try {
      const parsed = e.newValue ? JSON.parse(e.newValue) : { light: {}, dark: {} };
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        prefsStore.customTheme = { light: parsed.light || {}, dark: parsed.dark || {} };
      }
    } catch { /* 解析失败忽略，保持当前配色 */ }
    return;
  }
  // 站点配置跨标签页同步：后台保存后，已打开的前台标签页实时更新标题/关键词/描述/Logo
  if (e.key === 'siteTitle') prefsStore.siteTitle = e.newValue || '悦行';
  else if (e.key === 'siteKeywords') prefsStore.siteKeywords = e.newValue || '';
  else if (e.key === 'siteDescription') prefsStore.siteDescription = e.newValue || '';
  else if (e.key === 'siteLogo') prefsStore.siteLogo = e.newValue || '';
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  const validModes = ['light', 'dark', 'auto'];
  if (!validModes.includes(savedTheme)) {
    localStorage.setItem('theme', 'auto');
  }

  // 偏好已在 main.js 挂载前加载完成，直接用配置应用主题/配色/字体/站点信息
  applyThemePreset();
  applyFontFamily(prefsStore.fontFamily);
  applySiteMeta();
  dmChecked.value = effectiveIsDark.value;
  // 跨标签页同步自定义配色 + 站点配置：后台修改后前台实时生效
  window.addEventListener('storage', onCrossTabPrefs);
});

onUnmounted(() => {
  window.removeEventListener('storage', onCrossTabPrefs);
});
</script>

<template>
  <!-- 兼容旧代码：保留 #dm checkbox 以便 body:has(#dm:checked) 旧样式仍可工作 -->
  <input
    type="checkbox"
    id="dm"
    v-model="dmChecked"
    hidden
  />
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="naiveTheme"
    :theme-overrides="naiveOverridesRef"
  >
    <n-message-provider>
      <n-dialog-provider>
        <RouterView />
        <!-- 全局保险库解锁弹窗：由 vault store 的 showPasswordModal 控制 -->
        <VaultUnlockModal />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
@import './styles/tokens.css';
@import './styles/responsive.css';
@import './styles/admin-common.css';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--app-font, 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans CN', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
  -webkit-font-smoothing: antialiased;
  /* 统一 x-height，防止字体切换时行高突变 */
  font-size-adjust: ex-height 0.5;
  /* 禁止浏览器合成斜体/粗体，避免字体渲染偏差 */
  font-synthesis: none;
  /* 字体切换时平滑过渡，避免位置突变 */
  transition: background .4s, color .4s, font-family .3s ease;
}

html {
  /* 隐藏页面滚动条（保留滚动功能）：视觉更干净，也彻底避免滚动条出现/消失导致视口宽度变化 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar {
  display: none;
}

body {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* 径向渐变背景球 — 跟随配色预设变化 */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 6% 10%, var(--blob-1), transparent 20%),
    radial-gradient(circle at 94% 6%, var(--blob-2), transparent 20%),
    radial-gradient(circle at 88% 92%, var(--blob-3), transparent 22%),
    radial-gradient(circle at 10% 88%, var(--blob-4), transparent 22%);
  transition: background .4s ease;
}

/* 噪点纹理（fixed 常驻层，独立合成层避免滚动时 backdrop 反复重采样） */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: .30;
  transform: translateZ(0);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.25  0 0 0 0 0.20  0 0 0 0 0.15  0 0 0 0.03 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

body:has(#dm:checked)::after {
  opacity: .35;
}

@keyframes bob {
  from { opacity: 0; transform: translateY(14px); }
  /* to 结束在 translateZ(0)（视觉等价 none）：forwards 保持独立合成层，
     避免动画结束后 transform 回落触发 transition 抖动，同时稳定 backdrop 采样防白屏 */
  to { opacity: 1; transform: translateZ(0); }
}

/* Naive UI 全局微调：浮层（弹窗/抽屉/气泡）毛玻璃——fixed 不随页面滚动，白屏风险低 */
.n-modal, .n-drawer, .n-popover {
  backdrop-filter: blur(16px);
}
/* 数据表格禁止毛玻璃：表格在滚动容器内，滚动时 backdrop 重采样最频繁，
   是"滚动白屏"的主因（Chromium backdrop-filter 层失效回退为纯白块） */
.n-data-table {
  backdrop-filter: none;
}
/* 后台卡片保留毛玻璃观感，但强制独立合成层稳定 backdrop 采样，缓解滚动白屏 */
.n-card {
  backdrop-filter: blur(16px);
  transform: translateZ(0);
}

/* 全局稳定文本容器：防止字体切换时布局位移 */
.stable-text {
  /* 告知浏览器此区域内部布局变化不影响外部 */
  contain: layout style;
  /* 固定行高基准，减少字体切换时的行高波动 */
  line-height: 1.4;
}

/* 所有单行文本元素：禁止换行 + 溢出省略 */
.nw {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 全局文本稳定：字体切换时不改变文本位置、不换行 */
.nm, .dm, .r-name, .r-domain, .sk-name, .sk-domain,
.c-title h2, .greet, .handwrite, .brand-text h1, .brand-text p,
.pin-head .lab, .pin-head .sub, .vault-title, .login-title {
  /* 确保所有文本元素单行显示，不换行 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  /* 字体切换时平滑过渡 */
  transition: font-family .3s ease;
}

/* 全局防止字体切换时 flex/grid 子元素溢出 */
.flex-children-stable > *,
.grid > * {
  min-width: 0;
  max-width: 100%;
}
</style>
