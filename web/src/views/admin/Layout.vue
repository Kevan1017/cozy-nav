<script setup>
/**
 * 后台管理布局（Naive UI 版本）
 * PC 端：n-layout-sider 固定侧边栏 + n-menu 导航
 * 移动端：n-drawer 抽屉式菜单 + 顶部栏（n-page-header）
 */
import { ref, computed, h, onMounted, onBeforeUnmount } from 'vue';
import { RouterView, useRouter, useRoute } from 'vue-router';
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NDrawer,
  NDrawerContent,
  NIcon,
  useDialog,
} from 'naive-ui';
import { useAuthStore } from '../../stores/auth.js';
import { useResponsive } from '../../composables/useResponsive.js';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const dialog = useDialog();
const { isMobileView } = useResponsive();

const drawerOpen = ref(false);

/** 前往首页（新标签打开前台首页） */
function goHome() {
  window.open('/', '_blank');
}

/* ---------- 菜单项（复用：PC 侧边栏 + 移动端抽屉） ---------- */
const menuOptions = computed(() => [
  {
    label: '页面概览',
    key: '/admin',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '📊')),
  },
  {
    label: '分类管理',
    key: '/admin/categories',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🗂️')),
  },
  {
    label: '书签管理',
    key: '/admin/links',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🔖')),
  },
  {
    label: '搜索引擎',
    key: '/admin/engines',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🔎')),
  },
  {
    label: '数据管理',
    key: '/admin/data',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '📦')),
  },
  {
    label: '链接巡检',
    key: '/admin/health',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🩺')),
  },
  {
    label: '通知中心',
    key: '/admin/notify',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🔔')),
  },
  {
    label: '网站设置',
    key: '/admin/settings',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '⚙️')),
  },
  {
    label: '退出登录',
    key: '__logout__',
    icon: renderIcon(() => h('span', { style: 'font-size:16px' }, '🚪')),
  },
]);

function renderIcon(render) {
  return () => h(NIcon, null, { default: render });
}

/* ---------- 当前激活的菜单 key（与 route.path 对齐） ---------- */
const activeKey = computed(() => {
  // 先精确匹配，确保子路由不会错误命中父级菜单
  for (const opt of menuOptions.value) {
    if (route.path === opt.key) return opt.key;
  }
  // 再前缀匹配，用于子路径（如 /admin/links/create）
  for (const opt of menuOptions.value) {
    if (route.path.startsWith(opt.key + '/')) return opt.key;
  }
  return '/admin';
});

function openDrawer() {
  document.body.focus({ preventScroll: true });
  setTimeout(() => {
    drawerOpen.value = true;
  }, 80);
}

/** n-menu 菜单点击统一入口（PC 侧边栏 + 移动端抽屉共用） */
function handleMenuKey(key) {
  if (key === '__logout__') {
    confirmLogout();
    return;
  }
  drawerOpen.value = false;
  router.push(key);
}

onMounted(() => {
  // 接管页面背景：后台挂载期间 body 使用后台背景色，避免前台 var(--bg) 在滚动空白区露出
  document.body.style.background = 'var(--admin-surface)';
});

onBeforeUnmount(() => {
  // 离开后台时恢复前台背景色
  document.body.style.background = 'var(--bg)';
});

function confirmLogout() {
  dialog.warning({
    title: '退出登录',
    content: '确定要退出管理后台吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: () => {
      authStore.logout();
      router.push('/');
    },
  });
}
</script>

<template>
  <n-layout has-sider style="min-height: 100vh; background: var(--admin-surface);">

    <!-- ========== PC 端侧边栏 ========== -->
    <n-layout-sider
      v-if="!isMobileView"
      :width="232"
      :bordered="false"
      :native-scrollbar="false"
    >
      <div class="sider-inner">
        <div class="brand">
          <span class="brand-icon">🧭</span>
          <span class="brand-text">悦行</span>
        </div>
        <a
          class="go-home-btn"
          href="/"
          target="_blank"
          rel="noopener"
          @click.prevent="goHome"
        >
          <span class="go-home-icon">🏠</span>
          <span>前往首页</span>
          <span class="go-home-arrow">↗</span>
        </a>
        <n-menu
          :options="menuOptions"
          :value="activeKey"
          :indent="20"
          @update:value="handleMenuKey"
        />
      </div>
    </n-layout-sider>

    <!-- ========== 主区域 ========== -->
    <n-layout>

      <!-- 移动端顶栏（PC 端隐藏，侧边栏已经有退出了） -->
      <n-layout-header
        v-if="isMobileView"
        bordered
        class="mobile-header"
      >
        <div class="mobile-header-inner">
          <n-button
            quaternary
            circle
            @click="openDrawer"
            aria-label="打开菜单"
          >
            <template #icon>☰</template>
          </n-button>
          <span class="mobile-title">悦行 管理</span>
          <n-button
            quaternary
            size="small"
            @click="confirmLogout"
          >
            <template #icon>🚪</template>
            退出
          </n-button>
        </div>
      </n-layout-header>

      <!-- 内容区 -->
      <n-layout-content class="layout-content">
        <div class="content-body">
          <RouterView />
        </div>
      </n-layout-content>
    </n-layout>

    <!-- ========== 移动端抽屉菜单 ========== -->
    <n-drawer
      v-model:show="drawerOpen"
      :width="260"
      placement="left"
      :mask-closable="true"
    >
      <n-drawer-content title="悦行 菜单" :native-scrollbar="false">
        <a
          class="go-home-btn mobile-go-home"
          href="/"
          target="_blank"
          rel="noopener"
          @click.prevent="goHome"
        >
          <span class="go-home-icon">🏠</span>
          <span>前往首页</span>
          <span class="go-home-arrow">↗</span>
        </a>
        <n-menu
          :options="menuOptions"
          :value="activeKey"
          :indent="20"
          @update:value="handleMenuKey"
        />
      </n-drawer-content>
    </n-drawer>
  </n-layout>
</template>

<style scoped>
.sider-inner {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px 12px;
  gap: 16px;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px 12px;
  border-bottom: 1px solid var(--admin-peach);
}

.brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-2));
  color: var(--admin-on-accent);
  font-size: 18px;
  flex-shrink: 0;
}

.brand-text {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 20px;
  color: var(--admin-accent);
  font-weight: 600;
  white-space: nowrap;
}

/* 暗色模式品牌下划线 */
body:has(#dm:checked) .brand {
  border-bottom-color: rgba(255, 253, 248, .12);
}
body:has(#dm:checked) .brand-text {
  color: var(--admin-accent);
}
body:has(#dm:checked) .mobile-title {
  color: var(--admin-accent);
}

/* 移动端顶栏 */
.mobile-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 0 !important;
  display: flex;
  align-items: center;
}

.mobile-header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  width: 100%;
}

.mobile-title {
  flex: 1;
  font-weight: 700;
  color: var(--admin-accent);
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 16px;
}

/* 内容区 */
.layout-content {
  background: transparent !important;
  overflow-x: hidden;
}

.content-body {
  padding: clamp(16px, 3vw, 28px);
  min-height: 100%;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

/* 菜单 n-menu 自带背景色与 themeOverrides 对齐，
   此处覆盖一层半透明让毛玻璃透过 */
:deep(.n-menu) {
  background: transparent !important;
}

/* 退出登录菜单项：红色文字区分 */
:deep(.n-menu .n-menu-item:last-child .n-menu-item-content-header) {
  color: #e74c3c;
}

/* 前往首页按钮 */
.go-home-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 4px 4px 0;
  border-radius: 12px;
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  color: var(--admin-accent);
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: .2s ease;
}

.go-home-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--admin-shadow);
  background: var(--admin-card-solid);
  border-color: var(--admin-accent);
}

.go-home-icon {
  font-size: 16px;
}

.go-home-arrow {
  margin-left: auto;
  font-size: 12px;
  opacity: .6;
  transition: opacity .2s ease, transform .2s ease;
}

.go-home-btn:hover .go-home-arrow {
  opacity: 1;
  transform: translate(2px, -2px);
}

.mobile-go-home {
  margin: 0 0 12px;
}
</style>
