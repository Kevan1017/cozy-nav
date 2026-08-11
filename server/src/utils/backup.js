/**
 * 本地备份工具
 * 每天自动备份 / 手动立即备份：
 * - 数据库：用 VACUUM INTO 生成一致快照（node:sqlite 无 db.backup() API，
 *   VACUUM INTO 与 better-sqlite3 的 backup 等效，均基于 SQLite 在线备份机制）
 * - favicons/：复制图标文件（排除 .failed 失败缓存，可随时重建）
 * - logo/：复制后台上传的站点 Logo（丢了需重新上传）
 * - 按 retainDays（默认 7 天）清理过期备份
 * 备份目录：server/data/backups/backup-YYYYMMDD-HHmmss/{cozy-nav.db, favicons/, logo/}
 */
import db from '../db/index.js';
import {
  mkdirSync, existsSync, cpSync, rmSync, readdirSync, statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** 数据根目录（server/data）——基于源码相对定位，部署到任意服务器路径均正确 */
export const DATA_DIR = join(__dirname, '../../data');
/** 备份输出根目录 */
export const BACKUP_DIR = join(DATA_DIR, 'backups');
/** 需要排除的子目录（.failed 为 favicon 抓取失败缓存，可重建） */
const EXCLUDE_DIRS = ['.failed'];

/** 备份配置默认值（与 preferences.backup_config 结构保持一致） */
export const DEFAULT_BACKUP_CONFIG = {
  autoEnabled: true,      // 是否启用每天 03:00 自动备份
  retainCount: 5,         // 本地备份保留份数（超出自动删除最旧的）
  gitEnabled: false,      // 是否启用 Git 异地备份
  gitRemote: '',          // Git 仓库地址（如 Gitee 私有仓库）
  gitBranch: 'main',      // Git 分支
};

/** 读取备份配置：preferences 表 JSON 字段 + 默认值兜底（不依赖 API 层） */
export function getBackupConfig() {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  if (row?.backup_config) {
    try {
      return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(row.backup_config) };
    } catch { /* 解析失败回退默认 */ }
  }
  return { ...DEFAULT_BACKUP_CONFIG };
}

/** 解析备份配置（供 API 层读取时兜底，兼容空/损坏 JSON） */
export function parseBackupConfig(raw) {
  try {
    const parsed = JSON.parse(raw || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...DEFAULT_BACKUP_CONFIG, ...parsed };
    }
  } catch { /* 解析失败回退 */ }
  return { ...DEFAULT_BACKUP_CONFIG };
}

/** 递归复制目录（排除指定子目录） */
function copyDirExclude(src, dest, excludes) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (excludes.includes(entry)) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirExclude(srcPath, destPath, excludes);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

/** 计算目录总大小（字节） */
function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    total += statSync(p).isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}

/** 格式化时间戳：YYYYMMDD-HHmmss-FFF（含毫秒，避免同秒连续备份文件名冲突） */
function formatTs(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** 清理超出保留份数的旧备份（名字 backup-YYYYMMDD-HHmmss 字典序即时间序） */
function cleanupOldBackups(retainCount) {
  if (!existsSync(BACKUP_DIR)) return;
  const dirs = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('backup-'))
    .sort()
    .reverse(); // 最新在前
  const toDelete = dirs.slice(retainCount);
  for (const name of toDelete) {
    try {
      rmSync(join(BACKUP_DIR, name), { recursive: true, force: true });
      console.log(`[${new Date().toISOString()}] [备份] [清理] [成功] 已删除最旧备份 ${name}`);
    } catch (err) {
      console.log(`[${new Date().toISOString()}] [备份] [清理] [失败] ${name}: ${err.message}`);
    }
  }
}

/**
 * 执行本地备份（同步，简单可靠）
 * @returns {{ok:boolean, dir?:string, file?:string, size?:number, error?:string}}
 */
export function runLocalBackup() {
  try {
    const ts = formatTs(new Date());
    const subDir = join(BACKUP_DIR, `backup-${ts}`);
    mkdirSync(subDir, { recursive: true });

    // 1. 数据库一致快照（VACUUM INTO 输出到备份目录，生成紧凑副本）
    const dbFile = join(subDir, 'cozy-nav.db');
    db.exec(`VACUUM INTO '${dbFile.replace(/\\/g, '/').replace(/'/g, "''")}'`);

    // 2. favicons 目录（排除 .failed 失败缓存）
    const faviconDir = join(DATA_DIR, 'favicons');
    if (existsSync(faviconDir)) {
      copyDirExclude(faviconDir, join(subDir, 'favicons'), EXCLUDE_DIRS);
    }

    // 3. logo 目录（站点 Logo）
    const logoDir = join(DATA_DIR, 'logo');
    if (existsSync(logoDir)) {
      copyDirExclude(logoDir, join(subDir, 'logo'), []);
    }

    // 4. 清理超出保留份数的旧备份
    cleanupOldBackups(getBackupConfig().retainCount);

    const size = dirSize(subDir);
    console.log(
      `[${new Date().toISOString()}] [备份] [执行] [成功] backup-${ts} ${(size / 1024).toFixed(1)}KB`
    );
    return { ok: true, dir: subDir, file: `backup-${ts}`, size };
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [备份] [执行] [失败] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * 格式化备份时间：backup-YYYYMMDD-HHmmss-FFF → YYYY-MM-DD HH:mm:ss
 */
function formatBackupTime(name) {
  const m = name.match(/^backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!m) return name;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * 列出最近备份记录（按时间倒序）
 * @returns {Array<{name:string, time:string, size:number, hasGit:boolean}>}
 */
export function listBackups() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('backup-'))
    .map((name) => {
      const dir = join(BACKUP_DIR, name);
      const stat = statSync(dir);
      const gitMark = existsSync(join(dir, '.git-pushed'));
      return {
        name,
        time: formatBackupTime(name),
        size: dirSize(dir),
        hasGit: gitMark,
      };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}
