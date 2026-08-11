/**
 * 定时巡检调度器
 * 每 N 小时（默认 6h，配置可调）自动检测一批链接：
 * - 优先最久未检测（last_check_at 升序，NULL 优先）
 * - 分片条数取配置 batchSize（默认 50）
 * - down 终态默认不再纳入（recheckDead=true 时重新纳入）
 * - 与手动批量检测共用 healthRunner 任务锁，互斥防重入
 */
import db from '../db/index.js';
import { startHealthBatch, isBatchRunning } from './healthRunner.js';
import { runLocalBackup, getBackupConfig } from './backup.js';
import { pushToGit, isGitRepoReady } from './gitBackup.js';
import { notifyGitBackup } from './notifier.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 巡检配置默认值（与 preferences.health_config 结构保持一致） */
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

/** 读取巡检配置：preferences 表 JSON 字段 + 默认值兜底（不依赖 API 层） */
function getHealthConfig() {
  const row = db.prepare('SELECT health_config FROM preferences WHERE id = 1').get();
  if (row?.health_config) {
    try {
      return { ...DEFAULT_HEALTH_CONFIG, ...JSON.parse(row.health_config) };
    } catch { /* 解析失败回退默认 */ }
  }
  return { ...DEFAULT_HEALTH_CONFIG };
}

/** 巡检任务防重入标志（isBatchRunning 防手动/定时并发，此标志防定时自身重叠） */
let patrolRunning = false;
/** 定时器句柄 */
let patrolTimer = null;

/** 执行一轮巡检（未启用/有任务在跑则跳过） */
async function runPatrolOnce() {
  if (patrolRunning || isBatchRunning()) return;
  const cfg = getHealthConfig();
  if (!cfg.enabled) return;

  patrolRunning = true;
  try {
    // down 终态是否纳入：recheckDead=true 时不加过滤
    const statusFilter = cfg.recheckDead
      ? ''
      : "AND (health_status IS NULL OR health_status != 'down')";
    const links = db.prepare(`
      SELECT id, url FROM links
      WHERE deleted_at IS NULL ${statusFilter}
      ORDER BY last_check_at IS NULL DESC, last_check_at ASC
      LIMIT ?
    `).all(cfg.batchSize);

    if (!links.length) return;

    startHealthBatch(links, { logTag: '定时巡检', deadStreak: cfg.deadStreak, triggerType: 'scheduled' });
  } finally {
    patrolRunning = false;
  }
}

/**
 * 启动定时巡检（服务启动时调用一次）
 * 每轮结束后按最新配置重新调度，配置改动即时生效无需重启
 */
export function startHealthPatrol() {
  if (patrolTimer) return;

  const scheduleNext = () => {
    const cfg = getHealthConfig();
    // 间隔下限 10 分钟，防止误配导致频繁出站
    const intervalMs = Math.max(10 * 60 * 1000, (cfg.intervalHours || 6) * 3600 * 1000);
    patrolTimer = setTimeout(async () => {
      await runPatrolOnce();
      scheduleNext(); // 动态读取最新配置
    }, intervalMs);
  };

  scheduleNext();
  console.log(`[${new Date().toISOString()}] [巡检] [启动] 每 ${getHealthConfig().intervalHours} 小时巡检一轮`);
}

/** 停止定时巡检（关闭服务/测试时使用） */
export function stopHealthPatrol() {
  if (patrolTimer) {
    clearTimeout(patrolTimer);
    patrolTimer = null;
  }
}

/**
 * 立即触发一轮巡检（设置页「立即巡检」按钮调用）
 * @returns {{started:boolean, reason?:string}}
 */
export async function triggerHealthPatrol() {
  if (isBatchRunning()) {
    return { started: false, reason: '已有检测任务进行中' };
  }
  await runPatrolOnce();
  return { started: true };
}

/* ================= 每日自动备份（#84 本地 + #85 Git 异地） ================= */

/** 备份任务防重入标志 */
let backupRunning = false;
/** 备份定时器句柄 */
let backupTimer = null;

/**
 * 执行一次备份流程：本地备份成功且启用 Git 时，自动推送到远程仓库并通知结果
 */
async function runBackupOnce() {
  if (backupRunning) return;
  const cfg = getBackupConfig();
  if (!cfg.autoEnabled) return;

  backupRunning = true;
  try {
    const result = runLocalBackup();

    // Git 异地备份：本地快照成功后推送，失败不影响主流程；结果推送到通知中心
    if (result.ok && cfg.gitEnabled) {
      const git = await pushToGit({ remote: cfg.gitRemote, branch: cfg.gitBranch });
      if (git.pushed) {
        try {
          // 备份目录写入推送标记，供「最近备份记录」显示推送状态
          writeFileSync(join(result.dir, '.git-pushed'), String(Date.now()));
        } catch { /* 标记写入失败忽略 */ }
      } else if (!isGitRepoReady()) {
        console.log(`[${new Date().toISOString()}] [备份] [Git] [提示] data 目录未初始化 git 仓库，请在 server/data 下执行 git init`);
      }
      console.log(`[${new Date().toISOString()}] [备份] [Git] [${git.pushed ? '成功' : '失败'}] ${git.reason || ''}`);
      // 通知：Git 推送结果（成功/失败）
      notifyGitBackup({
        ok: git.pushed,
        file: result.file,
        size: formatBackupSize(result.size),
        reason: git.reason || '',
      });
    } else if (!result.ok && cfg.gitEnabled) {
      // 本地备份失败（如磁盘满），同样通知管理员
      notifyGitBackup({ ok: false, file: '', size: '', reason: result.reason || '本地备份失败' });
    }
  } finally {
    backupRunning = false;
  }
}

/** 备份大小格式化（B/KB/MB） */
function formatBackupSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * 启动每日自动备份（服务启动时调用一次）
 * 每天 03:00 执行，结束后按当前时间重排下一次（本地时区，无 DST 影响）
 */
export function startDailyBackup() {
  if (backupTimer) return;

  const scheduleNext = () => {
    const now = new Date();
    // 次日 03:00（本地时区）
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 3, 0, 0, 0);
    backupTimer = setTimeout(async () => {
      await runBackupOnce();
      scheduleNext();
    }, next - now);
  };

  scheduleNext();
  console.log(`[${new Date().toISOString()}] [备份] [启动] 每天 03:00 自动备份已开启（本地快照 + Git 异地）`);
}

/** 停止每日自动备份（关闭服务/测试时使用） */
export function stopDailyBackup() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }
}
