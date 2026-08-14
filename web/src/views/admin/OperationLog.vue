<script setup>
/**
 * 操作日志页
 * - PC：n-data-table 表格 + 服务端分页 + 模块筛选 + 关键字搜索
 * - 移动端：简化卡片列表
 * - 清空按钮：二次确认后物理删除全部日志
 */
import { ref, computed, onMounted, h } from 'vue';
import { NPageHeader, NButton, NCard, NDataTable, NSelect, NInput, NTag, NSpace, NEmpty, useMessage, useDialog } from 'naive-ui';
import { useResponsive } from '../../composables/useResponsive.js';
import { operationLogApi } from '../../api/operationLog.js';

const message = useMessage();
const dialog = useDialog();
const { isMobileView } = useResponsive();

/* ---------- 模块映射（标签颜色） ---------- */
const MODULES = [
  { label: '全部模块', value: '' },
  { label: '🔐 认证', value: 'auth', color: 'info' },
  { label: '🔖 书签', value: 'link', color: 'warning' },
  { label: '🗂️ 分类', value: 'category', color: 'success' },
  { label: '🔎 搜索引擎', value: 'engine', color: 'primary' },
  { label: '📤 导入导出', value: 'import', color: 'error' },
  { label: '🛡️ 保险库', value: 'vault', color: 'error' },
  { label: '💾 备份', value: 'backup', color: 'primary' },
  { label: '🩺 巡检', value: 'patrol', color: 'warning' },
  { label: '⚙️ 设置', value: 'setting', color: 'default' },
];
const MODULE_COLOR = Object.fromEntries(MODULES.filter((m) => m.value).map((m) => [m.value, m.color]));
const MODULE_LABEL = Object.fromEntries(MODULES.filter((m) => m.value).map((m) => [m.value, m.label.replace(/^\S+\s/, '')]));

/* ---------- 列表与筛选状态 ---------- */
const logs = ref([]);
const loading = ref(false);
const filterModule = ref('');
const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const pageSizes = [10, 20, 50, 100];
const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes,
  prefix: (p) => `共 ${p.itemCount} 条 · 第 ${p.page} / ${p.pageCount} 页`,
}));

/** 拉取日志（服务端分页 + 筛选） */
async function loadLogs() {
  loading.value = true;
  try {
    const res = await operationLogApi.getLogs({
      page: page.value,
      pageSize: pageSize.value,
      module: filterModule.value,
      keyword: keyword.value.trim(),
    });
    logs.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (err) {
    message.error(err?.message || '加载日志失败');
  } finally {
    loading.value = false;
  }
}

/** 筛选条件变化：重置回第一页 */
function onFilterChange() {
  page.value = 1;
  loadLogs();
}

/** 分页切换 */
function onPageChange(p) {
  page.value = p;
  loadLogs();
}
function onPageSizeChange(size) {
  pageSize.value = size;
  page.value = 1;
  loadLogs();
}

/** 清空日志（二次确认） */
function handleClear() {
  dialog.warning({
    title: '清空操作日志',
    content: `确定清空全部 ${total.value} 条操作日志吗？此操作不可恢复。`,
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res = await operationLogApi.clearAll();
        message.success(res?.message || '已清空');
        page.value = 1;
        loadLogs();
      } catch (err) {
        message.error(err?.message || '清空失败');
      }
    },
  });
}

/* ---------- 表格列 ---------- */
function formatTime(t) {
  if (!t) return '-';
  // SQLite CURRENT_TIMESTAMP 为 UTC（"2026-08-13 09:20:50"），转本地时间显示
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return t;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const columns = [
  {
    title: '时间',
    key: 'created_at',
    width: 170,
    render: (row) => formatTime(row.created_at),
  },
  {
    title: '模块',
    key: 'module',
    width: 100,
    render: (row) => h(NTag, { size: 'small', type: MODULE_COLOR[row.module] || 'default', bordered: false }, { default: () => MODULE_LABEL[row.module] || row.module }),
  },
  {
    title: '操作内容',
    key: 'detail',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: (row) => row.detail || '-',
  },
  {
    title: '操作人',
    key: 'operator',
    width: 90,
    render: (row) => row.operator || '-',
  },
  {
    title: '来源 IP',
    key: 'ip',
    width: 130,
    render: (row) => row.ip || '-',
  },
];

/** 移动端卡片：时间 + 模块 + 内容 + 来源 */
const mobileLogs = computed(() => logs.value);

onMounted(loadLogs);
</script>

<template>
  <div class="op-log-page">
    <n-page-header class="op-log-header" title="操作日志" subtitle="后台关键操作记录 · 保留最近 5000 条">
      <template #extra>
        <n-button type="error" secondary size="small" :disabled="!total" @click="handleClear">
          清空日志
        </n-button>
      </template>
    </n-page-header>

    <!-- 筛选栏 -->
    <n-card v-if="logs.length || filterModule || keyword" class="filter-card" embedded size="small">
      <div class="filter-row">
        <n-select v-model:value="filterModule" :options="MODULES" size="medium" class="filter-module" @update:value="onFilterChange" />
        <n-input
          v-model:value="keyword"
          placeholder="搜索操作内容 / 操作人 / IP..."
          clearable
          size="medium"
          class="filter-search"
          @keyup.enter="onFilterChange"
          @clear="onFilterChange"
        >
          <template #prefix>🔍</template>
        </n-input>
      </div>
    </n-card>

    <!-- PC 表格 -->
    <n-card v-if="!isMobileView" class="table-card" content-style="padding:0" :bordered="false">
      <div class="table-scroll-wrap">
        <n-data-table
          :columns="columns"
          :data="logs"
          :loading="loading"
          :pagination="pagination"
          :remote="true"
          :row-key="(r) => r.id"
          :bordered="false"
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        >
          <template #empty>
            <n-empty description="暂无操作日志" />
          </template>
        </n-data-table>
      </div>
    </n-card>

    <!-- 移动端卡片列表 -->
    <div v-else class="op-log-mobile">
      <template v-if="mobileLogs.length">
        <n-card v-for="log in mobileLogs" :key="log.id" class="op-log-card" embedded size="small">
          <div class="op-log-head">
            <n-tag size="small" :type="MODULE_COLOR[log.module] || 'default'" :bordered="false">
              {{ MODULE_LABEL[log.module] || log.module }}
            </n-tag>
            <span class="op-log-time">{{ formatTime(log.created_at) }}</span>
          </div>
          <div class="op-log-detail">{{ log.detail || '-' }}</div>
          <div class="op-log-meta">
            <span v-if="log.operator">操作人：{{ log.operator }}</span>
            <span v-if="log.ip">IP：{{ log.ip }}</span>
          </div>
        </n-card>
        <div class="op-log-pager">
          <n-space justify="space-between" align="center" style="width:100%">
            <span class="op-log-count">共 {{ total }} 条</span>
            <n-button size="small" text :disabled="page <= 1" @click="onPageChange(page - 1)">上一页</n-button>
            <span class="op-log-page">第 {{ page }} 页</span>
            <n-button size="small" text :disabled="page * pageSize >= total" @click="onPageChange(page + 1)">下一页</n-button>
          </n-space>
        </div>
      </template>
      <n-empty v-else description="暂无操作日志" />
    </div>
  </div>
</template>

<style scoped>
.op-log-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.op-log-header {
  margin-bottom: 0;
}

/* 筛选栏：与书签管理一致，移动端下拉/搜索换行 */
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.filter-module {
  width: 180px;
  flex-shrink: 0;
}
.filter-search {
  flex: 1;
  min-width: 0;
}
@media (max-width: 1023px) {
  .filter-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-module {
    flex: 1 1 100%;
    width: auto;
  }
  .filter-search {
    flex: 1 1 100%;
  }
}

/* 移动端卡片 */
.op-log-card {
  border-radius: 14px;
  margin-bottom: 10px;
}
.op-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.op-log-time {
  font-size: 12px;
  color: var(--admin-text-secondary, #999);
}
.op-log-detail {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-all;
}
.op-log-meta {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--admin-text-secondary, #999);
}
.op-log-pager {
  margin-top: 4px;
  padding: 12px 0 4px;
  border-top: 1px dashed rgba(128, 128, 128, 0.25);
}
.op-log-count {
  font-size: 12px;
  color: var(--admin-text-secondary, #999);
}
.op-log-page {
  font-size: 13px;
}
</style>
