<script setup>
/**
 * 后台 - 通知中心（独立菜单页，从链接巡检抽离）
 * - 推送渠道（channels）：Server酱 / QQ 邮箱 —— "怎么发"，全局一份
 * - 推送事件（events）：巡检结果 / Git 备份结果 —— "什么时候发、发什么"，可扩展
 * 页面持有完整配置，任一卡片点保存都整包提交，避免互相覆盖
 */
import { ref, onMounted } from 'vue';
import { NPageHeader, useMessage } from 'naive-ui';
import { prefsApi } from '../../api/prefs.js';
import NotifyChannels from '../../components/admin/notify/NotifyChannels.vue';
import NotifyEvents from '../../components/admin/notify/NotifyEvents.vue';

const message = useMessage();

/** 通知配置默认值（与后端 preferences.notification_config 保持一致） */
const DEFAULT_FORM = {
  channels: {
    serverchan: { enabled: false, sendKey: '' },
    email: { enabled: false, host: 'smtp.qq.com', port: 465, user: '', pass: '', to: '' },
  },
  events: {},
};

const form = ref({ ...DEFAULT_FORM });
const saving = ref(false);

/** 加载当前通知配置（走管理员专用接口，公开的偏好接口已不返回该敏感字段） */
async function load() {
  try {
    const res = await prefsApi.getNotifyConfig();
    const cfg = res.data?.notification_config || {};
    form.value = {
      channels: {
        serverchan: { ...DEFAULT_FORM.channels.serverchan, ...(cfg.channels?.serverchan || {}) },
        email: { ...DEFAULT_FORM.channels.email, ...(cfg.channels?.email || {}) },
      },
      events: {
        patrol: { ...(cfg.events?.patrol || {}) },
        gitBackup: { ...(cfg.events?.gitBackup || {}) },
      },
    };
  } catch { /* 未登录等场景静默 */ }
}

/** 保存通知配置（渠道 + 事件整包提交，后端校验 + 默认值兜底） */
async function saveAll() {
  saving.value = true;
  try {
    await prefsApi.update({
      notification_config: { channels: form.value.channels, events: form.value.events },
    });
    message.success('通知配置已保存');
  } catch (e) {
    message.warning(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <n-page-header
      title="通知中心"
      subtitle="先配置推送渠道，再按事件决定推什么——巡检、备份等结果自动发到微信 / 邮箱 🔔"
      class="page-header"
    />

    <NotifyChannels v-model:channels="form.channels" :saving="saving" @save="saveAll" />
    <NotifyEvents v-model:events="form.events" :saving="saving" @save="saveAll" />
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
