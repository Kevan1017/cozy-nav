<script setup>
/**
 * 偏好设置页（容器）
 * 各功能卡片已拆分为独立子组件：
 * - SettingsSite       🌐 站点设置（基本配置：标题 / Logo / 关键词 / 描述）
 * - SettingsSecurity   🔐 安全设置（分段切换：登录密码 / 保险库）
 * 注：链接巡检（SettingsHealth）已于 2026-08-11 抽离为独立菜单「链接巡检」（/admin/health）；
 *     巡检通知与备份通知已于同日抽离为独立菜单「通知中心」（/admin/notify）；
 *     数据管理（导出/导入 + 自动备份）已抽离为独立菜单「数据管理」（/admin/data）；
 *     外观设置（SettingsAppearance）与前台显示（SettingsDisplay）已抽离为独立菜单「外观设置」（/admin/appearance）
 */
import { ref, computed, onMounted } from 'vue';
import { NPageHeader } from 'naive-ui';
import { usePrefsStore } from '../../stores/prefs.js';
import SettingsSite from '../../components/admin/settings/SettingsSite.vue';
import SettingsSecurity from '../../components/admin/settings/SettingsSecurity.vue';
import CollapsibleCard from '../../components/admin/settings/CollapsibleCard.vue';
import ChangelogPanel from '../../components/admin/settings/ChangelogPanel.vue';
import { versionApi } from '../../api/version.js';

const prefsStore = usePrefsStore();

/** 版本信息（「关于悦行」卡片展示，来源：GET /api/version） */
const versionInfo = ref({ display: '', commit: '', commitDate: '', environment: '' });

/** 运行环境显示文本（production/development → 中文） */
const envText = computed(() => {
  const env = versionInfo.value.environment;
  if (env === 'production') return '生产环境';
  if (env === 'development') return '开发环境';
  return env || '—';
});

onMounted(() => {
  if (localStorage.getItem('token')) {
    prefsStore.fetchPrefs().catch(() => {});
  }
  // 拉取版本信息（失败静默，卡片显示占位）
  versionApi
    .get()
    .then((res) => {
      versionInfo.value = res.data || {};
    })
    .catch(() => {});
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
    <SettingsSecurity />

    <!-- 关于悦行：展示当前部署版本信息（来自 Git，随提交自动更新） -->
    <collapsible-card title="ℹ️ 关于悦行">
      <div class="about-grid">
        <div class="about-item">
          <div class="about-label">当前版本</div>
          <div class="about-value">{{ versionInfo.display || '—' }}</div>
        </div>
        <div class="about-item">
          <div class="about-label">Git 提交</div>
          <div class="about-value">{{ versionInfo.commit || '—' }}</div>
        </div>
        <div class="about-item">
          <div class="about-label">提交日期</div>
          <div class="about-value">{{ versionInfo.commitDate || '—' }}</div>
        </div>
        <div class="about-item">
          <div class="about-label">运行环境</div>
          <div class="about-value">{{ envText }}</div>
        </div>
      </div>
      <p class="hint about-hint">
        版本号自动跟随 Git 提交更新（如 v1.0.0+abc1234）。每次部署服务器执行
        <code>git pull</code> 后，这里会显示最新的提交哈希，方便核对线上代码版本。
      </p>

      <!-- 更新记录：记录每次版本修复内容（数据存数据库 changelog 表） -->
      <ChangelogPanel />
    </collapsible-card>
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

/* ========== 关于悦行 卡片 ========== */
.about-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.about-item {
  background: var(--admin-bg-soft, rgba(0, 0, 0, .04));
  border-radius: 12px;
  padding: 12px 14px;
}
.about-label {
  font-size: 12px;
  color: var(--admin-muted);
  margin-bottom: 4px;
}
.about-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
  font-family: 'Fredoka', var(--app-font, sans-serif);
  word-break: break-all;
}
.about-hint {
  margin-top: 12px;
}
.about-hint code {
  background: var(--admin-bg-soft, rgba(0, 0, 0, .06));
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
}
</style>
