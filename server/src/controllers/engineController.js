/**
 * 搜索引擎控制器
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';

/**
 * 获取启用的引擎列表（前台用）
 * GET /api/engines
 */
export function getActiveEngines(req, res) {
  const engines = db.prepare(
    'SELECT * FROM search_engines WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC'
  ).all();

  return jsonSuccess(res, engines);
}

/**
 * 获取所有引擎（含禁用，后台用）
 * GET /api/engines/all
 */
export function getAllEngines(req, res) {
  const engines = db.prepare(
    'SELECT * FROM search_engines WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC'
  ).all();

  return jsonSuccess(res, engines);
}

/**
 * 创建引擎
 * POST /api/engines
 */
export function createEngine(req, res) {
  const { name, label, key, url_template, icon, color, sort_order, is_active } = req.body;

  if (!name) return jsonError(res, '引擎名称不能为空');
  if (!label) return jsonError(res, '引擎标签不能为空');
  if (!key) return jsonError(res, '引擎标识不能为空');
  if (!url_template) return jsonError(res, 'URL 模板不能为空');
  // 校验 URL 模板必须包含 {q} 占位符，否则搜索时无法替换关键词
  if (!url_template.includes('{q}')) {
    return jsonError(res, 'URL 模板必须包含 {q} 占位符');
  }

  try {
    const result = db.prepare(
      `INSERT INTO search_engines (name, label, key, url_template, icon, color, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name, label, key, url_template,
      icon || '', color || 'sky',
      sort_order ?? 0, is_active ?? 1
    );

    const engine = db.prepare('SELECT * FROM search_engines WHERE id = ?').get(result.lastInsertRowid);

    console.log(`[${new Date().toISOString()}] [搜索引擎] [新增] [成功] ${name}`);

    return jsonSuccess(res, engine, '创建成功');
  } catch (e) {
    console.log(`[${new Date().toISOString()}] [搜索引擎] [新增] [失败] ${e.message}`);
    return jsonError(res, '创建失败，请检查输入后重试');
  }
}

/**
 * 更新引擎
 * PUT /api/engines/:id
 */
export function updateEngine(req, res) {
  const { id } = req.params;
  const data = req.body;

  const existing = db.prepare('SELECT * FROM search_engines WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return jsonError(res, '引擎不存在');

  const fields = [];
  const values = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.label !== undefined) { fields.push('label = ?'); values.push(data.label); }
  if (data.key !== undefined) { fields.push('key = ?'); values.push(data.key); }
  if (data.url_template !== undefined) {
    // 校验 URL 模板必须包含 {q} 占位符
    if (!data.url_template.includes('{q}')) {
      return jsonError(res, 'URL 模板必须包含 {q} 占位符');
    }
    fields.push('url_template = ?'); values.push(data.url_template);
  }
  if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

  if (fields.length === 0) return jsonError(res, '没有需要更新的字段');

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    db.prepare(`UPDATE search_engines SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const engine = db.prepare('SELECT * FROM search_engines WHERE id = ?').get(id);

    console.log(`[${new Date().toISOString()}] [搜索引擎] [编辑] [成功] ${engine.name}`);

    return jsonSuccess(res, engine, '更新成功');
  } catch (e) {
    console.log(`[${new Date().toISOString()}] [搜索引擎] [编辑] [失败] ${e.message}`);
    return jsonError(res, '更新失败，请检查输入后重试');
  }
}

/**
 * 删除引擎（软删除）
 * DELETE /api/engines/:id
 */
export function deleteEngine(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM search_engines WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return jsonError(res, '引擎不存在');

  // 至少保留一个启用的引擎
  const count = db.prepare('SELECT COUNT(*) as c FROM search_engines WHERE is_active = 1 AND deleted_at IS NULL').get();
  if (count.c <= 1) return jsonError(res, '至少保留一个启用的搜索引擎');

  db.prepare('UPDATE search_engines SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);

  console.log(`[${new Date().toISOString()}] [搜索引擎] [删除] [成功] ${existing.name}`);

  return jsonSuccess(res, null, '删除成功');
}

/**
 * 批量排序
 * PUT /api/engines/sort
 */
export function sortEngines(req, res) {
  const { orders } = req.body;

  if (!Array.isArray(orders)) return jsonError(res, '排序数据格式错误');

  // node:sqlite 没有 transaction 方法，手动开启事务
  db.exec('BEGIN');
  try {
    const updateSort = db.prepare('UPDATE search_engines SET sort_order = ? WHERE id = ? AND deleted_at IS NULL');
    for (const item of orders) {
      updateSort.run(item.sort_order, item.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.log(`[${new Date().toISOString()}] [搜索引擎] [排序] [失败] ${e.message}`);
    return jsonError(res, '排序失败，请稍后重试');
  }

  console.log(`[${new Date().toISOString()}] [搜索引擎] [排序] [成功]`);

  return jsonSuccess(res, null, '排序更新成功');
}
