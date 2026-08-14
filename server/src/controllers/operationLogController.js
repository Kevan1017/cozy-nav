/**
 * 操作日志控制器
 * - GET    /api/operation-logs     分页查询（按模块/关键字筛选）
 * - DELETE /api/operation-logs     清空日志（物理删除，日志无恢复价值）
 */
import db from '../db/index.js';
import { jsonPage, jsonSuccess } from '../utils/response.js';

/**
 * 分页查询操作日志
 */
export function listLogs(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const module = String(req.query.module || '').trim();
  const keyword = String(req.query.keyword || '').trim();

  // 参数化拼接筛选条件，模块精确匹配 + 关键字模糊匹配 detail
  const conditions = ['deleted_at IS NULL'];
  const params = [];
  if (module) {
    conditions.push('module = ?');
    params.push(module);
  }
  if (keyword) {
    conditions.push('(detail LIKE ? OR operator LIKE ? OR meta LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM operation_logs ${where}`).get(...params);
  const offset = (page - 1) * pageSize;

  const list = db.prepare(
    `SELECT id, module, action, detail, meta, operator, ip, created_at
     FROM operation_logs ${where}
     ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  // meta 是 JSON 字符串，读给前端前解析成对象
  const parsed = list.map((row) => ({ ...row, meta: row.meta ? safeParse(row.meta) : null }));

  return jsonPage(res, parsed, total, page, pageSize);
}

/**
 * 清空操作日志（物理删除全部，含历史软删残留）
 */
export function clearLogs(req, res) {
  const { changes } = db.prepare('DELETE FROM operation_logs').run();
  return jsonSuccess(res, { cleared: changes }, `已清空 ${changes} 条操作日志`);
}

// meta 字段安全解析（坏 JSON 不阻断列表）
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
