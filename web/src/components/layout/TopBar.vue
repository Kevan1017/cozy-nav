<script setup>
/**
 * 顶部栏：品牌标识 + 副标题 + 日期胶囊 + 工具栏
 * 设置入口：已登录直接进后台，未登录弹出登录模态框
 */
import { ref, watch, inject, computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { NDropdown } from 'naive-ui';
import { useClock } from '../../composables/useClock.js';
import { useAuthStore } from '../../stores/auth.js';
import { usePrefsStore } from '../../stores/prefs.js';

const { greeting, dateText, timeText, lunarText } = useClock();
const router = useRouter();
const authStore = useAuthStore();
const prefsStore = usePrefsStore();

/** 主题模式（从 App.vue 注入） */
const themeMode = inject('themeMode', computed(() => 'auto'));
const setThemeMode = inject('setThemeMode', () => {});

/** 循环切换主题模式：light → dark → auto → light */
const modeCycle = ['light', 'dark', 'auto'];
function cycleTheme() {
  const idx = modeCycle.indexOf(themeMode.value);
  const next = modeCycle[(idx + 1) % modeCycle.length];
  setThemeMode(next);
}

/** 当前模式对应的图标和提示 */
const themeIcon = computed(() => {
  if (themeMode.value === 'dark') return '🌙';
  if (themeMode.value === 'auto') return '⏰';
  return '☀️';
});
const themeTitle = computed(() => {
  if (themeMode.value === 'dark') return '暗色模式';
  if (themeMode.value === 'auto') return '跟随时间（19:00-07:00）';
  return '亮色模式';
});

/** 站点 Logo 图片是否可显示（上传且加载成功时显示图片，否则显示标题首字） */
const brandImgOk = ref(!!prefsStore.siteLogo);
watch(() => prefsStore.siteLogo, (val) => {
  brandImgOk.value = !!val;
});

/** 视图模式循环切换：card → list → compact → dial → card */
const viewModeCycle = ['card', 'list', 'compact', 'dial'];
const viewModeLabels = { card: '标准视图', list: '列表视图', compact: '紧凑视图', dial: '图标平铺' };
const viewModeTitle = computed(() => viewModeLabels[prefsStore.viewMode] || '卡片视图');
function cycleViewMode() {
  const idx = viewModeCycle.indexOf(prefsStore.viewMode);
  const next = viewModeCycle[(idx + 1) % viewModeCycle.length];
  prefsStore.updateViewMode(next).catch(() => {});
}

/** 字体循环切换：system → kai → serif → system */
const fontCycle = ['system', 'kai', 'serif'];
const fontLabels = { system: '黑体（思源黑体）', kai: '楷体', serif: '宋体（衬线）' };
const fontTitle = computed(() => fontLabels[prefsStore.fontFamily] || '黑体（思源黑体）');
function cycleFont() {
  const idx = fontCycle.indexOf(prefsStore.fontFamily);
  const next = fontCycle[(idx + 1) % fontCycle.length];
  prefsStore.updateFontFamily(next).catch(() => {});
}

/** 排序模式下拉：分类与书签各自独立，支持自定义 / 添加时间 / 名称，选中项前加 ✓ */
const sortModeList = [
  { value: 'sort_order:asc', label: '自定义顺序' },
  { value: 'created_at:desc', label: '添加时间（新 → 旧）' },
  { value: 'created_at:asc', label: '添加时间（旧 → 新）' },
  { value: 'name:asc', label: '名称（A → Z）' },
  { value: 'name:desc', label: '名称（Z → A）' },
];
const sortOptions = computed(() => [
  {
    label: '分类排序',
    key: 'cat-group',
    type: 'group',
    children: sortModeList.map((m) => ({
      label: m.value === prefsStore.categorySortMode ? `✓ ${m.label}` : m.label,
      key: `cat:${m.value}`,
    })),
  },
  {
    label: '书签排序',
    key: 'link-group',
    type: 'group',
    children: sortModeList.map((m) => ({
      label: m.value === prefsStore.linkSortMode ? `✓ ${m.label}` : m.label,
      key: `link:${m.value}`,
    })),
  },
]);
/** 排序下拉选择：key 格式为 `作用域:模式`，如 cat:created_at:desc */
function handleSortSelect(key) {
  const sep = key.indexOf(':');
  const scope = key.slice(0, sep);
  const mode = key.slice(sep + 1);
  if (scope === 'cat') {
    prefsStore.updateCategorySortMode(mode).catch(() => {});
  } else if (scope === 'link') {
    prefsStore.updateLinkSortMode(mode).catch(() => {});
  }
}

/** 点击设置齿轮：已登录直接进后台，未登录弹全局登录框 */
function handleSettings() {
  if (authStore.isLoggedIn) {
    router.push('/admin');
  } else {
    authStore.openLoginModal();
  }
}
</script>

<template>
  <div class="top">
    <!-- 左侧：品牌标识 -->
    <RouterLink to="/" class="brand">
      <div class="brand-icon" :class="{ 'brand-img-on': brandImgOk }">
        <img
          v-if="brandImgOk"
          :src="prefsStore.siteLogo"
          alt="logo"
          class="brand-img"
          @error="brandImgOk = false"
        >
        <span v-else>{{ (prefsStore.siteTitle || '悦').slice(0, 1) }}</span>
      </div>
      <div class="brand-text">
        <h1>{{ prefsStore.siteTitle || '悦行' }}</h1>
        <p>温暖小角落</p>
      </div>
    </RouterLink>

    <!-- 右侧：工具栏 -->
    <div class="top-bar">
      <div class="date-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round" />
        </svg>
        <span class="date-full">{{ dateText }} · {{ lunarText }} · {{ timeText }}</span>
        <span class="date-mobile">{{ timeText }}</span>
      </div>

      <button class="icon-btn" title="后台管理" @click="handleSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <button class="icon-btn theme-toggle" :title="themeTitle" @click="cycleTheme">
        <span class="theme-emoji">{{ themeIcon }}</span>
      </button>

      <!-- 视图模式切换（视图布局开关关闭时隐藏） -->
      <button v-if="prefsStore.viewLayoutEnabled" class="icon-btn view-toggle" :title="viewModeTitle" @click="cycleViewMode">
        <!-- 标准视图：链接 2 列 -->
        <svg v-if="prefsStore.viewMode === 'card'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <svg v-else-if="prefsStore.viewMode === 'list'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" stroke-linecap="round" />
          <line x1="3" y1="12" x2="21" y2="12" stroke-linecap="round" />
          <line x1="3" y1="18" x2="21" y2="18" stroke-linecap="round" />
        </svg>
        <!-- 紧凑视图：链接 3 列 -->
        <svg v-else-if="prefsStore.viewMode === 'compact'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="5" height="5" rx="1" />
          <rect x="10" y="3" width="5" height="5" rx="1" />
          <rect x="17" y="3" width="4" height="5" rx="1" />
          <rect x="3" y="10" width="5" height="5" rx="1" />
          <rect x="10" y="10" width="5" height="5" rx="1" />
          <rect x="17" y="10" width="4" height="5" rx="1" />
          <rect x="3" y="17" width="5" height="4" rx="1" />
          <rect x="10" y="17" width="5" height="4" rx="1" />
          <rect x="17" y="17" width="4" height="4" rx="1" />
        </svg>
        <!-- 图标平铺视图：大图标墙 -->
        <svg v-else-if="prefsStore.viewMode === 'dial'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
          <line x1="3" y1="21" x2="21" y2="21" stroke-linecap="round" />
        </svg>
      </button>

      <!-- 分类/书签排序模式切换（前台排序开关关闭时隐藏） -->
      <n-dropdown
        v-if="prefsStore.sortEnabled"
        :options="sortOptions"
        trigger="click"
        placement="bottom-end"
        @select="handleSortSelect"
      >
        <button class="icon-btn sort-toggle" title="分类/书签排序">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 3v18M3 7l4-4 4 4M17 21V3M21 17l-4 4-4-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </n-dropdown>

      <!-- 字体切换（受后台开关控制） -->
      <button v-if="prefsStore.fontSwitchEnabled" class="icon-btn font-toggle" :title="fontTitle" @click="cycleFont">
        <span class="font-label">Aa</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ========== 顶部栏容器 ========== */
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 0 14px;
  opacity: 0;
  animation: bob .7s ease .05s forwards;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

/* ========== 品牌标识 ========== */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.brand-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--topbar-logo, var(--pop)), var(--topbar-logo2, var(--pop2)));
  display: grid;
  place-items: center;
  transform: rotate(45deg);
  box-shadow: 0 6px 18px var(--shadow);
  flex-shrink: 0;
}

.brand-icon span {
  transform: rotate(-45deg);
  color: var(--topbar-logo-ink, var(--on-pop));
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 700;
  font-size: 15px;
}

/* 上传图片 Logo 时：容器不旋转，图片直接铺满圆角方块 */
.brand-icon.brand-img-on {
  transform: none;
}
.brand-icon.brand-img-on .brand-img {
  width: 100%;
  height: 100%;
  border-radius: 11px;
  object-fit: contain;
  background: var(--bg);
}

.brand-text h1 {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: 17px;
  letter-spacing: -.01em;
  line-height: 1.1;
  color: var(--topbar-name, var(--ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-text p {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: 11px;
  color: var(--topbar-sub, var(--soft));
  margin-top: 1px;
  letter-spacing: .02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========== 右侧工具栏 ========== */
.top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 日期胶囊 */
.date-pill {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: 12px;
  font-weight: 600;
  color: var(--topbar-icon, var(--ink2));
  background: var(--card);
  border: 1px solid var(--topbar-pill-border, var(--rule, rgba(0, 0, 0, .08)));
  padding: 7px 14px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  /* 稳定容器 */
  contain: layout style;
}

.date-pill svg {
  width: 15px;
  height: 15px;
  color: var(--pop);
  flex-shrink: 0;
}

/* 默认显示完整日期，隐藏移动端简化 */
.date-mobile {
  display: none;
}

/* 通用图标按钮 */
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--topbar-pill-border, var(--rule, rgba(0, 0, 0, .08)));
  background: var(--card);
  color: var(--topbar-icon, var(--ink2));
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: .25s ease;
  flex-shrink: 0;
  padding: 0;
}

.icon-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  color: var(--pop);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

/* 主题切换按钮（emoji 动画） */
.theme-toggle {
  font-size: 18px;
  transition: transform .3s ease;
}

.theme-toggle:hover {
  transform: translateY(-2px) scale(1.08);
}

.theme-emoji {
  display: inline-block;
  animation: theme-cycle .4s cubic-bezier(.4, 0, .2, 1);
}

/* 视图切换 + 字体切换 + 排序切换按钮 */
.view-toggle svg,
.sort-toggle svg,
.font-toggle .font-label {
  transition: transform .25s ease;
}

.view-toggle:hover svg,
.sort-toggle:hover svg,
.font-toggle:hover .font-label {
  transform: scale(1.12);
}

.font-label {
  /* 使用 var(--app-font) 跟随全局字体切换，字体标签本身用 serif 风格 */
  font-family: var(--app-font, serif);
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
}

@keyframes theme-cycle {
  0% { transform: rotate(-90deg) scale(0.5); opacity: 0; }
  100% { transform: rotate(0deg) scale(1); opacity: 1; }
}

/* ========== 响应式 ========== */
@media (max-width: 680px) {
  .top {
    flex-wrap: wrap;
    gap: 12px;
  }

  .brand-text p {
    display: none;
  }

  /* 移动端日期切换：显示简化时间，隐藏完整日期 */
  .date-full {
    display: none;
  }

  .date-mobile {
    display: inline;
  }

  .date-pill {
    padding: 7px 12px;
  }
}

@media (max-width: 480px) {
  .date-pill {
    padding: 6px 10px;
    font-size: 11px;
  }

  .icon-btn {
    width: 34px;
    height: 34px;
  }
}
</style>
