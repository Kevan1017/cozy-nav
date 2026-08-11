<script setup>
/**
 * 偏好设置页（容器）
 * 各功能卡片已拆分为独立子组件：
 * - SettingsSite       🌐 站点设置（分段切换：基本配置 / 前台显示）
 * - SettingsAppearance 🎨 外观设置（分段切换：外观主题 / 默认主题 / 自定义配色）
 * - SettingsSecurity   🔐 安全设置（分段切换：登录密码 / 保险库）
 * 注：链接巡检（SettingsHealth）已于 2026-08-11 抽离为独立菜单「链接巡检」（/admin/health）；
 *     巡检通知与备份通知已于同日抽离为独立菜单「通知中心」（/admin/notify）；
 *     数据管理（导出/导入 + 自动备份）已抽离为独立菜单「数据管理」（/admin/data）
 */
import { onMounted } from 'vue';
import { NPageHeader } from 'naive-ui';
import { usePrefsStore } from '../../stores/prefs.js';
import SettingsSite from '../../components/admin/settings/SettingsSite.vue';
import SettingsAppearance from '../../components/admin/settings/SettingsAppearance.vue';
import SettingsSecurity from '../../components/admin/settings/SettingsSecurity.vue';

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
      title="网站设置"
      subtitle="让小角落变成你最喜欢的样子 ⚙️"
      class="page-header"
    />

    <SettingsSite />
    <SettingsAppearance />
    <SettingsSecurity />
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
