import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { usePrefsStore, hasPrefsCache } from './stores/prefs.js';
import { useDataStore } from './stores/data.js';
import { applyFontFamily, prefetchFontsOnInteraction } from './composables/useFont.js';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

// 偏好与分类数据请求：
// - 无本地偏好缓存（新用户首访）：必须等偏好就绪再挂载，确保首帧配色/字体即后端配置（避免闪烁）
// - 有本地偏好缓存（回访用户）：直接挂载（store 已从 localStorage 恢复完整配置，首帧即正确、无闪烁），
//   fetchPrefs 后台静默刷新，经 App.vue 的 watch 自动应用后端最新配置
// - 分类数据始终后台预取，不阻塞挂载；首页组件挂载时经 in-flight 去重复用同一请求
const prefsStore = usePrefsStore(pinia);
const dataStore = useDataStore(pinia);

// 尽早注册字体 @font-face 并触发字体下载（localStorage 中已有字体偏好，与后端一致），
// 使 web font 在首帧渲染前就绪，避免 FOUT 字体抖动；若后端偏好不同，App.vue 的 watch 会再应用
const fontReady = applyFontFamily(prefsStore.fontFamily);

const prefsReady = prefsStore.fetchPrefs().catch(() => {});
dataStore.fetchCategories(false).catch(() => {});

// 等待字体 CSS 就绪后再挂载：确保首帧渲染即使用正确的字体，避免先系统字体后 web font 的跳动
if (hasPrefsCache()) {
  // 回访用户：本地已有完整偏好，跳过偏好请求等待，仅等字体 CSS
  await (fontReady || Promise.resolve());
} else {
  // 新用户首访：等偏好与字体 CSS 都就绪，避免"默认配色 → 后端配置"闪烁
  await Promise.all([prefsReady, fontReady || Promise.resolve()]);
}

app.mount('#app');

// 挂载后注册"首次交互预下载"：首屏只加载默认字体（system），
// 用户第一次点击/滚动时再后台下载楷体/宋体，切换字体时无需等待
prefetchFontsOnInteraction();
