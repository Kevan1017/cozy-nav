/**
 * 备份控制器
 * - 备份配置读写（preferences.backup_config，含坚果云 WebDAV 云端备份）
 * - 立即备份（本地快照 + 增量跳过 + 云端上传）
 * - WebDAV 连接测试
 * - 最近备份记录列表
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { listBackups, parseBackupConfig, DEFAULT_BACKUP_CONFIG, DATA_DIR } from '../utils/backup.js';
import { triggerBackupNow } from '../utils/scheduler.js';
import { testWebDAVConnection } from '../utils/webdavBackup.js';

/**
 * 读取备份配置
 * GET /api/backup/config
 */
export function getBackupConfig(req, res) {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const config = parseBackupConfig(row?.backup_config);
  // dataDir 返回服务器真实的数据目录，供前端引导文案动态展示
  return jsonSuccess(res, { ...config, dataDir: DATA_DIR });
}

/**
 * 保存备份配置
 * PUT /api/backup/config
 * 请求体：{ autoEnabled?, retainCount?, webdav?: {enabled?, url?, user?, pass?, path?} }
 * 说明：webdav.pass 留空且已有密码时保留原值（前端提示「不修改请留空」）
 */
export function updateBackupConfig(req, res) {
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const existing = parseBackupConfig(row?.backup_config);
  const { autoEnabled, retainCount, webdav } = req.body;

  const nextWebdav = { ...existing.webdav, ...(webdav || {}) };
  // 密码留空 = 保留原值（防止前端回显空密码覆盖）
  if (!webdav?.pass && existing.webdav?.pass) nextWebdav.pass = existing.webdav.pass;

  const next = {
    autoEnabled: autoEnabled ?? existing.autoEnabled,
    retainCount: retainCount ?? existing.retainCount,
    webdav: nextWebdav,
  };

  db.prepare('UPDATE preferences SET backup_config = ? WHERE id = 1').run(JSON.stringify(next));

  console.log(
    `[${new Date().toISOString()}] [备份] [配置] [成功] ` +
    `autoEnabled=${next.autoEnabled} retainCount=${next.retainCount} ` +
    `webdav=${next.webdav?.enabled ? '启用' : '关闭'}`
  );

  return jsonSuccess(res, { ...next }, '备份配置已保存');
}

/**
 * 立即备份（手动触发，忽略自动备份开关，遵循增量跳过；启用 WebDAV 时同步上传云端）
 * POST /api/backup/run
 */
export async function runBackupNow(req, res) {
  const result = await triggerBackupNow();
  if (result.skipped) {
    return jsonSuccess(res, { skipped: true, reason: result.reason }, result.reason);
  }
  if (!result.ok) {
    return jsonError(res, `备份失败：${result.reason || '未知错误'}`, 500);
  }
  const msg = result.webdav
    ? (result.webdav.ok ? '备份完成，已上传坚果云' : '备份完成，但坚果云上传失败')
    : '备份完成';
  return jsonSuccess(
    res,
    {
      file: result.file,
      size: result.size,
      time: result.file.replace('backup-', ''),
      webdav: result.webdav || null,
    },
    msg
  );
}

/**
 * 测试坚果云 WebDAV 连接（用请求体配置实时测试，不保存）
 * POST /api/backup/webdav-test
 * 请求体：{ webdav: {url, user, pass, path} }
 */
export async function testWebdav(req, res) {
  const { url, user, pass, path } = req.body?.webdav || {};
  const result = await testWebDAVConnection({ url, user, pass, path });
  if (result.ok) {
    return jsonSuccess(res, {}, '坚果云连接成功，可正常备份');
  }
  return jsonError(res, `连接失败：${result.reason || '未知原因'}`, 400);
}

/**
 * 最近备份记录列表
 * GET /api/backup/list
 */
export function getBackupList(req, res) {
  return jsonSuccess(res, listBackups());
}

export { DEFAULT_BACKUP_CONFIG };
