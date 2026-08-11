import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { usePrefsStore } from './stores/prefs.js';
import { useDataStore } from './stores/data.js';
import { applyFontFamily } from './composables/useFont.js';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

// 并行发起偏好与分类数据请求：
// - 偏好必须等待（首帧配色/字体依赖它，避免"默认配色 → 异步切换"闪烁）
// - 分类数据后台预取，不阻塞挂载；首页组件挂载时经 in-flight 去重复用同一请求
const prefsStore = usePrefsStore(pinia);
const dataStore = useDataStore(pinia);

// 尽早注册字体 @font-face 并触发字体下载（localStorage 中已有字体偏好，与后端一致），
// 使 web font 在首帧渲染前就绪，避免 FOUT 字体抖动；若后端偏好不同，App.vue 的 watch 会再应用
const fontReady = applyFontFamily(prefsStore.fontFamily);

const prefsReady = prefsStore.fetchPrefs().catch(() => {});
dataStore.fetchCategories(false).catch(() => {});

// 等待偏好与字体 CSS 就绪后再挂载：确保首帧渲染即使用正确的字体，避免先系统字体后 web font 的跳动
await Promise.all([prefsReady, fontReady || Promise.resolve()]);

app.mount('#app');
