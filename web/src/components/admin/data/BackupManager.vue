<script setup>
/**
 * 数据管理页 - 自动备份卡片（本地备份 + 增量跳过 + 坚果云 WebDAV 云端备份）
 * - 自动备份开关（每天 03:00 生成一致快照，保留 retainCount 份）
 * - 增量备份：数据无变化（指纹一致）时跳过，不生成重复快照
 * - 坚果云 WebDAV：本地快照自动上传到云端，实现双保险
 * - 立即备份按钮 + 最近备份记录（时间/大小）
 */
import { ref, onMounted } from 'vue';
import { NCard, NSwitch, NInput, NInputNumber, NButton, useMessage, NEmpty } from 'naive-ui';
import { backupApi } from '../../../api/backup.js';

const message = useMessage();

/** 备份配置默认值（与后端 preferences.backup_config 保持一致） */
const DEFAULT_CONFIG = {
  autoEnabled: true,
  retainCount: 5,
  webdav: {
    enabled: false,
    url: 'https://dav.jianguoyun.com/dav/',
    user: '',
    pass: '',
    path: 'cozy-nav-backup',
    retainCount: 3,
  },
};

const form = ref({ ...DEFAULT_CONFIG });
const saving = ref(false);
const running = ref(false);
const testing = ref(false);
const backups = ref([]);
const loadingList = ref(false);

/** 格式化文件大小（B/KB/MB） */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/** 加载配置 + 备份记录 */
async function fetchConfig() {
  try {
    const res = await backupApi.getConfig();
    const cfg = res.data || {};
    form.value = {
      ...DEFAULT_CONFIG,
      ...cfg,
      webdav: { ...DEFAULT_CONFIG.webdav, ...(cfg.webdav || {}) },
    };
  } catch { /* 未登录等场景静默 */ }
}

async function fetchList() {
  loadingList.value = true;
  try {
    const res = await backupApi.list();
    backups.value = res.data || [];
  } catch { /* 静默 */ } finally {
    loadingList.value = false;
  }
}

onMounted(() => {
  fetchConfig();
  fetchList();
});

/** 保存配置（webdav.pass 留空则后端保留原密码） */
async function handleSave() {
  saving.value = true;
  try {
    await backupApi.saveConfig({
      autoEnabled: form.value.autoEnabled,
      retainCount: form.value.retainCount,
      webdav: { ...form.value.webdav },
    });
    message.success('备份配置已保存');
  } catch (e) {
    message.warning(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

/** 立即备份（增量判断：数据无变化则提示跳过；启用 WebDAV 同步上传云端） */
async function handleRun() {
  running.value = true;
  try {
    const res = await backupApi.runNow();
    message.success(res?.message || '备份完成');
    await fetchList();
  } catch (e) {
    message.warning(e?.message || '备份失败');
  } finally {
    running.value = false;
  }
}

/** 测试坚果云 WebDAV 连接（实时测试，不保存） */
async function handleTest() {
  if (!form.value.webdav.url.trim() || !form.value.webdav.user.trim() || !form.value.webdav.pass.trim()) {
    message.warning('请先填写 WebDAV 地址、坚果云账号和应用密码');
    return;
  }
  testing.value = true;
  try {
    const res = await backupApi.testWebdav({ ...form.value.webdav });
    message.success(res?.message || '坚果云连接成功');
  } catch (e) {
    message.warning(e?.message || '连接失败');
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <n-card class="setting-card" title="🛡️ 自动备份" hoverable>
    <p class="hint">
      每天 03:00 自动生成数据快照（数据库 + 图标 + 站点 Logo），最多保留 {{ form.retainCount }} 份，超出自动删除最旧的。
      <br />增量备份：数据无变化时自动跳过，不生成重复快照（更省磁盘、记录更清晰）。
    </p>

    <!-- 自动备份 -->
    <div class="notify-row">
      <span class="notify-label">自动备份</span>
      <n-switch v-model:value="form.autoEnabled" />
      <span class="notify-state">{{ form.autoEnabled ? '每天 03:00 执行' : '已关闭' }}</span>
    </div>

    <div class="notify-row">
      <span class="notify-label">保留份数</span>
      <n-input-number v-model:value="form.retainCount" :min="1" :max="30" class="notify-control" />
      <span class="notify-state">份（超出删最旧）</span>
    </div>

    <!-- 坚果云 WebDAV 云端备份子模块 -->
    <div class="channel-block">
      <div class="channel-head">
        <span class="channel-title">☁️ 坚果云 WebDAV 备份</span>
        <n-switch v-model:value="form.webdav.enabled" size="small" />
      </div>
      <p class="hint channel-hint">
        云端只上传数据库 + 站点 Logo（favicons 图标为可再生缓存，不上传，省流量）。
        注意：坚果云免费版每月上下行合计 1GB 流量。
      </p>
      <div class="notify-row">
        <span class="notify-label">WebDAV 地址</span>
        <n-input
          v-model:value="form.webdav.url"
          placeholder="https://dav.jianguoyun.com/dav/"
          class="notify-control"
          clearable
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">坚果云账号</span>
        <n-input v-model:value="form.webdav.user" placeholder="登录邮箱（如 xxx@qq.com）" class="notify-control" clearable />
      </div>
      <div class="notify-row">
        <span class="notify-label">应用密码</span>
        <n-input
          v-model:value="form.webdav.pass"
          type="password"
          show-password-on="click"
          placeholder="不修改请留空"
          class="notify-control"
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">远程目录</span>
        <n-input v-model:value="form.webdav.path" placeholder="cozy-nav-backup（自动创建）" class="notify-control" clearable />
      </div>
      <div class="notify-row">
        <span class="notify-label">云端保留</span>
        <n-input-number v-model:value="form.webdav.retainCount" :min="1" :max="30" class="notify-control" />
        <span class="notify-state">份（超出删最旧）</span>
      </div>
      <p class="hint channel-hint">
        应用密码获取：登录坚果云网页端 → 右上角头像 → 账户信息 → 安全选项 → 应用密码 → 添加（授权访问 WebDAV）。
      </p>
      <div class="cfg-actions">
        <n-button size="small" :loading="testing" @click="handleTest">🧪 测试连接</n-button>
      </div>
    </div>

    <div class="cfg-actions">
      <n-button type="primary" :loading="running" @click="handleRun">▶️ 立即备份</n-button>
      <n-button :loading="saving" @click="handleSave">保存配置</n-button>
    </div>

    <!-- 最近备份记录 -->
    <p class="cfg-group-title">最近备份记录</p>
    <div v-if="loadingList" class="list-hint">加载中…</div>
    <div v-else-if="!backups.length" class="list-hint">
      <n-empty description="暂无备份记录，点击「立即备份」生成第一份快照" size="small" />
    </div>
    <div v-else class="bk-list">
      <div v-for="bk in backups" :key="bk.name" class="bk-item">
        <span class="bk-name">🕐 {{ bk.time }}</span>
        <span class="bk-size">{{ formatSize(bk.size) }}</span>
      </div>
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
.hint code {
  background: color-mix(in oklab, var(--admin-card) 60%, transparent);
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 12px;
}

/* 配置行：文本与控件同一行 */
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

/* WebDAV 云端备份子模块 */
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
.channel-block .cfg-actions {
  margin-top: 12px;
}

.cfg-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}

/* 分组小标题 */
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

/* 备份记录列表 */
.list-hint {
  font-size: 13px;
  color: var(--admin-muted);
  padding: 12px 0;
}
.bk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bk-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--admin-card) 55%, transparent);
  font-size: clamp(11px, 1.4vw, 13px);
}
.bk-name {
  flex: 1;
  min-width: 0;
  color: var(--admin-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bk-size {
  flex-shrink: 0;
  color: var(--admin-muted);
  font-variant-numeric: tabular-nums;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .bk-item {
    flex-wrap: wrap;
  }
  .bk-name {
    flex-basis: 100%;
  }
  .cfg-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
