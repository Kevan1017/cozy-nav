<script setup>
/**
 * 后台首页 — 数据概览（Naive UI 版本）
 * - 6 张统计卡片（书签/分类/置顶/近7天新增/总访问量/今日访问）
 * - 近 7 天访问趋势折线图（vue-echarts，按需引入）
 * - 本周热门 TOP5 榜单
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { NGrid, NGridItem, NCard, NPageHeader, NStatistic, NEmpty, NButton } from 'naive-ui';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { LegacyGridContainLabel } from 'echarts/features';
import VChart from 'vue-echarts';
import { statsApi } from '../../api/stats.js';

// 按需注册 echarts 模块（tree-shaking，控制体积）
use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegacyGridContainLabel]);

const stats = ref({ linkCount: 0, categoryCount: 0, pinnedCount: 0, recentLinks: 0, totalVisits: 0, todayVisits: 0 });
const trend = ref([]);
const topLinks = ref([]);
const health = ref({ total: 0, ok: 0, blocked: 0, fail: 0, down: 0, skip: 0, tlsExpiring: [], failTop: [], issueList: [] });
const router = useRouter();

/** 近两周访问对比：趋势图展示后 7 天，前 7 天用于「与前一周对比」 */
const prevWeekCount = ref(0);
const curWeekCount = ref(0);
const trendCompare = computed(() => {
  if (prevWeekCount.value === 0 && curWeekCount.value === 0) {
    return { text: '较上周 持平', dir: 'flat' };
  }
  if (prevWeekCount.value === 0) {
    return { text: '较上周 新增访问', dir: 'up' };
  }
  const pct = ((curWeekCount.value - prevWeekCount.value) / prevWeekCount.value) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return {
    text: `较上周 ${rounded > 0 ? '+' : ''}${rounded}%`,
    dir: rounded > 0 ? 'up' : (rounded < 0 ? 'down' : 'flat'),
  };
});

/** 异常状态文案映射 */
function issueLabel(status) {
  const map = { ok: '正常', blocked: '需代理', fail: '打不开', down: '死链', skip: '跳过', unknown: '未检测' };
  return map[status] || status;
}

/** 读取后台 CSS 变量（图表在 canvas 绘制，无法直接用 var()，需取实际色值） */
function cssVar(name, fallback) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

const chartColors = {
  accent: cssVar('--admin-accent', '#6BA389'),
  muted: cssVar('--admin-muted', '#9A8B84'),
  line: cssVar('--admin-border', 'rgba(120, 100, 90, 0.12)'),
};

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis', backgroundColor: 'rgba(60, 45, 38, 0.92)', textStyle: { color: '#fff', fontSize: 12 }, borderWidth: 0 },
  grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trend.value.map((d) => d.day.slice(5)), // MM-DD
    axisLine: { lineStyle: { color: chartColors.line } },
    axisTick: { show: false },
    axisLabel: { color: chartColors.muted, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { color: chartColors.muted, fontSize: 11 },
    splitLine: { lineStyle: { type: 'dashed', color: chartColors.line } },
  },
  series: [
    {
      name: '访问量',
      type: 'line',
      smooth: true,
      data: trend.value.map((d) => d.count),
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3, color: chartColors.accent },
      itemStyle: { color: chartColors.accent, borderColor: '#fff', borderWidth: 1 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${chartColors.accent}33` },
            { offset: 1, color: `${chartColors.accent}00` },
          ],
        },
      },
    },
  ],
}));

onMounted(async () => {
  const [overviewRes, trendRes, topRes, healthRes] = await Promise.allSettled([
    statsApi.getOverview(),
    statsApi.getVisitTrend(14),
    statsApi.getTopLinks(7, 5),
    statsApi.getHealthOverview(),
  ]);
  if (overviewRes.status === 'fulfilled') stats.value = overviewRes.value.data;
  if (trendRes.status === 'fulfilled') {
    const data = trendRes.value.data.data || [];
    // 后 7 天作为当前展示窗口，前 7 天用于「与前一周对比」
    trend.value = data.length > 7 ? data.slice(7) : data;
    const prev = data.length > 7 ? data.slice(0, 7) : [];
    prevWeekCount.value = prev.reduce((s, d) => s + (d.count || 0), 0);
    curWeekCount.value = trend.value.reduce((s, d) => s + (d.count || 0), 0);
  }
  if (topRes.status === 'fulfilled') topLinks.value = topRes.value.data.rows;
  if (healthRes.status === 'fulfilled') health.value = healthRes.value.data;
});

/** 跳转巡检页（健康总览卡片入口） */
function goHealth() {
  router.push('/admin/health');
}

/** 跳转收藏时光机（趋势卡片入口） */
function goTimeline() {
  router.push('/admin/timeline');
}

/** 跳转书签管理页并筛选定位到该异常链接 */
function goLinkManage(item) {
  router.push({ path: '/admin/links', query: { health: item.status, linkId: item.id } });
}
</script>

<template>
  <div class="dashboard">
    <n-page-header
      title="数据概览"
      subtitle="看看你的小角落现在怎么样 🧭"
      class="page-header"
    />

    <!-- 第一行：6 张统计卡片（s≥640 两列，m≥1024 三列两行展示） -->
    <n-grid cols="1 s:2 m:3" responsive="screen" x-gap="16" y-gap="16">
      <n-grid-item>
        <n-card class="stat-card card-green" hoverable>
          <n-statistic label="书签总数" :value="stats.linkCount" class="stat-green">
            <template #prefix>🔖</template>
          </n-statistic>
          <p class="foot-tip">everything in its place</p>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card class="stat-card card-pink" hoverable>
          <n-statistic label="分类总数" :value="stats.categoryCount" class="stat-pink">
            <template #prefix>🗂️</template>
          </n-statistic>
          <p class="foot-tip">每一类都整齐摆放</p>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card class="stat-card card-lavender" hoverable>
          <n-statistic label="置顶书签" :value="stats.pinnedCount" class="stat-lavender">
            <template #prefix>📌</template>
          </n-statistic>
          <p class="foot-tip">收藏夹中重点标记</p>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card class="stat-card card-peach" hoverable>
          <n-statistic label="近 7 天新增" :value="stats.recentLinks" class="stat-peach">
            <template #prefix>✨</template>
          </n-statistic>
          <p class="foot-tip">最近一周的收藏</p>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card class="stat-card card-amber" hoverable>
          <n-statistic label="总访问量" :value="stats.totalVisits" class="stat-amber">
            <template #prefix>👀</template>
          </n-statistic>
          <p class="foot-tip">累计点击书签的次数</p>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card class="stat-card card-sky" hoverable>
          <n-statistic label="今日访问" :value="stats.todayVisits" class="stat-sky">
            <template #prefix>🔥</template>
          </n-statistic>
          <p class="foot-tip">今天新产生的访问</p>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 第二行：趋势图 + 热门 TOP5（m≥1024 时 2:1 分栏） -->
    <n-grid cols="1 m:3" responsive="screen" x-gap="16" y-gap="16" class="charts-row">
      <n-grid-item :span="2">
        <n-card class="panel-card" hoverable>
          <template #header>
            <span class="panel-title">近 7 天访问趋势</span>
            <span v-if="trend.length" class="trend-badge" :class="`trend-${trendCompare.dir}`">{{ trendCompare.text }}</span>
            <n-button text type="primary" size="small" class="health-go" @click="goTimeline">时光机 →</n-button>
          </template>
          <v-chart v-if="trend.length" class="trend-chart" :option="trendOption" autoresize />
          <n-empty v-else description="还没有访问数据，去前台点几个书签吧～" class="chart-empty" />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="1">
        <n-card title="本周热门 TOP5" class="panel-card" hoverable>
          <ul v-if="topLinks.length" class="top-list">
            <li v-for="(item, idx) in topLinks" :key="item.id" class="top-item">
              <span class="rank" :class="`rank-${idx + 1}`">{{ idx + 1 }}</span>
              <div class="top-info">
                <div class="top-name">{{ item.name }}</div>
                <div class="top-domain">{{ item.domain || '—' }}</div>
              </div>
              <span class="top-count">{{ item.visits }} 次</span>
            </li>
          </ul>
          <n-empty v-else description="本周还没有热门书签～" class="chart-empty" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 第三行：链接健康总览（状态分布 + TLS 证书即将到期 + 异常链接清单） -->
    <n-card v-if="health.total" class="panel-card health-panel" hoverable>
      <template #header>
        <span>🩺 链接健康总览</span>
        <n-button text type="primary" size="small" class="health-go" @click="goHealth">前往巡检 →</n-button>
      </template>
      <div class="health-row">
        <span class="health-stat"><span class="hs-dot ok" />正常 <b>{{ health.ok }}</b></span>
        <span class="health-stat"><span class="hs-dot blocked" />需代理 <b>{{ health.blocked }}</b></span>
        <span class="health-stat"><span class="hs-dot fail" />打不开 <b>{{ health.fail }}</b></span>
        <span class="health-stat"><span class="hs-dot down" />死链 <b>{{ health.down }}</b></span>
        <span class="health-stat"><span class="hs-dot skip" />跳过 <b>{{ health.skip }}</b></span>
        <span class="health-stat health-total">共 <b>{{ health.total }}</b> 条</span>
      </div>

      <template v-if="health.tlsExpiring && health.tlsExpiring.length">
        <p class="health-sub-title">HTTPS 证书即将到期</p>
        <ul class="top-list">
          <li v-for="t in health.tlsExpiring.slice(0, 5)" :key="t.id" class="top-item">
            <div class="top-info">
              <div class="top-name">{{ t.name }}</div>
              <div class="top-domain">{{ t.domain || '—' }}</div>
            </div>
            <span class="tls-tag" :class="t.level === 'red' ? 'tls-red' : 'tls-yellow'">
              {{ t.daysLeft <= 0 ? '已过期' : `${t.daysLeft} 天后过期` }}
            </span>
          </li>
        </ul>
      </template>

      <!-- 异常链接清单：巡检/检测后集中查看非正常状态链接，点击行跳转书签管理页定位处理 -->
      <template v-if="health.issueList && health.issueList.length">
        <p class="health-sub-title">异常链接清单（共 {{ health.issueList.length }} 条，点击行前往处理）</p>
        <ul class="top-list">
          <li
            v-for="item in health.issueList.slice(0, 10)"
            :key="item.id"
            class="top-item issue-row"
            title="点击到书签管理页查看并处理该链接"
            @click="goLinkManage(item)"
          >
            <div class="top-info">
              <div class="top-name">{{ item.name }}</div>
              <div class="top-domain">{{ item.domain || '—' }}</div>
            </div>
            <span v-if="item.tls" class="issue-tag tls-tag" :class="item.tls.level === 'red' ? 'tls-red' : 'tls-yellow'">
              {{ item.tls.daysLeft <= 0 ? '证书已过期' : `证书 ${item.tls.daysLeft} 天` }}
            </span>
            <span class="issue-tag" :class="`issue-${item.status}`">{{ issueLabel(item.status) }}</span>
          </li>
        </ul>
        <p v-if="health.issueList.length > 10" class="health-more">
          仅显示前 10 条，其余请到「书签管理」页按健康状态筛选查看
        </p>
      </template>

      <n-empty
        v-if="!(health.tlsExpiring && health.tlsExpiring.length) && !(health.issueList && health.issueList.length)"
        description="暂无异常，一切正常～"
        class="health-empty"
      />
    </n-card>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}

.charts-row {
  margin-top: 16px;
}

:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(20px, 4vw, 28px);
}

.stat-card {
  border-radius: 18px !important;
  position: relative;
  overflow: hidden;
  transition: transform .2s, box-shadow .2s;
}
.stat-card:hover {
  transform: translateY(-2px);
}

/* 每卡片的顶部渐变条 */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
}
.card-green::before { background: var(--admin-accent); }
.card-pink::before  { background: var(--admin-accent-2); }
.card-lavender::before { background: var(--admin-accent-3); }
.card-peach::before { background: var(--admin-peach-dark); }
.card-amber::before { background: #D9A441; }
.card-sky::before   { background: #6BB0C9; }

:deep(.n-statistic__label) {
  font-size: 13px;
  color: var(--admin-muted);
  margin-bottom: 8px;
}
.stat-green  :deep(.n-statistic__value) { color: var(--admin-accent); font-family: 'Fredoka', var(--app-font, sans-serif); }
.stat-pink   :deep(.n-statistic__value) { color: var(--admin-accent-2); font-family: 'Fredoka', var(--app-font, sans-serif); }
.stat-lavender :deep(.n-statistic__value) { color: var(--admin-accent-3); font-family: 'Fredoka', var(--app-font, sans-serif); }
.stat-peach  :deep(.n-statistic__value) { color: var(--admin-peach-dark); font-family: 'Fredoka', var(--app-font, sans-serif); }
.stat-amber  :deep(.n-statistic__value) { color: #D9A441; font-family: 'Fredoka', var(--app-font, sans-serif); }
.stat-sky    :deep(.n-statistic__value) { color: #6BB0C9; font-family: 'Fredoka', var(--app-font, sans-serif); }

.foot-tip {
  margin-top: 10px;
  font-size: 12px;
  color: var(--admin-muted);
  opacity: .8;
}

/* 图表 / TOP 榜单面板 */
.panel-card {
  border-radius: 18px !important;
  min-height: 320px;
}
.trend-chart {
  height: 280px;
}
.chart-empty {
  padding: 70px 0;
}

/* 趋势图「与前一周对比」徽标 */
.panel-title {
  margin-right: 8px;
}
.trend-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  vertical-align: middle;
}
.trend-up { background: rgba(24, 160, 88, .12); color: #18a058; }
.trend-down { background: rgba(208, 48, 80, .12); color: #d03050; }
.trend-flat { background: rgba(144, 147, 153, .12); color: #909399; }

.top-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.12));
}
.top-item:last-child {
  border-bottom: none;
}
.rank {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}
.rank-1 { background: #E8A088; }
.rank-2 { background: #D9A441; }
.rank-3 { background: #6BB0C9; }
.rank-4, .rank-5 { background: var(--admin-muted, #9A8B84); }

.top-info {
  flex: 1;
  min-width: 0;
}
.top-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text, #4A3A33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-domain {
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--admin-accent);
  font-weight: 600;
}

/* 链接健康总览面板 */
.health-panel {
  margin-top: 16px;
  min-height: 0;
}
.health-go {
  margin-left: 8px;
}
.health-row {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  padding: 6px 0 12px;
}
.health-stat {
  font-size: 13px;
  color: var(--admin-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.health-stat b {
  color: var(--admin-text, #4A3A33);
  font-size: 15px;
  font-family: 'Fredoka', var(--app-font, sans-serif);
}
.health-total b { color: var(--admin-accent); }
.hs-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.hs-dot.ok { background: #18a058; }
.hs-dot.blocked { background: #e6a23c; }
.hs-dot.fail { background: #d03050; }
.hs-dot.down { background: #a00000; }
.hs-dot.skip { background: #909399; }
.health-sub-title {
  margin: 4px 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text);
}
.tls-tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
}
.tls-red { background: rgba(208, 48, 80, .15); color: #d03050; }
.tls-yellow { background: rgba(230, 162, 60, .18); color: #e6a23c; }

/* 异常链接清单状态标签 */
.issue-tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #909399;
  color: #fff;
}
.issue-down { background: #a00000; }
.issue-fail { background: #d03050; }
.issue-blocked { background: #e6a23c; }
.issue-skip { background: #909399; }
.issue-unknown { background: #b0a89f; }
.health-more {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--admin-muted);
}
/* 异常链接清单：可点击行 */
.issue-row {
  cursor: pointer;
  border-radius: 8px;
  transition: background .15s;
}
.issue-row:hover {
  background: rgba(120, 100, 90, .06);
}
.health-empty {
  padding: 24px 0;
}
</style>
