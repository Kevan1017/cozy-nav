<script setup>
/**
 * 设置页 - 链接巡检卡片
 * - 8 个可配置项：启停 / 间隔 / 批条数 / 判死阈值 / 死链重检 / TLS 黄红预警 / 冷链接天数
 * - 保存即写入 preferences.health_config（后端校验范围，即时生效）
 * - 立即巡检：复用批量检测接口 + 轮询进度
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { NCard, NSwitch, NSelect, NInputNumber, NButton, NProgress, useMessage } from 'naive-ui';
import { prefsApi } from '../../../api/prefs.js';
import { linkApi } from '../../../api/link.js';

const message = useMessage();

/** 巡检配置默认值（与后端 preferences.health_config 保持一致） */
const DEFAULT_HEALTH_CONFIG = {
  enabled: true,
  intervalHours: 24,
  batchSize: 50,
  deadStreak: 3,
  recheckDead: false,
  tlsYellowDays: 30,
  tlsRedDays: 7,
  coldDays: 90,
};

const form = ref({ ...DEFAULT_HEALTH_CONFIG });
const loaded = ref(false);
const saving = ref(false);

/** 巡检间隔选项 */
const intervalOptions = [
  { label: '每 24 小时（推荐）', value: 24 },
  { label: '每 48 小时', value: 48 },
  { label: '每 72 小时', value: 72 },
  { label: '每周（168 小时）', value: 168 },
];

/** 加载当前配置 */
async function fetchConfig() {
  try {
    const res = await prefsApi.get();
    form.value = { ...DEFAULT_HEALTH_CONFIG, ...(res.data.health_config || {}) };
    // 旧版间隔（2/6/12）不在新选项内，统一规范化为默认 24 小时，避免下拉空白与后端校验失败
    if (![24, 48, 72, 168].includes(form.value.intervalHours)) form.value.intervalHours = 24;
    loaded.value = true;
  } catch { /* 未登录等场景静默 */ }
}

/** 保存配置（后端会做字段范围校验） */
async function handleSave() {
  saving.value = true;
  try {
    await prefsApi.update({ health_config: { ...form.value } });
    message.success('巡检配置已保存，改动即时生效');
  } catch (e) {
    message.warning(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

/* ---------- 立即巡检（复用批量检测接口 + 轮询进度） ---------- */
const patrolBusy = ref(false);
const patrolProgress = ref(null); // { running, total, done, ok, blocked, fail, skip }
let patrolTimer = null;

/** 每 1.5s 轮询一次进度，结束后提示结果并复位 */
function startPolling() {
  if (patrolTimer) return;
  patrolTimer = setInterval(async () => {
    try {
      const p = await linkApi.checkProgress();
      patrolProgress.value = p.data;
      if (!p.data.running) {
        clearInterval(patrolTimer);
        patrolTimer = null;
        patrolBusy.value = false;
        message.success(`巡检完成：正常 ${p.data.ok} · 需代理 ${p.data.blocked} · 打不开 ${p.data.fail} · 跳过 ${p.data.skip}`);
      }
    } catch {
      clearInterval(patrolTimer);
      patrolTimer = null;
      patrolBusy.value = false;
    }
  }, 1500);
}

/** 页面挂载时恢复进行中的巡检进度（刷新后进度条不消失） */
async function fetchPatrolStatus() {
  try {
    const p = await linkApi.checkProgress();
    if (p.data?.running) {
      patrolBusy.value = true;
      patrolProgress.value = p.data;
      startPolling();
    }
  } catch { /* 未登录等场景静默 */ }
}

async function handlePatrolNow() {
  if (patrolBusy.value) return;
  patrolBusy.value = true;
  patrolProgress.value = null;
  try {
    const res = await linkApi.checkAll();
    patrolProgress.value = { running: true, total: res.data.total, done: 0, ok: 0, blocked: 0, fail: 0, skip: 0 };
    message.success(`巡检已启动，共 ${res.data.total} 条`);
    startPolling();
  } catch (e) {
    patrolBusy.value = false;
    message.warning(e?.message || '巡检启动失败');
  }
}

/** 巡检进度百分比 */
const patrolPercent = computed(() => {
  const t = patrolProgress.value?.total;
  const d = patrolProgress.value?.done;
  if (!t) return 0;
  return Math.round((d / t) * 100);
});

onMounted(() => {
  fetchConfig();
  fetchPatrolStatus();
});
onUnmounted(() => { if (patrolTimer) clearInterval(patrolTimer); });
</script>

<template>
  <n-card class="setting-card" title="🩺 链接巡检" hoverable>
    <p class="hint">
      定时自动检测书签可用性：连续失败达到阈值自动标记死链，HTTPS 证书到期自动预警。修改后立即生效，无需重启。
    </p>

    <!-- 第一组：调度与判死（4 项） -->
    <p class="cfg-group-title">调度与判死</p>
    <div class="cfg-grid">
      <div class="cfg-item">
        <span class="cfg-label">巡检开关</span>
        <n-switch v-model:value="form.enabled" class="cfg-switch" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">巡检间隔</span>
        <n-select v-model:value="form.intervalHours" :options="intervalOptions" size="small" class="cfg-control" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">每轮检测条数</span>
        <n-input-number v-model:value="form.batchSize" :min="20" :max="500" size="small" class="cfg-control" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">连续失败判死（次）</span>
        <n-input-number v-model:value="form.deadStreak" :min="2" :max="10" size="small" class="cfg-control" />
      </div>
    </div>

    <!-- 第二组：策略与预警（4 项） -->
    <p class="cfg-group-title">策略与预警</p>
    <div class="cfg-grid">
      <div class="cfg-item">
        <span class="cfg-label">死链重新纳入巡检</span>
        <n-switch v-model:value="form.recheckDead" class="cfg-switch" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">TLS 黄色预警（天）</span>
        <n-input-number v-model:value="form.tlsYellowDays" :min="7" :max="90" size="small" class="cfg-control" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">TLS 红色预警（天）</span>
        <n-input-number v-model:value="form.tlsRedDays" :min="1" :max="30" size="small" class="cfg-control" />
      </div>
      <div class="cfg-item">
        <span class="cfg-label">冷链接判定（天）</span>
        <n-input-number v-model:value="form.coldDays" :min="30" :max="365" size="small" class="cfg-control" />
      </div>
    </div>

    <div class="cfg-actions">
      <n-button type="primary" :loading="saving" @click="handleSave">保存配置</n-button>
      <n-button secondary :loading="patrolBusy" @click="handlePatrolNow">立即巡检</n-button>
    </div>

    <!-- 巡检进度 -->
    <div v-if="patrolProgress && patrolProgress.running" class="patrol-progress">
      <n-progress type="line" :percentage="patrolPercent" :show-indicator="true" processing />
      <p class="hint">
        已检测 {{ patrolProgress.done }}/{{ patrolProgress.total }}
        · 正常 {{ patrolProgress.ok }} · 需代理 {{ patrolProgress.blocked }}
        · 打不开 {{ patrolProgress.fail }} · 跳过 {{ patrolProgress.skip }}
      </p>
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
.hint {
  font-size: 13px;
  color: var(--admin-muted);
  line-height: 1.6;
}

/* 分组小标题：左侧短色条 + 文字 */
.cfg-group-title {
  margin: 18px 0 10px;
  font-size: clamp(13px, 1.8vw, 14px);
  font-weight: 600;
  color: var(--admin-accent);
  display: flex;
  align-items: center;
  gap: 8px;
}
.cfg-group-title::before {
  content: '';
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: var(--admin-accent);
}
.cfg-group-title:first-of-type {
  margin-top: 14px;
}

/* 配置行：文本与控件同一行。每组 4 项 → 断点取 4/2/1 列（跳过 3 列，避免 3+1 孤项） */
.cfg-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(8px, 1.2vw, 12px);
}
.cfg-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: clamp(8px, 1.2vw, 12px) clamp(10px, 1.4vw, 14px);
  border-radius: 12px;
  background: color-mix(in oklab, var(--admin-card) 55%, transparent);
  transition: transform .2s, box-shadow .2s;
}
.cfg-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px -6px rgba(0, 0, 0, .18);
}
.cfg-label {
  flex-shrink: 0;
  width: clamp(90px, 11vw, 112px);
  font-size: clamp(11px, 1.4vw, 13px);
  font-weight: 500;
  color: var(--admin-text);
  text-align: right;
  white-space: nowrap;
}
.cfg-control {
  flex: 1;
  min-width: 0;
}
.cfg-switch {
  flex: none;
  width: auto;
}

.cfg-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.patrol-progress {
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .cfg-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .cfg-grid {
    grid-template-columns: 1fr;
  }
}
</style>
