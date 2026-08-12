<script setup>
/**
 * 通知中心 - 推送事件卡片（events："什么时候发、发什么"，可扩展）
 * - 巡检结果：策略（仅异常/总是）+ 异常阈值 + 消息模板
 * - 本地备份结果：成功/失败开关 + 消息模板
 * 未来新增事件：后端加默认配置 + 渲染器，前端此处加一个事件区块即可。
 * 配置通过 v-model:events 与父级同步，点保存整包提交。
 */
import { ref, watch } from 'vue';
import { NCard, NSwitch, NInput, NSelect, NInputNumber, NButton } from 'naive-ui';

const props = defineProps({
  events: { type: Object, required: true },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:events', 'save']);

/** 事件默认值（与后端 preferences.notification_config 保持一致） */
const EVENT_DEFAULTS = {
  patrol: {
    enabled: true,
    strategy: 'abnormal',   // abnormal=仅异常推送 | always=总是推送
    minIssues: 1,           // 异常数达到多少才推送
    titleTemplate: '🩺 巡检发现 {issues} 条异常',
    bodyTemplate: '正常 {ok} · 需代理 {blocked} · 打不开 {fail} · 跳过 {skip}\n\n检测时间：{time}',
  },
  backup: {
    enabled: false,
    onSuccess: true,        // 备份成功时推送
    onFailure: true,        // 备份失败时推送
    titleTemplate: '🛡️ 数据备份{result}',
    bodyTemplate: '文件：{file}\n大小：{size}\n{reason}时间：{time}',
  },
};

/** 各事件模板占位符说明（与后端 EVENT_PLACEHOLDERS 对应） */
const PLACEHOLDERS = {
  patrol: [
    { key: '{total}', desc: '本轮检测总数' },
    { key: '{ok}', desc: '正常数' },
    { key: '{blocked}', desc: '需代理数' },
    { key: '{fail}', desc: '打不开数（含死链）' },
    { key: '{skip}', desc: '跳过数' },
    { key: '{issues}', desc: '异常数（同 fail）' },
    { key: '{time}', desc: '推送时间' },
  ],
  backup: [
    { key: '{result}', desc: '备份结果（成功/失败）' },
    { key: '{file}', desc: '快照文件名' },
    { key: '{size}', desc: '快照大小' },
    { key: '{reason}', desc: '失败原因（成功时为空）' },
    { key: '{time}', desc: '推送时间' },
  ],
};

/** 推送时机选项 */
const strategyOptions = [
  { label: '仅异常时推送（推荐）', value: 'abnormal' },
  { label: '每轮巡检都推送', value: 'always' },
];

/** 本地配置（兜底默认值，避免字段缺失导致绑定报错） */
function fillDefaults(src) {
  return {
    patrol: { ...EVENT_DEFAULTS.patrol, ...(src?.patrol || {}) },
    backup: { ...EVENT_DEFAULTS.backup, ...(src?.backup || {}) },
  };
}

const local = ref(fillDefaults(props.events));

// 父级加载完成后把最新配置同步进来
watch(
  () => props.events,
  (v) => { local.value = fillDefaults(v); },
  { deep: true }
);

/** 用户修改任一字段：同步给父级，保证保存时拿到最新值 */
function sync() {
  emit('update:events', {
    patrol: { ...local.value.patrol },
    backup: { ...local.value.backup },
  });
}
</script>

<template>
  <n-card class="setting-card" title="🎯 推送事件" hoverable>
    <p class="hint">
      事件决定了「什么时候发、发什么」。每个事件可单独开关、设置触发条件与消息模板；实际发送还依赖上方渠道已启用且配置完整。
      未来新增推送（如安全告警、统计周报）只需在此追加一个事件区块。
    </p>

    <!-- 事件一：巡检结果 -->
    <div class="event-block">
      <div class="channel-head">
        <span class="channel-title">🩺 巡检结果</span>
        <n-switch v-model:value="local.patrol.enabled" size="small" @update:value="sync" />
      </div>
      <template v-if="local.patrol.enabled">
        <div class="notify-row">
          <span class="notify-label">推送时机</span>
          <n-select
            v-model:value="local.patrol.strategy"
            :options="strategyOptions"
            class="notify-control"
            @update:value="sync"
          />
        </div>
        <div class="notify-row" v-if="local.patrol.strategy === 'abnormal'">
          <span class="notify-label">异常数阈值</span>
          <n-input-number
            v-model:value="local.patrol.minIssues"
            :min="1"
            :max="100"
            class="notify-control"
            @update:value="sync"
          />
          <span class="notify-state">条以上才推送</span>
        </div>
        <div class="notify-row">
          <span class="notify-label">消息标题</span>
          <n-input
            v-model:value="local.patrol.titleTemplate"
            placeholder="🩺 巡检发现 {issues} 条异常"
            class="notify-control"
            maxlength="200"
            @update:value="sync"
          />
        </div>
        <div class="notify-row">
          <span class="notify-label">消息正文</span>
          <n-input
            v-model:value="local.patrol.bodyTemplate"
            type="textarea"
            :rows="3"
            placeholder="正常 {ok} · 需代理 {blocked} · 打不开 {fail} · 跳过 {skip}&#10;&#10;检测时间：{time}"
            class="notify-control"
            maxlength="1000"
            show-count
            @update:value="sync"
          />
        </div>
        <div class="ph-list">
          <span v-for="p in PLACEHOLDERS.patrol" :key="p.key" class="ph-tag">{{ p.key }} {{ p.desc }}</span>
        </div>
      </template>
    </div>

    <!-- 事件二：本地备份结果 -->
    <div class="event-block">
      <div class="channel-head">
        <span class="channel-title">🛡️ 本地备份结果</span>
        <n-switch v-model:value="local.backup.enabled" size="small" @update:value="sync" />
      </div>
      <template v-if="local.backup.enabled">
        <div class="notify-row">
          <span class="notify-label">成功时推送</span>
          <n-switch v-model:value="local.backup.onSuccess" size="small" @update:value="sync" />
          <span class="notify-state">{{ local.backup.onSuccess ? '开启' : '关闭' }}</span>
        </div>
        <div class="notify-row">
          <span class="notify-label">失败时推送</span>
          <n-switch v-model:value="local.backup.onFailure" size="small" @update:value="sync" />
          <span class="notify-state">{{ local.backup.onFailure ? '开启' : '关闭' }}</span>
        </div>
        <div class="notify-row">
          <span class="notify-label">消息标题</span>
          <n-input
            v-model:value="local.backup.titleTemplate"
            placeholder="🛡️ 数据备份{result}"
            class="notify-control"
            maxlength="200"
            @update:value="sync"
          />
        </div>
        <div class="notify-row">
          <span class="notify-label">消息正文</span>
          <n-input
            v-model:value="local.backup.bodyTemplate"
            type="textarea"
            :rows="3"
            placeholder="文件：{file}&#10;大小：{size}&#10;{reason}时间：{time}"
            class="notify-control"
            maxlength="1000"
            show-count
            @update:value="sync"
          />
        </div>
        <div class="ph-list">
          <span v-for="p in PLACEHOLDERS.backup" :key="p.key" class="ph-tag">{{ p.key }} {{ p.desc }}</span>
        </div>
      </template>
    </div>

    <div class="cfg-actions">
      <n-button type="primary" :loading="saving" @click="emit('save')">保存配置</n-button>
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

/* 配置行：文本与控件同一行，控件撑满剩余空间 */
.notify-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: clamp(8px, 1.2vw, 12px) clamp(10px, 1.4vw, 14px);
  border-radius: 12px;
  background: color-mix(in oklab, var(--admin-card) 55%, transparent);
}
.notify-label {
  flex-shrink: 0;
  width: clamp(76px, 9vw, 96px);
  font-size: clamp(11px, 1.4vw, 13px);
  font-weight: 500;
  color: var(--admin-text);
  text-align: right;
  white-space: nowrap;
}
.notify-control {
  flex: 1;
  min-width: 0;
}
.notify-state {
  font-size: 12px;
  color: var(--admin-accent);
  font-weight: 600;
}

/* 事件子模块：独立分区 */
.event-block {
  margin-top: 16px;
  padding: clamp(10px, 1.4vw, 14px);
  border-radius: 14px;
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.12));
  background: color-mix(in oklab, var(--admin-card) 40%, transparent);
}
.event-block .notify-row {
  margin-top: 10px;
  background: color-mix(in oklab, var(--admin-card) 45%, transparent);
}
.channel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.channel-title {
  font-size: clamp(13px, 1.6vw, 14px);
  font-weight: 600;
  color: var(--admin-text);
}

.cfg-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}

/* 模板占位符说明标签 */
.ph-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.ph-tag {
  font-size: 11px;
  color: var(--admin-muted);
  background: color-mix(in oklab, var(--admin-card) 50%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.12));
  border-radius: 8px;
  padding: 2px 6px;
}
</style>
