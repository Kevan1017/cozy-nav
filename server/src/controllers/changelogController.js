/**
 * 更新记录控制器（后台「关于悦行」维护，记录每次版本修复内容）
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';

/** GET /api/changelog - 更新记录列表（按 id 倒序，最新在前） */
export function listChangelog(req, res) {
  const rows = db.prepare('SELECT id, version, description, created_at FROM changelog ORDER BY id DESC').all();
  return jsonSuccess(res, rows, 'success');
}

/** POST /api/changelog - 新增更新记录 */
export function createChangelog(req, res) {
  const { version, description } = req.body;
  const result = db.prepare('INSERT INTO changelog (version, description) VALUES (?, ?)').run(version, description);
  const row = db.prepare('SELECT id, version, description, created_at FROM changelog WHERE id = ?').get(result.lastInsertRowid);
  console.log(`[${new Date().toISOString()}] [更新记录] [新增] [成功] ${version}`);
  return jsonSuccess(res, row, '添加成功');
}

/** DELETE /api/changelog/:id - 删除更新记录 */
export function deleteChangelog(req, res) {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM changelog WHERE id = ?').run(id);
  if (result.changes === 0) {
    return jsonError(res, '记录不存在');
  }
  console.log(`[${new Date().toISOString()}] [更新记录] [删除] [成功] id=${id}`);
  return jsonSuccess(res, null, '删除成功');
}
