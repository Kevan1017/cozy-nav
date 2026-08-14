<script setup>
/**
 * 后台 - 外观设置（独立菜单页，从网站设置抽离）
 * - SettingsAppearance 🎨 外观设置（分段切换：外观主题 / 默认主题 / 自定义配色）
 * - SettingsDisplay    🧩 前台显示（显示开关 / 默认布局 / 标语）
 */
import { onMounted } from 'vue';
import { NPageHeader } from 'naive-ui';
import { usePrefsStore } from '../../stores/prefs.js';
import SettingsAppearance from '../../components/admin/settings/SettingsAppearance.vue';
import SettingsDisplay from '../../components/admin/settings/SettingsDisplay.vue';

const prefsStore = usePrefsStore();

onMounted(() => {
  if (localStorage.getItem('token')) {
    prefsStore.fetchPrefs().catch(() => {});
  }
});
</script>

<template>
  <div class="page">
    <n-page-header
      title="外观设置"
      subtitle="给悦行换一件合身的衣服 🎨"
      class="page-header"
    />

    <SettingsAppearance />
    <SettingsDisplay />
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
:deep(.n-page-header__title) {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
}
:deep(.n-page-header__sub-title) {
  color: var(--admin-muted);
  font-size: 13px;
}
</style>
