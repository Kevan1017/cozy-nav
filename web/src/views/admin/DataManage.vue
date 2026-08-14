<script setup>
/**
 * 后台 - 数据管理（独立菜单页，从网站设置抽离）
 * - DataImportExport 📦 导出 / 导入（JSON / 浏览器书签）
 * - BackupManager    🛡️ 自动备份（每天 03:00 本地快照 + 增量跳过 + 备份记录）
 */
import { NPageHeader } from 'naive-ui';
import DataImportExport from '../../components/admin/data/DataImportExport.vue';
import BackupManager from '../../components/admin/data/BackupManager.vue';
</script>

<template>
  <div class="page">
    <n-page-header
      title="数据管理"
      subtitle="导出导入与自动备份，数据安全有保障 📦"
      class="page-header"
    />

    <DataImportExport />
    <BackupManager />
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
:deep(.n-page-header__sub-title) {
  color: var(--admin-muted);
  font-size: 13px;
}
</style>
