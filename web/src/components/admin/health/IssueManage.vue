<script setup>
/**
 * 链接巡检 - 异常链接批量处理卡片
 * - 列出所有非正常状态链接（down/fail/blocked/skip/未检测），分页
 * - PC：表格多选；移动端：卡片列表，勾选框在底部操作栏左侧
 * - 批量操作：重新检测 / 重置状态 / 删除（软删除进回收站）
 */
import { ref, computed, onMounted, onUnmounted, h } from 'vue';
import { NCard, NDataTable, NTag, NButton, NPagination, NSelect, NCheckbox, NEmpty, useMessage, useDialog, NProgress } from 'naive-ui';
import { linkApi } from '../../../api/link.js';
import { renderAvatar } from '../../../composables/useRenderCell.js';

const message = useMessage();
const dialog = useDialog();

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const checkedRowKeys = ref([]);

/* 批量重检进度（后台任务轮询） */
const batchChecking = ref(false);
const checkPercent = ref(0);
let pollTimer = null;

/* 移动端识别 */
const isMobile = ref(false);
let mq = null;

/** 状态标签映射 */
const statusMeta = {
  down: { label: '💀 死链', color: 'error' },
  fail: { label: '🔴 打不开', color: 'error' },
  blocked: { label: '🟡 需代理', color: 'warning' },
  skip: { label: '⚪ 跳过', color: 'default' },
  null: { label: '❔ 未检测', color: 'default' },
};
const statusColor = (s) => statusMeta[s]?.color || 'default';
const statusLabel = (s) => statusMeta[s]?.label || (s ? `未知(${s})` : '❔ 未检测');

/* ---------- 工具函数 ---------- */
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- 数据加载 ---------- */
async function loadIssues() {
  loading.value = true;
  try {
    const res = await linkApi.getIssues(page.value, pageSize.value);
    rows.value = res.data.rows || [];
    total.value = res.data.total || 0;
    // 清理已不在当前页的勾选
    checkedRowKeys.value = checkedRowKeys.value.filter((id) => rows.value.some((r) => r.id === id));
  } catch { /* 静默 */ } finally {
    loading.value = false;
  }
}

/* ---------- 批量操作 ---------- */
function checkedIds() {
  return [...checkedRowKeys.value];
}

/** 批量重新检测：启动后台任务并轮询进度 */
async function recheckSelected() {
  const ids = checkedIds();
  if (!ids.length) return message.warning('请先勾选要重新检测的链接');
  batchChecking.value = true;
  checkPercent.value = 0;
  try {
    const res = await linkApi.batchCheck(ids);
    message.success(res.message || `已启动对 ${ids.length} 条链接的重新检测`);
    startPolling();
  } catch (err) {
    message.warning(err.message || '启动失败');
    batchChecking.value = false;
  }
}

/** 批量重置状态 */
async function resetSelected() {
  const ids = checkedIds();
  if (!ids.length) return message.warning('请先勾选要重置的链接');
  const confirmed = await new Promise((resolve) => {
    dialog.warning({
      title: '确认重置状态',
      content: `将清空选中的 ${ids.length} 条链接的失败记录，下次巡检优先重新检测，确定吗？`,
      positiveText: '确认重置',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
    });
  });
  if (!confirmed) return;
  try {
    const res = await linkApi.batchResetHealth(ids);
    message.success(res.message || '重置完成');
    await loadIssues();
  } catch (err) {
    message.warning(err.message || '重置失败');
  }
}

/** 批量删除（软删除，进回收站可恢复） */
async function deleteSelected() {
  const ids = checkedIds();
  if (!ids.length) return message.warning('请先勾选要删除的链接');
  const confirmed = await new Promise((resolve) => {
    dialog.warning({
      title: '确认批量删除',
      content: `将删除选中的 ${ids.length} 条链接（软删除，可在书签管理回收站恢复），确定吗？`,
      positiveText: '确定删除',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
    });
  });
  if (!confirmed) return;
  try {
    for (const id of ids) {
      await linkApi.remove(id);
    }
    message.success(`已删除 ${ids.length} 条链接`);
    await loadIssues();
  } catch (err) {
    message.warning(err.message || '删除失败');
  }
}

/* ---------- 单项操作（移动端卡片） ---------- */
function recheckOne(id) {
  checkedRowKeys.value = [id];
  recheckSelected();
}
async function resetOne(id) {
  checkedRowKeys.value = [id];
  await resetSelected();
}
function removeOne(row) {
  checkedRowKeys.value = [row.id];
  deleteSelected();
}

/* ---------- 进度轮询 ---------- */
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await linkApi.checkProgress();
      const { running, total: t, done } = res.data;
      if (running && t > 0) {
        checkPercent.value = Math.round((done / t) * 100);
      } else {
        stopPolling();
        batchChecking.value = false;
        message.success('重新检测完成');
        await loadIssues();
      }
    } catch { /* 静默 */ }
  }, 2000);
}
function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

/* ---------- 勾选切换（移动端） ---------- */
function toggleCheck(id, val) {
  if (val) {
    if (!checkedRowKeys.value.includes(id)) checkedRowKeys.value = [...checkedRowKeys.value, id];
  } else {
    checkedRowKeys.value = checkedRowKeys.value.filter((x) => x !== id);
  }
}

/* ---------- PC 表格列 ---------- */
const columns = computed(() => [
  { type: 'selection', fixed: 'left', width: 40 },
  { title: '链接', key: 'name', width: 280, maxWidth: 280, render: (row) => renderAvatar(row) },
  {
    title: '状态', key: 'health_status', minWidth: 100,
    render: (row) => h(NTag, { size: 'small', type: statusColor(row.health_status), round: true }, { default: () => statusLabel(row.health_status) }),
  },
  {
    title: '连续失败', key: 'fail_streak', minWidth: 80, align: 'center',
    render: (row) => (row.fail_streak > 0 ? h('b', { style: 'color:#d03050' }, `${row.fail_streak} 次`) : h('span', { style: 'color:var(--admin-muted)' }, '—')),
  },
  {
    title: '最近检测', key: 'last_check_at', minWidth: 130,
    render: (row) => h('span', { style: 'color:var(--admin-muted);font-size:12px' }, fmtTime(row.last_check_at)),
  },
  {
    title: '操作', key: 'action', minWidth: 190, align: 'center',
    render: (row) => h('div', { style: 'display:flex;gap:4px;justify-content:center' }, [
      h(NButton, { size: 'tiny', quaternary: true, type: 'primary', onClick: () => recheckOne(row.id) }, { default: () => '重检' }),
      h(NButton, { size: 'tiny', quaternary: true, onClick: () => resetOne(row.id) }, { default: () => '重置' }),
      h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: () => removeOne(row) }, { default: () => '删除' }),
    ]),
  },
]);

/* ---------- 分页 ---------- */
function handlePageChange(p) {
  page.value = p;
  loadIssues();
}
function handlePageSizeChange(size) {
  pageSize.value = size;
  page.value = 1;
  loadIssues();
}

/** 总页数 */
const pageCount = computed(() => Math.ceil(total.value / pageSize.value) || 1);

/**
 * 移动端页码列表：固定显示 3 个页码（当前页及其前后各 1 页，窗口滑动）
 * 首/尾边界裁剪，窗口外用 ... 折叠——无论点击哪一页，数字恒为 3 个且当前页始终可见
 */
const mobilePageItems = computed(() => {
  const p = page.value;
  const n = pageCount.value;
  // 总页数少时全部展示
  if (n <= 3) {
    return Array.from({ length: n }, (_, i) => ({ type: 'page', value: i + 1 }));
  }
  // 滑动窗口起点：居中于当前页，但保证窗口不越界（1..n-2）
  const start = Math.min(Math.max(p - 1, 1), n - 2);
  const items = [];
  if (start > 1) items.push({ type: 'dots' });
  for (let i = start; i <= start + 2; i++) items.push({ type: 'page', value: i });
  if (start + 2 < n) items.push({ type: 'dots' });
  return items;
});

/** 移动端翻页（越界时忽略） */
function goPage(p) {
  if (p < 1 || p > pageCount.value) return;
  handlePageChange(p);
}

onMounted(() => {
  loadIssues();
  mq = window.matchMedia('(max-width: 900px)');
  isMobile.value = mq.matches;
  mq.addEventListener('change', (e) => { isMobile.value = e.matches; });
});
onUnmounted(stopPolling);
</script>

<template>
  <n-card class="setting-card" title="⚠️ 异常链接批量处理" hoverable>
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="issue-summary">共 <b>{{ total }}</b> 条异常链接</span>
        <n-button size="small" secondary @click="loadIssues">↻ 刷新</n-button>
      </div>
      <div v-if="!isMobile && checkedRowKeys.length" class="toolbar-btns">
        <n-button size="small" type="primary" :disabled="batchChecking" @click="recheckSelected">
          重新检测 ({{ checkedRowKeys.length }})
        </n-button>
        <n-button size="small" secondary @click="resetSelected">重置状态 ({{ checkedRowKeys.length }})</n-button>
        <n-button size="small" secondary type="error" @click="deleteSelected">删除 ({{ checkedRowKeys.length }})</n-button>
      </div>
    </div>

    <!-- 批量重检进度 -->
    <div v-if="batchChecking" class="check-progress">
      <n-progress type="line" :percentage="checkPercent" :show-indicator="true" processing />
      <span class="check-tip">正在重新检测，完成后自动刷新列表…</span>
    </div>

    <n-empty v-if="!loading && !rows.length" description="太棒了，没有任何异常链接～" class="empty-tip" />

    <!-- PC 表格 -->
    <n-data-table
      v-if="!isMobile"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :row-key="(row) => row.id"
      :checked-row-keys="checkedRowKeys"
      :bordered="false"
      table-layout="fixed"
      size="small"
      class="issue-table"
      @update:checked-row-keys="(keys) => (checkedRowKeys = keys)"
    />

    <!-- 移动端卡片列表 -->
    <div v-else class="mob-list">
      <div v-for="row in rows" :key="row.id" class="mob-card">
        <div class="mob-head">
          <span class="mob-avatar" :style="{ background: row.avatar_color || 'var(--admin-accent)' }">
            {{ (row.avatar_text || row.name || '?').slice(0, 1) }}
          </span>
          <div class="mob-info">
            <div class="mob-name">{{ row.name }}</div>
            <div class="mob-domain">{{ row.domain || '—' }}</div>
          </div>
          <n-tag size="small" :type="statusColor(row.health_status)" round>{{ statusLabel(row.health_status) }}</n-tag>
        </div>
        <div class="mob-meta">
          <span>连续失败 {{ row.fail_streak > 0 ? row.fail_streak + ' 次' : '—' }}</span>
          <span>最近检测 {{ fmtTime(row.last_check_at) }}</span>
        </div>
        <div class="mob-actions">
          <n-checkbox :checked="checkedRowKeys.includes(row.id)" @update:checked="(v) => toggleCheck(row.id, v)">
            选中
          </n-checkbox>
          <div class="mob-actions-right">
            <span class="mob-btn" @click="recheckOne(row.id)">重新检测</span>
            <span class="mob-btn" @click="resetOne(row.id)">重置</span>
            <span class="mob-btn danger" @click="removeOne(row)">删除</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页：PC 用 n-pagination，移动端用自定义页码条（页码中间 ... 省略，保持单行） -->
    <div v-if="total > pageSize" class="issue-pagination" :class="{ 'mob-paginating': isMobile }">
      <n-pagination
        v-if="!isMobile"
        :page="page"
        :item-count="total"
        :page-size="pageSize"
        @update:page="handlePageChange"
      />
      <div v-else class="mob-pager">
        <span class="pager-btn" :class="{ disabled: page <= 1 }" @click="goPage(page - 1)">‹</span>
        <template v-for="it in mobilePageItems" :key="it.type + it.value">
          <span v-if="it.type === 'dots'" class="pager-dots">…</span>
          <span
            v-else
            class="pager-num"
            :class="{ active: it.value === page }"
            @click="goPage(it.value)"
          >{{ it.value }}</span>
        </template>
        <span class="pager-btn" :class="{ disabled: page >= pageCount }" @click="goPage(page + 1)">›</span>
      </div>
      <n-select
        v-model:value="pageSize"
        class="page-size-select"
        :options="[{ label: '10/页', value: 10 }, { label: '20/页', value: 20 }, { label: '50/页', value: 50 }, { label: '100/页', value: 100 }]"
        @update:value="handlePageSizeChange"
      />
    </div>

    <!-- 移动端底部固定批量操作栏 -->
    <div v-if="isMobile && checkedRowKeys.length" class="mob-bottom-bar">
      <span class="mob-selected">已选 {{ checkedRowKeys.length }} 项</span>
      <n-button size="small" type="primary" :disabled="batchChecking" @click="recheckSelected">重新检测</n-button>
      <n-button size="small" secondary @click="resetSelected">重置</n-button>
      <n-button size="small" secondary type="error" @click="deleteSelected">删除</n-button>
    </div>
  </n-card>
</template>

<style scoped>
.setting-card {
  border-radius: 18px !important;
  margin-bottom: 16px;
}
:deep(.n-card-header__main) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 16px;
  color: var(--admin-text);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.issue-summary {
  font-size: 13px;
  color: var(--admin-muted);
}
.issue-summary b {
  color: #d03050;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 15px;
}
.toolbar-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.check-progress {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--admin-card, #fff) 60%, transparent);
}
.check-tip {
  font-size: 12px;
  color: var(--admin-muted);
}

.empty-tip {
  padding: 32px 0;
}
.issue-table :deep(.n-data-table-td) {
  font-size: 13px;
}

/* 分页 */
.issue-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
}
.page-size-select {
  width: 110px;
}

/* 移动端分页：整体居中单行，页码条用省略号折叠（最多 7 个槽位） */
.mob-paginating {
  justify-content: center;
  gap: 10px;
}
.mob-paginating .page-size-select {
  width: 96px;
}

/* 移动端页码条 */
.mob-pager {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  min-width: 0;
}
.pager-btn,
.pager-num {
  min-width: 26px;
  height: 26px;
  padding: 0 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  cursor: pointer;
  color: var(--admin-text);
  background: color-mix(in srgb, var(--admin-card, #fff) 70%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.14));
  user-select: none;
}
.pager-num.active {
  background: var(--admin-accent);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
}
.pager-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.pager-dots {
  color: var(--admin-muted);
  padding: 0 1px;
  min-width: 12px;
  text-align: center;
}

/* 移动端卡片 */
.mob-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mob-card {
  border-radius: 14px;
  padding: 12px;
  background: color-mix(in srgb, var(--admin-card, #fff) 60%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.12));
  /* 裁剪溢出内容，避免长文本撑出横向滚动条 */
  overflow: hidden;
  min-width: 0;
}
.mob-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
/* 状态标签不参与压缩，防止被挤换行 */
.mob-head :deep(.n-tag) {
  flex: none;
}
.mob-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  flex: none;
}
.mob-info {
  flex: 1;
  min-width: 0;
}
.mob-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
  line-height: 1.4;
  /* 长名称打断换行，避免撑出横向滚动条 */
  word-break: break-all;
  overflow-wrap: anywhere;
}
.mob-domain {
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mob-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
  font-size: 12px;
  color: var(--admin-muted);
  min-width: 0;
}
.mob-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.12));
}
.mob-actions-right {
  display: flex;
  gap: 4px;
}
.mob-btn {
  font-size: 12px;
  color: var(--admin-accent);
  padding: 4px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--admin-accent) 10%, transparent);
  white-space: nowrap;
}
.mob-btn.danger {
  color: #d03050;
  background: rgba(208, 48, 80, 0.1);
}

/* 移动端底部固定批量操作栏 */
.mob-bottom-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 12px;
  width: calc(100% - 24px);
  max-width: 560px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--admin-card, #fff);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  z-index: 100;
}
.mob-selected {
  flex: 1;
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
}
</style>
