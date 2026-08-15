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
import {
  runLocalBackup, getBackupConfig,
  computeDataHash, getLastBackupHash, saveBackupHash,
} from './backup.js';
import { notifyBackup } from './notifier.js';
import { uploadBackupToWebDAV } from './webdavBackup.js';

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
    const intervalMs = (cfg.intervalHours || 6) * 3600 * 1000;
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

/* ================= 每日自动备份（本地快照，增量跳过） ================= */

/** 备份任务防重入标志 */
let backupRunning = false;
/** 备份定时器句柄 */
let backupTimer = null;

/**
 * 执行一次备份流程：
 * 1. 先算数据指纹，与上次备份时一致 → 数据无变化，跳过（不生成快照、不通知）
 * 2. 有变化 → 生成本地快照 → 记录新指纹
 * 3. 若启用坚果云 WebDAV → 上传快照到云端（失败不影响本地） → 通知备份结果
 */
async function runBackupOnce({ force = false } = {}) {
  if (backupRunning) return { skipped: true, reason: '备份任务进行中' };
  const cfg = getBackupConfig();
  // force=true 为手动立即备份：忽略自动备份开关，但仍遵循增量跳过
  if (!cfg.autoEnabled && !force) return { skipped: true, reason: '自动备份未启用' };

  backupRunning = true;
  try {
    // 增量判断：数据指纹一致直接跳过
    const hash = computeDataHash();
    if (hash && hash === getLastBackupHash()) {
      console.log(`[${new Date().toISOString()}] [备份] [跳过] 数据无变化，跳过备份`);
      return { skipped: true, reason: '数据无变化，跳过备份' };
    }

    const result = runLocalBackup();
    if (result.ok && hash) {
      saveBackupHash(hash); // 记住本次指纹，供下次增量比对
    }

    // WebDAV 云端备份：本地成功且启用时上传快照（失败只记日志，不影响本地结果）
    // - 仅上传数据库 + Logo，跳过 favicons（可再生缓存，量大省流量）
    // - 云端按独立 retainCount 保留份数（默认 3 份），超出删除最旧
    let webdav = null;
    if (result.ok && cfg.webdav?.enabled) {
      webdav = await uploadBackupToWebDAV({
        dir: result.dir,
        snap: result.file,
        config: cfg.webdav,
        retainCount: cfg.webdav.retainCount ?? 3,
        excludeDirs: ['favicons'],
      });
    }

    // 通知备份结果（成功/失败 + 云端上传状态），等待发送完成，避免进程重启时通知丢失
    await notifyBackup({
      ok: result.ok,
      file: result.file || '',
      size: formatBackupSize(result.size),
      reason: result.error || '',
      webdav,
    });

    if (!result.ok) return { ok: false, reason: result.error || '备份失败' };
    return { ok: true, file: result.file, size: result.size, webdav };
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
  console.log(`[${new Date().toISOString()}] [备份] [启动] 每天 03:00 自动备份已开启（数据无变化自动跳过）`);
}

/** 停止每日自动备份（关闭服务/测试时使用） */
export function stopDailyBackup() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }
}

/** 立即触发一次备份（设置页「立即备份」按钮调用，force 忽略自动备份开关，增量判断同样生效） */
export async function triggerBackupNow() {
  return runBackupOnce({ force: true });
}
