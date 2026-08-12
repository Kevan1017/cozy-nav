/**
 * 本地备份工具
 * 每天自动备份 / 手动立即备份：
 * - 数据库：用 VACUUM INTO 生成一致快照（node:sqlite 无 db.backup() API，
 *   VACUUM INTO 与 better-sqlite3 的 backup 等效，均基于 SQLite 在线备份机制）
 * - favicons/：复制图标文件（排除 .failed 失败缓存，可随时重建）
 * - logo/：复制后台上传的站点 Logo（丢了需重新上传）
 * - 按 retainCount（默认 5 份）清理过期备份
 * - 增量：数据无变化（数据指纹一致）时跳过备份，不生成新快照
 * 备份目录：server/data/backups/backup-YYYYMMDD-HHmmss/{cozy-nav.db, favicons/, logo/}
 */
import db from '../db/index.js';
import { createHash } from 'node:crypto';
import {
  mkdirSync, existsSync, cpSync, rmSync, readdirSync, statSync,
  readFileSync, writeFileSync,
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

/** 数据指纹计算时排除的条目（备份产物/临时缓存/自身指纹文件，不计入"数据变化"） */
const HASH_EXCLUDE = new Set([
  'backups',          // 历史备份快照
  '.git',             // data 目录若曾初始化 git 仓库
  '.failed',          // favicon 失败缓存
  'backup-hash.json', // 上次备份指纹文件自身（内容含时间戳，必须排除）
  'cozy-nav.db-journal', 'cozy-nav.db-wal', 'cozy-nav.db-shm', // SQLite 临时文件
]);

/** 上次备份指纹存储文件 */
const HASH_FILE = join(DATA_DIR, 'backup-hash.json');

/** 备份配置默认值（与 preferences.backup_config 结构保持一致） */
export const DEFAULT_BACKUP_CONFIG = {
  autoEnabled: true,      // 是否启用每天 03:00 自动备份
  retainCount: 5,         // 本地备份保留份数（超出自动删除最旧的）
  webdav: {               // 坚果云 WebDAV 云端备份（本地快照上传到云端双保险）
    enabled: false,
    url: 'https://dav.jianguoyun.com/dav/', // WebDAV 根地址
    user: '',             // 坚果云账号（邮箱）
    pass: '',             // 坚果云应用密码（非登录密码，需在坚果云网页端生成）
    path: 'cozy-nav-backup', // 远端目录名（自动创建）
    retainCount: 3,       // 云端保留份数（超出自动删除最旧的，节省坚果云空间）
  },
};

/** 深度合并备份配置（webdav 为嵌套对象，需逐层兜底） */
function mergeBackupConfig(base, extra = {}) {
  return {
    ...base,
    ...extra,
    webdav: { ...(base.webdav || {}), ...(extra.webdav || {}) },
  };
}

/** 读取备份配置：preferences 表 JSON 字段 + 默认值兜底（不依赖 API 层） */
export function getBackupConfig() {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  if (row?.backup_config) {
    try {
      return mergeBackupConfig(DEFAULT_BACKUP_CONFIG, JSON.parse(row.backup_config));
    } catch { /* 解析失败回退默认 */ }
  }
  return { ...DEFAULT_BACKUP_CONFIG, webdav: { ...DEFAULT_BACKUP_CONFIG.webdav } };
}

/** 解析备份配置（供 API 层读取时兜底，兼容空/损坏 JSON） */
export function parseBackupConfig(raw) {
  try {
    const parsed = JSON.parse(raw || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return mergeBackupConfig(DEFAULT_BACKUP_CONFIG, parsed);
    }
  } catch { /* 解析失败回退 */ }
  return { ...DEFAULT_BACKUP_CONFIG, webdav: { ...DEFAULT_BACKUP_CONFIG.webdav } };
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

/**
 * 计算数据指纹（增量判断依据）
 * 对 DATA_DIR 内所有有效文件递归计算 SHA-256（文件名 + 大小 + 修改时间 + 内容），
 * 排除备份产物/缓存/临时文件。数据零变化时两次指纹一致 → 跳过备份。
 * @returns {string|null} 指纹 hex；计算失败返回 null（调用方按"有变化"处理，保证不漏备）
 */
export function computeDataHash() {
  try {
    const hash = createHash('sha256');
    const walk = (dir, rel) => {
      for (const entry of readdirSync(dir).sort()) {
        if (HASH_EXCLUDE.has(entry)) continue;
        const p = join(dir, entry);
        const relPath = rel ? `${rel}/${entry}` : entry;
        const stat = statSync(p);
        if (stat.isDirectory()) {
          walk(p, relPath);
        } else {
          hash.update(relPath);
          hash.update(String(stat.size));
          hash.update(String(stat.mtimeMs));
          hash.update(readFileSync(p));
        }
      }
    };
    walk(DATA_DIR, '');
    return hash.digest('hex');
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [备份] [指纹] [失败] ${err.message}`);
    return null;
  }
}

/** 读取上次备份时的数据指纹（无记录返回 null） */
export function getLastBackupHash() {
  try {
    const raw = readFileSync(HASH_FILE, 'utf8');
    return JSON.parse(raw)?.hash || null;
  } catch { /* 文件不存在或损坏视为无记录 */ }
  return null;
}

/** 保存本次备份后的数据指纹（供下次增量比对） */
export function saveBackupHash(hash) {
  try {
    writeFileSync(HASH_FILE, JSON.stringify({ hash, at: new Date().toISOString() }));
    return true;
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [备份] [指纹] [保存失败] ${err.message}`);
    return false;
  }
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
 * @returns {Array<{name:string, time:string, size:number}>}
 */
export function listBackups() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('backup-'))
    .map((name) => {
      const dir = join(BACKUP_DIR, name);
      const stat = statSync(dir);
      return {
        name,
        time: formatBackupTime(name),
        size: dirSize(dir),
      };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}
