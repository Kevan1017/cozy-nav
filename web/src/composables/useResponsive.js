/**
 * 响应式断点检测
 * 供 JS 逻辑分支使用（如表格 vs 卡片切换）
 */
import { ref, onMounted, onUnmounted } from 'vue';

export function useResponsive() {
  const isMobile = ref(window.innerWidth < 768);
  const isTablet = ref(window.innerWidth >= 768 && window.innerWidth < 1024);
  const isDesktop = ref(window.innerWidth >= 1024);
  // 移动端布局视图：手机 + 平板（<1024px）统一按移动端布局处理
  const isMobileView = ref(window.innerWidth < 1024);

  function update() {
    isMobile.value = window.innerWidth < 768;
    isTablet.value = window.innerWidth >= 768 && window.innerWidth < 1024;
    isDesktop.value = window.innerWidth >= 1024;
    isMobileView.value = window.innerWidth < 1024;
  }

  onMounted(() => window.addEventListener('resize', update));
  onUnmounted(() => window.removeEventListener('resize', update));

  return { isMobile, isTablet, isDesktop, isMobileView };
}
