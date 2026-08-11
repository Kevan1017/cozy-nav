<script setup>
/**
 * 链接巡检 - 历史巡检报告卡片
 * - 近 10 轮状态分布堆叠柱状图（echarts 按需引入）
 * - 报告列表（后端分页）：时间/触发方式/各状态/耗时/异常数
 * - 点击「详情」弹出本轮异常链接明细
 */
import { ref, computed, onMounted, h } from 'vue';
import { NCard, NDataTable, NTag, NButton, NPagination, NModal, NEmpty, NSpin } from 'naive-ui';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { LegacyGridContainLabel } from 'echarts/features';
import VChart from 'vue-echarts';
import { statsApi } from '../../../api/stats.js';

// 按需注册 echarts 模块
use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent, LegacyGridContainLabel]);

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const trendData = ref([]);

/* ---------- 详情弹窗 ---------- */
const detailShow = ref(false);
const detailLoading = ref(false);
const detail = ref(null);

/* ---------- 状态标签映射 ---------- */
const statusMeta = {
  ok: { label: '正常', color: 'success' },
  blocked: { label: '需代理', color: 'warning' },
  fail: { label: '打不开', color: 'error' },
  skip: { label: '跳过', color: 'default' },
};

/* ---------- 工具函数 ---------- */
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}分${Math.round(s % 60)}秒`;
}

/* ---------- 表格列 ---------- */
const columns = computed(() => [
  {
    title: '时间',
    key: 'finished_at',
    width: 160,
    render: (row) => fmtTime(row.finished_at),
  },
  {
    title: '触发',
    key: 'trigger_type',
    width: 80,
    render: (row) =>
      row.trigger_type === 'scheduled'
        ? h(NTag, { size: 'small', type: 'info', round: true }, { default: () => '⏱️ 定时' })
        : h(NTag, { size: 'small', type: 'default', round: true }, { default: () => '👆 手动' }),
  },
  {
    title: '正常',
    key: 'ok',
    width: 70,
    align: 'center',
    render: (row) => h('span', { style: 'color:var(--admin-muted)' }, row.ok),
  },
  {
    title: '需代理',
    key: 'blocked',
    width: 70,
    align: 'center',
    render: (row) => h('span', { style: 'color:var(--admin-muted)' }, row.blocked),
  },
  {
    title: '打不开',
    key: 'fail',
    width: 70,
    align: 'center',
    render: (row) => (row.fail > 0 ? h('b', { style: 'color:#d03050' }, row.fail) : h('span', { style: 'color:var(--admin-muted)' }, 0)),
  },
  {
    title: '跳过',
    key: 'skip',
    width: 70,
    align: 'center',
    render: (row) => h('span', { style: 'color:var(--admin-muted)' }, row.skip),
  },
  {
    title: '耗时',
    key: 'duration_ms',
    width: 90,
    align: 'center',
    render: (row) => h('span', { style: 'color:var(--admin-muted);font-size:12px' }, fmtDuration(row.duration_ms)),
  },
  {
    title: '异常',
    key: 'issueCount',
    width: 80,
    align: 'center',
    render: (row) =>
      row.issueCount > 0
        ? h(NTag, { size: 'small', type: 'error', round: true }, { default: () => `${row.issueCount} 条` })
        : h(NTag, { size: 'small', type: 'success', round: true }, { default: () => '无' }),
  },
  {
    title: '操作',
    key: 'action',
    width: 90,
    align: 'center',
    render: (row) => h(NButton, { size: 'small', quaternary: true, type: 'primary', onClick: () => openDetail(row.id) }, { default: () => '详情' }),
  },
]);

/* ---------- 数据加载 ---------- */
async function loadReports() {
  loading.value = true;
  try {
    const res = await statsApi.getPatrolReports(page.value, pageSize.value);
    rows.value = res.data.rows || [];
    total.value = res.data.total || 0;
  } catch { /* 静默 */ } finally {
    loading.value = false;
  }
}

async function loadTrend() {
  try {
    const res = await statsApi.getPatrolTrend(10);
    trendData.value = res.data.rows || [];
  } catch { /* 静默 */ }
}

/** 趋势图：近 10 轮各状态堆叠柱状 */
const trendOption = computed(() => ({
  tooltip: { trigger: 'axis', backgroundColor: 'rgba(60, 45, 38, 0.92)', textStyle: { color: '#fff', fontSize: 12 }, borderWidth: 0 },
  legend: { data: ['正常', '需代理', '打不开', '跳过'], top: 0, textStyle: { color: 'var(--admin-muted, #9A8B84)', fontSize: 11 } },
  grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
  xAxis: {
    type: 'category',
    data: trendData.value.map((r) => fmtTime(r.finished_at).slice(5)),
    axisLine: { lineStyle: { color: 'rgba(120, 100, 90, 0.12)' } },
    axisTick: { show: false },
    axisLabel: { color: 'var(--admin-muted, #9A8B84)', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { color: 'var(--admin-muted, #9A8B84)', fontSize: 10 },
    splitLine: { lineStyle: { type: 'dashed', color: 'rgba(120, 100, 90, 0.12)' } },
  },
  series: [
    { name: '正常', type: 'bar', stack: 'total', data: trendData.value.map((r) => r.ok), itemStyle: { color: '#18a058' } },
    { name: '需代理', type: 'bar', stack: 'total', data: trendData.value.map((r) => r.blocked), itemStyle: { color: '#e6a23c' } },
    { name: '打不开', type: 'bar', stack: 'total', data: trendData.value.map((r) => r.fail), itemStyle: { color: '#d03050' } },
    { name: '跳过', type: 'bar', stack: 'total', data: trendData.value.map((r) => r.skip), itemStyle: { color: '#909399' } },
  ],
}));

/* ---------- 详情 ---------- */
async function openDetail(id) {
  detailShow.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const res = await statsApi.getPatrolReportDetail(id);
    detail.value = res.data;
  } catch { /* 静默 */ } finally {
    detailLoading.value = false;
  }
}

function handlePageChange(p) {
  page.value = p;
  loadReports();
}

onMounted(() => {
  loadReports();
  loadTrend();
});
</script>

<template>
  <n-card class="setting-card" title="📜 历史巡检报告" hoverable>
    <p class="hint">每轮巡检结束后自动记录，最多保留最近 100 轮。下方为近 10 轮状态趋势。</p>

    <!-- 趋势图 -->
    <div v-if="trendData.length" class="report-chart">
      <v-chart :option="trendOption" autoresize />
    </div>
    <n-empty v-else description="还没有巡检记录，去上方点击「立即巡检」开始第一轮吧～" class="chart-empty" />

    <!-- 报告列表 -->
    <n-data-table
      :columns="columns"
      :data="rows"
      :loading="loading"
      :row-key="(row) => row.id"
      :bordered="false"
      class="report-table"
      size="small"
    />

    <!-- 分页 -->
    <div v-if="total > pageSize" class="report-pagination">
      <n-pagination
        :page="page"
        :item-count="total"
        :page-size="pageSize"
        @update:page="handlePageChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <n-modal
      v-model:show="detailShow"
      preset="card"
      title="巡检报告详情"
      style="width: min(560px, 92vw)"
      class="detail-modal"
    >
      <n-spin :show="detailLoading">
        <template v-if="detail">
          <div class="detail-summary">
            <span class="detail-time">{{ fmtTime(detail.finished_at) }}</span>
            <n-tag size="small" :type="detail.trigger_type === 'scheduled' ? 'info' : 'default'" round>
              {{ detail.trigger_type === 'scheduled' ? '⏱️ 定时巡检' : '👆 手动检测' }}
            </n-tag>
            <span class="detail-meta">共 {{ detail.total }} 条 · 耗时 {{ fmtDuration(detail.duration_ms) }}</span>
          </div>

          <ul v-if="detail.issues && detail.issues.length" class="issue-list">
            <li v-for="it in detail.issues" :key="it.id" class="issue-item">
              <n-tag size="small" :type="statusMeta[it.status]?.color || 'default'" round>
                {{ statusMeta[it.status]?.label || it.status }}
              </n-tag>
              <div class="issue-info">
                <div class="issue-name">{{ it.name || '未知链接' }}</div>
                <div class="issue-domain">{{ it.domain || it.url || '—' }}</div>
              </div>
              <span v-if="it.gone" class="issue-gone">已删除</span>
              <span v-else-if="it.failStreak" class="issue-streak">连续失败 {{ it.failStreak }} 次</span>
            </li>
          </ul>
          <n-empty v-else description="本轮没有异常链接，一切正常～" class="chart-empty" />
        </template>
      </n-spin>
    </n-modal>
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
.hint {
  font-size: 13px;
  color: var(--admin-muted);
  line-height: 1.6;
  margin-bottom: 14px;
}

.report-chart {
  height: 220px;
  margin-bottom: 18px;
}
.chart-empty {
  padding: 40px 0;
}

.report-table {
  margin-top: 4px;
}
:deep(.report-table .n-data-table-td) {
  font-size: 13px;
}
:deep(.report-table .n-data-table-th) {
  font-size: 12px;
  font-weight: 600;
}

.report-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px 20px;
}

/* 详情弹窗 */
.detail-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.12));
}
.detail-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text);
}
.detail-meta {
  font-size: 12px;
  color: var(--admin-muted);
}
.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 46vh;
  overflow-y: auto;
}
.issue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
  border-bottom: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.12));
}
.issue-item:last-child {
  border-bottom: none;
}
.issue-info {
  flex: 1;
  min-width: 0;
}
.issue-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.issue-domain {
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.issue-streak {
  flex-shrink: 0;
  font-size: 11px;
  color: #d03050;
}
.issue-gone {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--admin-muted);
}
</style>
