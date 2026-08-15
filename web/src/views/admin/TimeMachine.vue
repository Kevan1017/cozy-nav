<script setup>
/**
 * 收藏时光机
 * 选任意一天，回看当天收藏的书签 + 当天的访问轨迹
 * - 日历（有收藏/访问的日期打点）+ 前一天 / 后一天 / 回到今天
 * - 右侧「当天收藏」列表、「当天访问」时间线
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { NPageHeader, NCard, NGrid, NGridItem, NButton, NCalendar, NEmpty, NPagination, useMessage } from 'naive-ui';
import FaviconImage from '../../components/ui/FaviconImage.vue';
import { usePrefsStore } from '../../stores/prefs.js';
import { statsApi } from '../../api/stats.js';

const message = useMessage();
const prefsStore = usePrefsStore();

/** 小屏判断：分页器切换为简单模式（仅「1/25」+ 箭头），避免页码溢出 */
const isNarrow = ref(false);
let mq;
function syncNarrow(e) {
  isNarrow.value = e.matches;
}

const dateValue = ref(Date.now()); // naive-ui 日期控件值：时间戳（本地零点）
const date = ref('');
const collected = ref([]);
const visited = ref([]);
const loading = ref(false);

/** 每页展示条数：单日收藏/访问可能上百条，采用分页避免页面过长 */
const PAGE_SIZE = 10;
const collectedPage = ref(1);
const visitedPage = ref(1);

/** 当前页展示的收藏 / 访问条目 */
const collectedPageItems = computed(() => collected.value.slice((collectedPage.value - 1) * PAGE_SIZE, collectedPage.value * PAGE_SIZE));
const visitedPageItems = computed(() => visited.value.slice((visitedPage.value - 1) * PAGE_SIZE, visitedPage.value * PAGE_SIZE));

/** 日历标记：近一年有收藏/访问的日期集合 { 'YYYY-MM-DD': { collected, visited } } */
const highlightMap = ref({});

/** 日历单元格 key：YYYY-MM-DD（month 为 1-12） */
function dayKey(year, month, date) {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

/** 拉取近一年有收藏/访问的日期，供日历打点 */
async function loadHighlight() {
  try {
    const res = await statsApi.getHighlightDays(365);
    const map = {};
    for (const item of res.data?.items || []) map[item.date] = item;
    highlightMap.value = map;
  } catch {
    // 标记加载失败不阻塞页面，日历仅无圆点
  }
}

/** 本地日期格式化 YYYY-MM-DD */
function fmtDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const today = fmtDay(new Date());
const isToday = computed(() => date.value === today);

/** 时间戳格式化为 HH:mm（本地时区） */
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 拉取指定日期的数据 */
async function load() {
  loading.value = true;
  try {
    const res = await statsApi.getDayDetail(date.value);
    collected.value = res.data?.collected || [];
    visited.value = res.data?.visited || [];
    // 切换日期后回到第一页
    collectedPage.value = 1;
    visitedPage.value = 1;
  } catch (err) {
    message.error(err?.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

/** 前一天 / 后一天 */
function shiftDay(offset) {
  const d = new Date(dateValue.value);
  d.setDate(d.getDate() + offset);
  dateValue.value = d.getTime();
  applyDate();
}

/** 回到今天 */
function goToday() {
  dateValue.value = Date.now();
  applyDate();
}

/** 根据 dateValue 生成日期串并加载 */
function applyDate() {
  date.value = fmtDay(new Date(dateValue.value));
  load();
}

/** 打开书签（新标签） */
function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener');
}

onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)');
  isNarrow.value = mq.matches;
  mq.addEventListener('change', syncNarrow);
  applyDate();
  loadHighlight();
});

onBeforeUnmount(() => {
  mq?.removeEventListener('change', syncNarrow);
});
</script>

<template>
  <div class="timemachine">
    <n-page-header
      title="收藏时光机"
      subtitle="选一天，回看那天收藏了什么、去过哪里 🕰️"
      class="page-header"
    />

    <!-- 日期操作区 -->
    <div class="picker-row">
      <n-button size="small" @click="shiftDay(-1)">← 前一天</n-button>
      <span class="picker-date">{{ date }}</span>
      <n-button size="small" :disabled="isToday" @click="shiftDay(1)">后一天 →</n-button>
      <n-button v-if="!isToday" size="small" tertiary @click="goToday">回到今天</n-button>
    </div>

    <n-grid cols="1 l:2" responsive="screen" x-gap="16" y-gap="16" class="cards-row">
      <!-- 左：日历（有收藏/访问的日期打点标记） -->
      <n-grid-item>
        <n-card class="panel-card calendar-panel">
          <template #header>
            <span class="panel-title">📅 日历</span>
          </template>
          <n-calendar v-model:value="dateValue" @update:value="applyDate">
            <template #default="{ year, month, date }">
              <span class="calendar-dots">
                <span v-if="highlightMap[dayKey(year, month, date)]?.collected" class="dot dot-collect" />
                <span v-if="highlightMap[dayKey(year, month, date)]?.visited" class="dot dot-visit" />
              </span>
            </template>
          </n-calendar>
          <div class="legend">
            <span class="legend-item"><span class="dot dot-collect" />有收藏</span>
            <span class="legend-item"><span class="dot dot-visit" />有访问</span>
          </div>
        </n-card>
      </n-grid-item>

      <!-- 右：当天收藏 + 当天访问 -->
      <n-grid-item>
        <div class="right-panels">
          <n-card class="panel-card" :loading="loading">
            <template #header>
              <span class="panel-title">🗂️ 当天收藏（{{ collected.length }}）</span>
            </template>
            <ul v-if="collected.length" class="item-list">
              <li
                v-for="item in collectedPageItems"
                :key="item.id"
                class="item-row"
                title="点击打开"
                @click="openUrl(item.url)"
              >
                <FaviconImage
                  v-if="!prefsStore.noImage"
                  :url="item.url"
                  :domain="item.domain"
                  :favicon-path="item.favicon_path"
                  :avatar-text="item.avatar_text"
                  :avatar-color="item.avatar_color"
                  :size="24"
                  :radius="7"
                />
                <div class="item-info">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-sub">{{ item.category_name }} · {{ fmtTime(item.created_at) }}</div>
                </div>
                <span class="item-tag tag-collect">收藏</span>
              </li>
            </ul>
            <n-pagination
              v-if="collected.length > PAGE_SIZE"
              v-model:page="collectedPage"
              :item-count="collected.length"
              :page-size="PAGE_SIZE"
              :simple="isNarrow"
              class="pager"
            />
            <n-empty v-if="!collected.length" description="这一天没有收藏新书签" class="card-empty" />
          </n-card>

          <n-card class="panel-card" :loading="loading">
            <template #header>
              <span class="panel-title">🕐 当天访问（{{ visited.length }}）</span>
            </template>
            <ul v-if="visited.length" class="item-list">
              <li
                v-for="item in visitedPageItems"
                :key="item.link_id"
                class="item-row"
                title="点击打开"
                @click="openUrl(item.url)"
              >
                <span class="visit-time">{{ item.time }}</span>
                <FaviconImage
                  v-if="!prefsStore.noImage"
                  :url="item.url"
                  :domain="item.domain"
                  :favicon-path="item.favicon_path"
                  :avatar-text="item.avatar_text"
                  :avatar-color="item.avatar_color"
                  :size="24"
                  :radius="7"
                />
                <div class="item-info">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-sub">{{ item.category_name }}</div>
                </div>
                <span v-if="item.count > 1" class="item-tag tag-visit">×{{ item.count }}</span>
              </li>
            </ul>
            <n-pagination
              v-if="visited.length > PAGE_SIZE"
              v-model:page="visitedPage"
              :item-count="visited.length"
              :page-size="PAGE_SIZE"
              :simple="isNarrow"
              class="pager"
            />
            <n-empty v-if="!visited.length" description="这一天没有访问记录" class="card-empty" />
          </n-card>
        </div>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}

:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(20px, 4vw, 28px);
}

/* 日期操作区 */
.picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
/* 日历面板：覆盖 naive-ui 默认 720px 高，压缩板块尺寸 */
.calendar-panel {
  height: 100%;
}
.calendar-panel :deep(.n-calendar) {
  height: 340px;
}
.calendar-panel :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.calendar-panel :deep(.n-calendar-header) {
  padding-bottom: 10px;
}
.calendar-panel :deep(.n-calendar-cell) {
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.calendar-panel :deep(.n-calendar-date) {
  font-size: 13px;
  padding-bottom: .35em;
}
.calendar-panel :deep(.n-calendar-date__date) {
  width: 1.5em;
  height: 1.5em;
}
/* 日历面板：圆点标记 + 图例 */
.calendar-dots {
  display: flex;
  gap: 3px;
  justify-content: center;
  margin-top: 5px;
  height: 5px;
}
.dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
/* 有收藏 = 绿色，有访问 = 橙色 */
.dot-collect {
  background: #18a058;
}
.dot-visit {
  background: #e6a23c;
}
.legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 12px;
  font-size: 12px;
  color: var(--admin-muted);
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* 右侧：当天收藏 + 当天访问 纵向排列，两个卡片等高 */
.right-panels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.right-panels .panel-card {
  flex: 1;
}
/* 当前选中日期标签 */
.picker-date {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-accent);
  background: rgba(74, 90, 138, .1);
  padding: 3px 12px;
  border-radius: 8px;
  line-height: 1.4;
}

/* 移动端：整体更紧凑 */
@media (max-width: 768px) {
  .calendar-panel :deep(.n-calendar) {
    height: 280px;
  }
  .calendar-panel :deep(.n-calendar-cell) {
    padding: 5px 3px;
  }
  .calendar-panel :deep(.n-calendar-date) {
    font-size: 12px;
  }
  .calendar-panel :deep(.n-calendar-date__date) {
    width: 1.5em;
    height: 1.5em;
  }
  .picker-row {
    gap: 8px;
  }
  .legend {
    margin-top: 8px;
    font-size: 11px;
  }
  .dot {
    width: 4px;
    height: 4px;
  }
  .item-row {
    gap: 8px;
    padding: 6px 2px;
  }
  .item-name {
    font-size: 13px;
  }
  .visit-time {
    width: 40px;
    font-size: 14px;
  }
}

/* 面板 */
.panel-card {
  border-radius: 18px !important;
  min-height: 320px;
}
.cards-row {
  margin-top: 16px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.12));
  cursor: pointer;
  border-radius: 8px;
  transition: background .15s;
}
.item-row:last-child {
  border-bottom: none;
}
.item-row:hover {
  background: rgba(120, 100, 90, .06);
}
.visit-time {
  flex-shrink: 0;
  font-family: 'Caveat', var(--app-font, cursive);
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-accent);
  width: 46px;
  text-align: right;
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text, #4A3A33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-sub {
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
}
.tag-collect {
  background: rgba(24, 160, 88, .12);
  color: #18a058;
}
.tag-visit {
  background: rgba(230, 162, 60, .18);
  color: #e6a23c;
  font-weight: 600;
}
/* 分页器：居中，与列表留出间距 */
.pager {
  justify-content: center;
  margin-top: 16px;
}
.card-empty {
  padding: 60px 0;
}
</style>
