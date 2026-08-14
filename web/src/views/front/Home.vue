<script setup>
/**
 * 前台主页：组装所有组件 + 交互逻辑
 */
import { ref, computed, onMounted } from 'vue';
import { useDataStore } from '../../stores/data.js';
import { usePrefsStore } from '../../stores/prefs.js';
import { useVaultStore } from '../../stores/vault.js';
import { useSearch } from '../../composables/useSearch.js';
import { useFestival } from '../../composables/useFestival.js';
import { useResponsive } from '../../composables/useResponsive.js';

import BackgroundDecor from '../../components/ui/BackgroundDecor.vue';
import FestivalDecor from '../../components/ui/FestivalDecor.vue';
import BackToTop from '../../components/ui/BackToTop.vue';
import TopBar from '../../components/layout/TopBar.vue';
import Footer from '../../components/layout/Footer.vue';
import HeroSection from '../../components/hero/HeroSection.vue';
import PinStrip from '../../components/pin/PinStrip.vue';
import SearchBar from '../../components/search/SearchBar.vue';
import CategoryGrid from '../../components/bookmark/CategoryGrid.vue';
import CategoryNavBar from '../../components/bookmark/CategoryNavBar.vue';

const dataStore = useDataStore();
const prefsStore = usePrefsStore();
const vaultStore = useVaultStore();

/** 搜索逻辑 */
const { query, engineKey, results, activeIndex, setEngine, search, openLink,
  moveDown, moveUp, confirm, displayedEngines } = useSearch(() => dataStore.allLinks);

/** 节日彩蛋（仅 PC 端非触摸设备显示） */
const { festival } = useFestival();
const { isMobile, isDesktop } = useResponsive();
/** 触摸屏设备（手机/平板，无论屏幕多大）一律不显示节日彩蛋 */
const isTouchDevice = ref(window.matchMedia('(pointer: coarse)').matches);
/** 是否显示节日装饰：非移动宽度 + 非触摸设备，且开关开启 */
const showFestival = computed(() =>
  !isMobile.value && !isTouchDevice.value && festival.value && prefsStore.festivalEnabled
);

/** 搜索框 ref */
const searchBarRef = ref(null);

/** 点击锁定分类 → 通过 vault store 弹出全局密码框，解锁后重新加载数据 */
async function handleVaultUnlock() {
  try {
    await vaultStore.waitForPassword();
    // 解锁成功，重新加载分类数据
    await dataStore.fetchCategories(false);
  } catch {
    // 用户取消解锁，不操作
  }
}

/** 统计数据 */
const linkCount = computed(() => dataStore.allLinks.length);
const categoryCount = computed(() => dataStore.categories.length);

/** 切换搜索引擎并同步后端 */
function handleEngineChange(key) {
  setEngine(key);
  prefsStore.updateSearchEngine(key).catch(() => {});
}

/** 处理搜索键盘导航 */
function handleNavigate(dir) {
  if (dir === 'down') moveDown();
  else if (dir === 'up') moveUp();
  else if (typeof dir === 'number') activeIndex.value = dir;
}

onMounted(async () => {
  // 前台公开访问：不带登录 token，受保险库锁定控制
  // main.js 已并行预取分类数据；这里只复用已有/在途请求，避免重复请求推迟置顶板块渲染
  await dataStore.ensurePublicLoaded();
  // 偏好设置已在 main.js 挂载前加载完成，直接使用
  setEngine(prefsStore.searchEngine);
});
</script>

<template>
  <BackgroundDecor />
  <FestivalDecor v-if="showFestival" :festival="festival" />

  <div class="stage">
    <TopBar />

    <HeroSection
      :link-count="linkCount"
      :category-count="categoryCount"
    />

    <SearchBar
      ref="searchBarRef"
      v-model="query"
      :engine-key="engineKey"
      :engines="displayedEngines"
      :results="results"
      :active-index="activeIndex"
      @update:engine-key="handleEngineChange"
      @search="search"
      @open="openLink"
      @navigate="handleNavigate"
      @confirm="confirm"
    />

    <!-- 置顶书签：数据加载期间不渲染（留白），数据到位后 bob 淡入显示；后台关闭置顶板块开关时不渲染 -->
    <PinStrip
      v-if="!dataStore.isLoading && prefsStore.pinStripEnabled"
      :links="dataStore.pinnedLinks"
      @open="openLink"
    />

    <!-- 分类快捷导航条：仅 PC（≥1024px）显示，数据到位后 bob 淡入，与分类卡片同时出现 -->
    <CategoryNavBar
      v-if="isDesktop"
      :categories="dataStore.categories"
    />

    <CategoryGrid
      :categories="dataStore.categories"
      :view-mode="prefsStore.viewMode"
      @open="openLink"
      @unlock="handleVaultUnlock"
    />

    <Footer />

    <!-- 返回顶部按钮 -->
    <BackToTop />
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(10px, 2.5vw, 32px);
}
</style>
