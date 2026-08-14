/**
 * 备份控制器
 * - 备份配置读写（preferences.backup_config，含坚果云 WebDAV 云端备份）
 * - 立即备份（本地快照 + 增量跳过 + 云端上传）
 * - WebDAV 连接测试
 * - 最近备份记录列表
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { listBackups, parseBackupConfig, DEFAULT_BACKUP_CONFIG, DATA_DIR, formatBackupTime } from '../utils/backup.js';
import { triggerBackupNow } from '../utils/scheduler.js';
import { testWebDAVConnection, listWebdavBackups } from '../utils/webdavBackup.js';
import { writeLog, LOG_MODULE, LOG_ACTION } from '../utils/operationLogger.js';

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
  // 操作日志：备份配置变更（含云端启停）留痕
  writeLog({
    module: LOG_MODULE.BACKUP,
    action: LOG_ACTION.UPDATE,
    detail: `保存备份配置：自动备份${next.autoEnabled ? '开启' : '关闭'}、保留 ${next.retainCount} 份、坚果云${next.webdav?.enabled ? '启用' : '关闭'}`,
    meta: { autoEnabled: next.autoEnabled, retainCount: next.retainCount, webdavEnabled: !!next.webdav?.enabled },
  }, req);

  return jsonSuccess(res, { ...next }, '备份配置已保存');
}

/**
 * 立即备份（手动触发，忽略自动备份开关，遵循增量跳过；启用 WebDAV 时同步上传云端）
 * POST /api/backup/run
 */
export async function runBackupNow(req, res) {
  const result = await triggerBackupNow();
  // 操作日志：手动备份成败（含云端上传结果）留痕
  const detail = result.skipped
    ? `立即备份跳过：${result.reason}`
    : result.ok
      ? (result.webdav?.ok ? '立即备份完成（已上传坚果云）' : (result.webdav ? '立即备份完成（坚果云上传失败）' : '立即备份完成'))
      : `立即备份失败：${result.reason || '未知错误'}`;
  writeLog({
    module: LOG_MODULE.BACKUP,
    action: LOG_ACTION.RUN,
    detail,
    meta: {
      file: result.file || null,
      size: result.size || null,
      skipped: !!result.skipped,
      webdav: result.webdav ? { ok: !!result.webdav.ok, reason: result.webdav.reason || null } : null,
    },
  }, req);
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
  // 操作日志：WebDAV 连接测试留痕（含失败原因，便于排查云端配置问题）
  writeLog({
    module: LOG_MODULE.BACKUP,
    action: LOG_ACTION.CHECK,
    detail: result.ok ? '测试坚果云连接成功' : `测试坚果云连接失败：${result.reason || '未知原因'}`,
    meta: { ok: !!result.ok, reason: result.reason || null },
  }, req);
  if (result.ok) {
    return jsonSuccess(res, {}, '坚果云连接成功，可正常备份');
  }
  return jsonError(res, `连接失败：${result.reason || '未知原因'}`, 400);
}

/**
 * 最近备份记录列表（区分本地 / 坚果云云端）
 * GET /api/backup/list
 * 返回 { local, webdav, webdavEnabled, webdavOk, webdavReason }
 * - webdavEnabled=false：WebDAV 未启用或配置不完整，不查询云端
 * - webdavEnabled=true 且 webdavOk=false：webdavReason 说明失败原因（限流/接口异常），前端据此提示
 */
export async function getBackupList(req, res) {
  const local = listBackups().map((b) => ({ ...b, source: 'local' }));

  // 云端记录：仅当 WebDAV 已启用且配置完整时查询
  const row = db.prepare('SELECT backup_config FROM preferences WHERE id = 1').get();
  const cfg = parseBackupConfig(row?.backup_config);
  const w = cfg?.webdav || {};
  const webdavEnabled = !!(w.enabled && w.url && w.user && w.pass);
  let webdav = [];
  let webdavOk = true;
  let webdavReason = '';
  if (webdavEnabled) {
    const r = await listWebdavBackups(w);
    if (r.ok) {
      webdav = r.names.map((name) => ({
        name,
        time: formatBackupTime(name),
        size: null,
        source: 'webdav',
      }));
    } else {
      webdavOk = false;
      webdavReason = r.reason || '获取云端记录失败';
    }
  }

  return jsonSuccess(res, { local, webdav, webdavEnabled, webdavOk, webdavReason });
}

export { DEFAULT_BACKUP_CONFIG };
