<script setup>
/**
 * 后台 - 链接巡检（独立菜单页，从网站设置抽离）
 * - SettingsHealth       🩺 巡检配置（开关/间隔/条数/判死/TLS/冷链接/立即巡检）
 * - PatrolReports        📜 历史巡检报告（趋势图 + 报告列表 + 异常明细）
 * - IssueManage          ⚠️ 异常链接处理
 * 注：巡检通知已抽离到「通知中心」（/admin/notify）
 */
import { NPageHeader } from 'naive-ui';
import SettingsHealth from '../../components/admin/settings/SettingsHealth.vue';
import PatrolReports from '../../components/admin/health/PatrolReports.vue';
import IssueManage from '../../components/admin/health/IssueManage.vue';
</script>

<template>
  <div class="page">
    <n-page-header
      title="链接巡检"
      subtitle="定期检查链接可用性，有异常时推送到你的手机 🩺"
      class="page-header"
    />

    <SettingsHealth />
    <IssueManage />
    <PatrolReports />
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
}
:deep(.n-page-header__subtitle) {
  color: var(--admin-muted);
  font-size: 13px;
}

/* 小屏：标题与副标题纵向排列，避免长副标题挤压标题换行 */
@media (max-width: 768px) {
  :deep(.n-page-header__main) {
    flex-direction: column;
    align-items: flex-start;
  }
  :deep(.n-page-header__subtitle) {
    margin-left: 0;
  }
}
</style>
