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
import {
  LayoutDashboard,
  FolderTree,
  Bookmark,
  Search,
  Database,
  Stethoscope,
  History,
  Bell,
  ScrollText,
  Palette,
  Settings as SettingsIcon,
  LogOut,
} from '@lucide/vue';
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

/* ---------- 菜单项（分组复用：PC 侧边栏 + 移动端抽屉） ---------- */
const menuOptions = computed(() => [
  {
    type: 'group',
    label: '内容管理',
    key: 'g-content',
    children: [
      { label: '页面概览', key: '/admin', icon: renderIcon(LayoutDashboard) },
      { label: '分类管理', key: '/admin/categories', icon: renderIcon(FolderTree) },
      { label: '书签管理', key: '/admin/links', icon: renderIcon(Bookmark) },
      { label: '搜索引擎', key: '/admin/engines', icon: renderIcon(Search) },
    ],
  },
  {
    type: 'group',
    label: '数据维护',
    key: 'g-data',
    children: [
      { label: '数据管理', key: '/admin/data', icon: renderIcon(Database) },
      { label: '收藏时光机', key: '/admin/timeline', icon: renderIcon(History) },
      { label: '链接巡检', key: '/admin/health', icon: renderIcon(Stethoscope) },
    ],
  },
  {
    type: 'group',
    label: '通知日志',
    key: 'g-log',
    children: [
      { label: '通知中心', key: '/admin/notify', icon: renderIcon(Bell) },
      { label: '操作日志', key: '/admin/logs', icon: renderIcon(ScrollText) },
    ],
  },
  {
    type: 'group',
    label: '设置',
    key: 'g-settings',
    children: [
      { label: '外观设置', key: '/admin/appearance', icon: renderIcon(Palette) },
      { label: '网站设置', key: '/admin/settings', icon: renderIcon(SettingsIcon) },
    ],
  },
]);

/** 包装 Lucide 图标为 n-menu 可用的渲染函数 */
function renderIcon(icon) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

/* ---------- 当前激活的菜单 key（与 route.path 对齐） ---------- */
const activeKey = computed(() => {
  /** 扁平化所有叶子菜单项（跳过分组项） */
  const leaves = menuOptions.value.flatMap((opt) => opt.children || [opt]);
  // 先精确匹配，确保子路由不会错误命中父级菜单
  for (const opt of leaves) {
    if (route.path === opt.key) return opt.key;
  }
  // 再前缀匹配，用于子路径（如 /admin/links/create）
  for (const opt of leaves) {
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
        <div class="menu-wrap">
          <n-menu
            :options="menuOptions"
            :value="activeKey"
            :indent="20"
            @update:value="handleMenuKey"
          />
        </div>
        <n-button
          class="logout-btn"
          quaternary
          block
          @click="confirmLogout"
        >
          <template #icon>
            <n-icon :size="16"><LogOut /></n-icon>
          </template>
          退出登录
        </n-button>
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
  width: 100%;
}

/* 菜单 n-menu 自带背景色与 themeOverrides 对齐，
   此处覆盖一层半透明让毛玻璃透过 */
:deep(.n-menu) {
  background: transparent !important;
}

/* 菜单滚动区：占据侧边栏剩余空间，超出时内部滚动（隐藏滚动条，滚轮/触摸仍可滚动） */
.menu-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* 隐藏原生滚动条，避免菜单区右侧出现滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE / Edge 旧版 */
}
.menu-wrap::-webkit-scrollbar {
  display: none; /* Chrome / Safari / Edge */
}

/* 菜单分组标题：小号弱化，与菜单项拉开层级 */
:deep(.n-menu .n-menu-item-group-title) {
  font-size: 12px;
  color: var(--admin-muted);
  opacity: .8;
}

/* 侧边栏底部退出登录按钮 */
.logout-btn {
  flex: none;
  color: #e74c3c !important;
  border-radius: 12px;
  border: 1px solid var(--admin-border);
  background: var(--admin-card);
  transition: .2s ease;
}
.logout-btn:hover {
  border-color: #e74c3c;
  background: var(--admin-card-solid);
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
