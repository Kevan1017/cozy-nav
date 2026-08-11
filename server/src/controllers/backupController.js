/**
 * 备份控制器
 * - 备份配置读写（preferences.backup_config）
 * - 立即备份（本地快照 + 可选 Git 推送）
 * - 最近备份记录列表
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { runLocalBackup, listBackups, parseBackupConfig, DEFAULT_BACKUP_CONFIG, DATA_DIR } from '../utils/backup.js';
import { pushToGit, isGitRepoReady } from '../utils/gitBackup.js';
import { notifyGitBackup } from '../utils/notifier.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 读取备份配置
 * GET /api/backup/config
 */
export function getBackupConfig(req, res) {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const config = parseBackupConfig(row?.backup_config);
  // dataDir 返回服务器真实的数据目录，供前端引导文案动态展示
  return jsonSuccess(res, { ...config, gitRepoReady: isGitRepoReady(), dataDir: DATA_DIR });
}

/**
 * 保存备份配置
 * PUT /api/backup/config
 * 请求体：{ autoEnabled?, retainCount?, gitEnabled?, gitRemote?, gitBranch? }
 */
export function updateBackupConfig(req, res) {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const existing = parseBackupConfig(row?.backup_config);
  const {
    autoEnabled, retainCount, gitEnabled, gitRemote, gitBranch,
  } = req.body;

  const next = {
    autoEnabled: autoEnabled ?? existing.autoEnabled,
    retainCount: retainCount ?? existing.retainCount,
    gitEnabled: gitEnabled ?? existing.gitEnabled,
    gitRemote: ((gitRemote ?? existing.gitRemote) || '').trim(),
    gitBranch: ((gitBranch ?? existing.gitBranch) || 'main').trim() || 'main',
  };

  db.prepare('UPDATE preferences SET backup_config = ? WHERE id = 1').run(JSON.stringify(next));

  console.log(
    `[${new Date().toISOString()}] [备份] [配置] [成功] ` +
    `autoEnabled=${next.autoEnabled} retainCount=${next.retainCount} ` +
    `gitEnabled=${next.gitEnabled} remote=${next.gitRemote || '空'} branch=${next.gitBranch}`
  );

  return jsonSuccess(res, { ...next, gitRepoReady: isGitRepoReady() }, '备份配置已保存');
}

/**
 * 立即备份（手动触发）
 * POST /api/backup/run
 * 请求体（可选）：{ pushGit?: boolean }  默认跟随配置 gitEnabled
 */
export async function runBackupNow(req, res) {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const config = parseBackupConfig(row?.backup_config);
  const shouldPush = req.body?.pushGit ?? config.gitEnabled;

  const result = runLocalBackup();
  if (!result.ok) {
    // 本地备份失败：若开启了 Git 备份，同样通知管理员（与定时备份行为一致）
    if (config.gitEnabled) {
      notifyGitBackup({ ok: false, file: '', size: '', reason: result.error || '本地备份失败' });
    }
    return jsonError(res, `备份失败：${result.error || '未知错误'}`, 500);
  }

  let git = { pushed: false, reason: '未启用 Git 备份' };
  if (shouldPush) {
    git = await pushToGit({ remote: config.gitRemote, branch: config.gitBranch });
    if (git.pushed) {
      try {
        // 备份目录写入推送标记，供「最近备份记录」显示推送状态
        writeFileSync(join(result.dir, '.git-pushed'), String(Date.now()));
      } catch { /* 标记写入失败忽略 */ }
    }
    // 通知：Git 推送结果（成功/失败），与定时备份保持一致
    notifyGitBackup({
      ok: git.pushed,
      file: result.file,
      size: formatBackupSize(result.size),
      reason: git.reason || '',
    });
  }

  return jsonSuccess(
    res,
    {
      file: result.file,
      size: result.size,
      time: result.file.replace('backup-', ''),
      git,
    },
    git.pushed
      ? '备份完成，已推送到 Git 仓库'
      : (shouldPush ? `本地备份完成，但 Git 推送失败：${git.reason || '未知原因'}` : '备份完成')
  );
}

/**
 * 最近备份记录列表
 * GET /api/backup/list
 */
export function getBackupList(req, res) {
  return jsonSuccess(res, listBackups());
}

/** 备份大小格式化（B/KB/MB），用于通知消息展示 */
function formatBackupSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

export { DEFAULT_BACKUP_CONFIG };
