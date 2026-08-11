<script setup>
/**
 * 数据管理页 - 自动备份卡片（#84 本地备份 + #85 Git 异地备份）
 * - 自动备份开关（每天 03:00 生成一致快照，保留 retainDays 天）
 * - Git 异地备份：本地快照成功后自动推送到私有仓库（建议 Gitee，国内稳定）
 * - 立即备份按钮 + 最近备份记录（时间/大小/Git 推送状态）
 */
import { ref, computed, onMounted } from 'vue';
import { NCard, NSwitch, NInput, NInputNumber, NButton, useMessage, NEmpty } from 'naive-ui';
import { backupApi } from '../../../api/backup.js';

const message = useMessage();

/** 备份配置默认值（与后端 preferences.backup_config 保持一致） */
const DEFAULT_CONFIG = {
  autoEnabled: true,
  retainCount: 5,
  gitEnabled: false,
  gitRemote: '',
  gitBranch: 'main',
};

const form = ref({ ...DEFAULT_CONFIG });
const gitRepoReady = ref(false);
const showSteps = ref(false);
const saving = ref(false);
const running = ref(false);
const backups = ref([]);
const loadingList = ref(false);

/** 服务器真实数据目录（由后端返回，任何部署路径都正确） */
const dataDir = ref('server/data');

/** Git 仓库初始化步骤引导（面向新用户，路径动态取服务器真实目录，命令可一键复制） */
const gitSteps = computed(() => [
  {
    title: '在 Gitee 新建「私有」仓库',
    desc: '登录 gitee.com → 右上角「+」→ 新建仓库 → 仓库名填 cozy-nav-backup → 勾选「私有」→ 创建后复制仓库地址。',
    cmd: '',
  },
  {
    title: '打开终端，进入 data 目录',
    desc: `在服务器上进入项目目录，打开终端并执行（路径已自动生成）：`,
    cmd: `cd ${dataDir.value}`,
  },
  {
    title: '初始化本地仓库',
    desc: '在 data 目录下执行（只需一次）：',
    cmd: 'git init',
  },
  {
    title: '关联远程仓库',
    desc: '把下方地址换成你在 Gitee 复制的地址（只需一次）：',
    cmd: 'git remote add origin https://gitee.com/你的账号/cozy-nav-backup.git',
  },
  {
    title: '创建 .gitignore（排除本地备份）',
    desc: `在 ${dataDir.value} 下新建文件 .gitignore，内容填入：`,
    cmd: 'backups/\nfavicons/.failed/',
  },
  {
    title: '首次提交并推送',
    desc: '首次会弹出浏览器登录 Gitee 窗口，授权后自动记住，以后无需再输密码：',
    cmd: 'git add -A\ngit commit -m "first backup"\ngit push -u origin main',
  },
]);

/** 复制单条命令到剪贴板 */
async function copyCmd(cmd) {
  try {
    await navigator.clipboard.writeText(cmd);
    message.success('命令已复制，粘贴到终端执行即可');
  } catch {
    message.warning('复制失败，请手动选择复制');
  }
}

/** 格式化文件大小（B/KB/MB） */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/** 备份记录 Git 状态文案：未开 Git → 本地；已开 → 按是否实际推送成功显示 */
function gitBadgeText(bk) {
  if (!form.value.gitEnabled) return '本地';
  return bk.hasGit ? '本地 + 已推送 Git' : '本地 + Git 未推送';
}

/** 备份记录 Git 状态样式：on=成功推送 / off=仅本地 / fail=开了 Git 但本次未推送 */
function gitBadgeClass(bk) {
  if (!form.value.gitEnabled) return 'off';
  return bk.hasGit ? 'on' : 'fail';
}

/** 加载配置 + 备份记录 */
async function fetchConfig() {
  try {
    const res = await backupApi.getConfig();
    const cfg = res.data || {};
    form.value = { ...DEFAULT_CONFIG, ...cfg };
    gitRepoReady.value = !!cfg.gitRepoReady;
    if (cfg.dataDir) dataDir.value = cfg.dataDir;
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

/** 保存配置 */
async function handleSave() {
  if (form.value.gitEnabled && !form.value.gitRemote.trim()) {
    message.warning('启用 Git 备份需先填写仓库地址');
    return;
  }
  saving.value = true;
  try {
    const res = await backupApi.saveConfig({ ...form.value });
    gitRepoReady.value = !!res.data?.gitRepoReady;
    message.success('备份配置已保存');
  } catch (e) {
    message.warning(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

/** 立即备份（跟随配置决定是否推 Git） */
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
</script>

<template>
  <n-card class="setting-card" title="🛡️ 自动备份" hoverable>
    <p class="hint">
      每天 03:00 自动生成数据快照（数据库 + 图标 + 站点 Logo），最多保留 {{ form.retainCount }} 份，超出自动删除最旧的。
      开启 Git 异地备份后，快照会自动推送到私有仓库，硬盘损坏也能恢复。
      <br />关闭「Git 备份」开关即停用推送（本地快照照常），已推送到仓库的历史数据保留；更换仓库地址保存后，下次备份自动推送到新仓库。
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

    <!-- Git 异地备份子模块 -->
    <div class="channel-block">
      <div class="channel-head">
        <span class="channel-title">🌐 Git 异地备份</span>
        <n-switch v-model:value="form.gitEnabled" size="small" />
      </div>
      <!-- 开启 Git 后的行为提示：本地备份依然照常（单行横幅） -->
      <div v-if="form.gitEnabled" class="git-on-hint">
        <span class="git-on-icon">✓</span>
        <span class="git-on-text"><strong>本地快照照常保留</strong>（最多 {{ form.retainCount }} 份），同时自动推送远程仓库，本地 + 云端双保险</span>
      </div>
      <div class="notify-row">
        <span class="notify-label">仓库地址</span>
        <n-input
          v-model:value="form.gitRemote"
          placeholder="如 https://gitee.com/你的账号/cozy-nav-backup.git"
          class="notify-control"
          clearable
        />
      </div>
      <div class="notify-row">
        <span class="notify-label">分支名</span>
        <n-input v-model:value="form.gitBranch" placeholder="main" class="notify-control" />
      </div>
      <p class="hint channel-hint">
        建议使用 Gitee（码云）私有仓库，国内服务器推送稳定。凭据走系统 Git（Credential Manager），不会保存在本系统内。
      </p>

      <!-- Git 仓库初始化状态 + 引导步骤 -->
      <div class="git-status" :class="gitRepoReady ? 'ok' : 'warn'">
        <span v-if="gitRepoReady">✅ 本地 git 仓库已就绪，可直接开始备份</span>
        <span v-else>⚠️ 首次使用需先完成下面的仓库初始化（仅需一次）</span>
      </div>

      <div v-if="!gitRepoReady" class="git-steps">
        <div v-for="(step, i) in gitSteps" :key="i" class="git-step">
          <div class="git-step-head">
            <span class="git-step-no">{{ i + 1 }}</span>
            <span class="git-step-title">{{ step.title }}</span>
            <n-button
              v-if="step.cmd"
              size="tiny"
              quaternary
              class="git-copy-btn"
              @click="copyCmd(step.cmd)"
            >
              复制命令
            </n-button>
          </div>
          <p class="git-step-desc">{{ step.desc }}</p>
          <div v-if="step.cmd" class="git-cmd">{{ step.cmd }}</div>
        </div>
        <p class="hint channel-hint">
          ✅ 全部完成后，把上面的仓库地址填入「仓库地址」框 → 打开 Git 开关 → 点「保存配置」即可。
        </p>
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
        <span class="bk-git" :class="gitBadgeClass(bk)">
          {{ gitBadgeText(bk) }}
        </span>
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

/* Git 子模块 */
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
/* 开启 Git 后的行为提示：绿色横幅（单行） */
.git-on-hint {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--admin-peach-dark, #1e7a4a);
  background: color-mix(in oklab, var(--admin-peach, #34b47e) 14%, var(--admin-card));
  border: 1px solid color-mix(in oklab, var(--admin-peach, #34b47e) 45%, transparent);
}
.git-on-icon {
  flex: none;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--admin-peach, #34b47e);
}
.git-on-text {
  font-size: 13px;
  line-height: 1.6;
}
.git-on-text strong {
  font-weight: 700;
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

/* Git 初始化状态提示（统一绿/中性灰，不用黄橙警告色） */
.git-status {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}
.git-status.ok {
  color: var(--admin-peach-dark, #1e7a4a);
  background: color-mix(in oklab, var(--admin-peach, #34b47e) 10%, transparent);
  border: 1px solid color-mix(in oklab, var(--admin-peach, #34b47e) 30%, transparent);
}
.git-status.warn {
  color: var(--admin-text-2, #5a4a3f);
  background: color-mix(in oklab, var(--admin-card) 40%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.15));
}

/* Git 初始化步骤列表 */
.git-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.git-step {
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in oklab, var(--admin-card) 45%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.1));
}
.git-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.git-step-no {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--admin-accent);
  color: var(--admin-on-accent, #fff);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.git-step-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text);
}
.git-copy-btn {
  flex-shrink: 0;
  font-size: 11px;
}
.git-step-desc {
  margin: 6px 0 0 28px;
  font-size: 12px;
  color: var(--admin-muted);
  line-height: 1.6;
}
.git-cmd {
  margin: 6px 0 0 28px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  color: #d8e0e8;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: all;
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
/* 备份记录 Git 状态徽章：on=本地+已推送 / fail=开启但未推送 / off=仅本地（统一绿色系/中性） */
.bk-git {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
}
.bk-git.on {
  color: var(--admin-peach-dark, #1e7a4a);
  background: color-mix(in oklab, var(--admin-peach, #34b47e) 14%, transparent);
  border: 1px solid color-mix(in oklab, var(--admin-peach, #34b47e) 35%, transparent);
}
.bk-git.fail {
  color: var(--admin-text-2, #5a4a3f);
  background: color-mix(in oklab, var(--admin-card) 60%, transparent);
  border: 1px dashed var(--admin-border, rgba(120, 100, 90, 0.25));
}
.bk-git.off {
  color: var(--admin-muted);
  background: color-mix(in oklab, var(--admin-card) 60%, transparent);
  border: 1px solid var(--admin-border, rgba(120, 100, 90, 0.12));
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
