<script setup>
/**
 * 通知中心 - 推送渠道卡片（channels："怎么发"，全局一份）
 * - Server酱：微信推送（SendKey）
 * - QQ 邮箱：SMTP 邮件（发件/授权码/服务器/收件）
 * 任一渠道配置完整且开启后即可接收事件通知，可同时启用双保险。
 * 配置通过 v-model:channels 与父级同步，点保存整包提交。
 */
import { ref, watch } from 'vue';
import { NCard, NSwitch, NInput, NButton, NSelect, useMessage } from 'naive-ui';
import { prefsApi } from '../../../api/prefs.js';

const props = defineProps({
  channels: { type: Object, required: true },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:channels', 'save']);

const message = useMessage();

/** 渠道默认值（与后端 preferences.notification_config 保持一致） */
const CHANNEL_DEFAULTS = {
  serverchan: { enabled: false, sendKey: '' },
  email: { enabled: false, host: 'smtp.qq.com', port: 465, user: '', pass: '', to: '' },
};

/** SMTP 端口选项 */
const portOptions = [
  { label: '465（SSL，推荐）', value: 465 },
  { label: '587（STARTTLS）', value: 587 },
];

/** 本地配置（兜底默认值，避免字段缺失导致绑定报错） */
function fillDefaults(src) {
  return {
    serverchan: { ...CHANNEL_DEFAULTS.serverchan, ...(src?.serverchan || {}) },
    email: { ...CHANNEL_DEFAULTS.email, ...(src?.email || {}) },
  };
}

const local = ref(fillDefaults(props.channels));

// 父级加载完成后把最新配置同步进来（仅在父级替换对象时触发，用户输入时内容一致，不会反复同步）
watch(
  () => props.channels,
  (v) => { local.value = fillDefaults(v); },
  { deep: true }
);

/** 用户修改任一字段：同步给父级，保证保存时拿到最新值 */
function sync() {
  emit('update:channels', {
    serverchan: { ...local.value.serverchan },
    email: { ...local.value.email },
  });
}

const testingSc = ref(false);
const testingEm = ref(false);

/** 测试 Server酱（用当前填写的 SendKey，无需先保存） */
async function handleTestSc() {
  if (!local.value.serverchan.sendKey.trim()) {
    message.warning('请先填写 Server酱 SendKey');
    return;
  }
  testingSc.value = true;
  try {
    const res = await prefsApi.sendTestNotify({ channel: 'serverchan', sendKey: local.value.serverchan.sendKey.trim() });
    message.success(res?.message || '测试消息已发送，请查看微信');
  } catch (e) {
    message.warning(e?.message || '发送失败，请检查 SendKey 是否正确');
  } finally {
    testingSc.value = false;
  }
}

/** 测试 QQ 邮箱（用当前填写的配置，无需先保存） */
async function handleTestEm() {
  const em = local.value.email;
  if (!em.user.trim() || !em.pass.trim() || !em.to.trim()) {
    message.warning('请先完整填写邮箱配置（发件邮箱/授权码/收件邮箱）');
    return;
  }
  testingEm.value = true;
  try {
    const res = await prefsApi.sendTestNotify({ channel: 'email', config: { ...em } });
    message.success(res?.message || '测试邮件已发送，请查收邮箱');
  } catch (e) {
    message.warning(e?.message || '发送失败，请检查邮箱配置');
  } finally {
    testingEm.value = false;
  }
}
</script>

<template>
  <n-card class="setting-card" title="📮 推送渠道" hoverable>
    <p class="hint">
      渠道决定了通知「发到哪」。配置一次，所有事件（巡检、备份…）共用。可同时启用微信与邮箱双保险，任一渠道失败不影响其他渠道与业务主流程。
    </p>

    <!-- Server酱 子模块 -->
    <div class="channel-block">
      <div class="channel-head">
        <span class="channel-title">📱 Server酱（微信推送）</span>
        <n-switch v-model:value="local.serverchan.enabled" size="small" @update:value="sync" />
      </div>
      <div class="notify-row">
        <span class="notify-label">SendKey</span>
        <n-input
          v-model:value="local.serverchan.sendKey"
          type="password"
          show-password-on="click"
          placeholder="在 sct.ftqq.com 用微信扫码注册获取"
          class="notify-control"
          clearable
          @update:value="sync"
        />
        <n-button size="small" secondary :loading="testingSc" @click="handleTestSc">测试</n-button>
      </div>
      <p class="hint channel-hint">
        打开 <a href="https://sct.ftqq.com" target="_blank" rel="noopener">sct.ftqq.com</a> 微信扫码即可获取 SendKey。免费版每天限 5 条。
      </p>
    </div>

    <!-- QQ 邮箱子模块 -->
    <div class="channel-block">
      <div class="channel-head">
        <span class="channel-title">📧 QQ 邮箱（SMTP）</span>
        <n-switch v-model:value="local.email.enabled" size="small" @update:value="sync" />
      </div>
      <div class="notify-row">
        <span class="notify-label">发件邮箱</span>
        <n-input
          v-model:value="local.email.user"
          placeholder="如 123456@qq.com"
          class="notify-control"
          clearable
          @update:value="sync"
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">授权码</span>
        <n-input
          v-model:value="local.email.pass"
          type="password"
          show-password-on="click"
          placeholder="QQ 邮箱设置里开启 SMTP 服务生成的授权码"
          class="notify-control"
          clearable
          @update:value="sync"
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">SMTP 服务器</span>
        <n-input
          v-model:value="local.email.host"
          placeholder="smtp.qq.com"
          class="notify-control"
          @update:value="sync"
        />
        <n-select
          v-model:value="local.email.port"
          :options="portOptions"
          class="port-select"
          @update:value="sync"
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">收件邮箱</span>
        <n-input
          v-model:value="local.email.to"
          placeholder="接收通知的邮箱，多个用英文逗号分隔"
          class="notify-control"
          clearable
          @update:value="sync"
        />
        <n-button size="small" secondary :loading="testingEm" @click="handleTestEm">测试</n-button>
      </div>
      <p class="hint channel-hint">
        💡 授权码获取：QQ 邮箱 → 设置 → 账号 → 开启「IMAP/SMTP 服务」，按提示短信验证后生成 16 位授权码（不是邮箱密码）。
      </p>
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
.hint a {
  color: var(--admin-accent);
  text-decoration: none;
}
.hint a:hover {
  text-decoration: underline;
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
.port-select {
  width: 150px;
  flex: none;
}

/* 渠道子模块：独立分区 */
.channel-block {
  margin-top: 16px;
  padding: clamp(10px, 1.4vw, 14px);
  border-radius: 14px;
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.12));
  background: color-mix(in oklab, var(--admin-card) 40%, transparent);
}
.channel-block .notify-row {
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
.channel-hint {
  margin-top: 8px;
  font-size: 12px;
}

.cfg-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}
</style>
