/**
 * 分类控制器
 */
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { writeLog, LOG_MODULE, LOG_ACTION } from '../utils/operationLogger.js';

/**
 * 检查保险库是否已解锁（通过 X-Vault-Token 请求头）
 * 校验：Token 有效性 + Token 类型 + lockVersion 与数据库一致
 * @param {Object} req - Express 请求对象
 * @returns {boolean}
 */
function isVaultUnlocked(req) {
  const vaultToken = req.headers['x-vault-token'];
  if (!vaultToken) return false;
  try {
    const decoded = jwt.verify(vaultToken, process.env.JWT_SECRET);
    if (decoded.type !== 'vault') return false;

    // 校验加密版本号：加密状态变化后旧 Token 失效
    const admin = db.prepare('SELECT lock_version FROM admin WHERE id = 1').get();
    const currentVersion = admin?.lock_version || 0;
    if (decoded.lockVersion !== currentVersion) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否为已登录的管理员（通过 Authorization 请求头）
 * 管理员可查看所有数据，不受保险库锁定限制
 * @param {Object} req - Express 请求对象
 * @returns {boolean}
 */
function isLoggedInAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return !!decoded.id;
  } catch {
    return false;
  }
}

/**
 * 获取所有分类（含书签）
 * GET /api/categories
 * - 已登录管理员：返回完整数据（管理后台使用）
 * - 公开访问 + 有效 vaultToken：返回完整数据（前台解锁后）
 * - 公开访问 + 无/失效 vaultToken：
 *     分类锁定 → 不返回任何书签（卡片锁），locked=true
 *     分类未锁定 → 返回所有链接，加密链接只返回占位信息（隐藏 url/name）
 *     若分类下所有链接都加密 → allLinksLocked=true（前端显示"所有链接已加密"）
 */
export function getCategories(req, res) {
  const isAdmin = isLoggedInAdmin(req);
  const vaultUnlocked = isVaultUnlocked(req);

  // 检查保险库功能是否开启（未开启时跳过所有锁定过滤）
  const adminRow = db.prepare('SELECT vault_enabled FROM admin WHERE id = 1').get();
  const vaultEnabled = !!adminRow?.vault_enabled;

  const categories = db.prepare(`
    SELECT id, name, subtitle, emoji, bg_color, sort_order, is_locked, created_at
    FROM categories
    WHERE deleted_at IS NULL
    ORDER BY sort_order ASC, id ASC
  `).all();

  // 管理员接口返回完整字段（后台表格展示 favicon 状态/访问量/健康状态）
  // 前台公开接口仅返回渲染所需字段，600+ 链接时显著减少 payload
  const linkFields = isAdmin
    ? 'id, category_id, name, url, domain, avatar_text, avatar_color, is_pinned, pin_order, sort_order, is_locked, is_favorite, favicon_path, favicon_status, last_visited, visit_count, health_status, last_check_at, health_note, created_at'
    : 'id, category_id, name, url, domain, avatar_text, avatar_color, is_pinned, pin_order, sort_order, is_locked, is_favorite, favicon_path, last_visited, created_at';

  const links = db.prepare(`
    SELECT ${linkFields}
    FROM links
    WHERE deleted_at IS NULL
    ORDER BY sort_order ASC, id ASC
  `).all();

  // 管理员可查看备注字段（note），公开接口不返回 note
  const adminLinks = isAdmin
    ? db.prepare(`
        SELECT id, note FROM links WHERE deleted_at IS NULL
      `).all()
    : [];
  const noteMap = new Map(adminLinks.map(l => [l.id, l.note]));

  // 保险库未开启时，所有人都能看全部数据（无锁定过滤）
  const canSeeAll = !vaultEnabled || isAdmin || vaultUnlocked;

  const result = categories.map(cat => {
    const allCatLinks = links.filter(link => link.category_id === cat.id);
    const total = allCatLinks.length;
    const lockedCount = allCatLinks.filter(l => l.is_locked).length;
    const allLinksLocked = !cat.is_locked && total > 0 && total === lockedCount;

    // 情况1：分类锁定 + 无权查看 → 不返回任何书签
    if (cat.is_locked && !canSeeAll) {
      return { ...cat, links: [], locked: true, allLinksLocked: false, vaultUnlocked: false };
    }

    // 情况2-3：分类未锁定（或已解锁）
    const catLinks = allCatLinks.map(link => {
      // 管理员或已解锁 → 返回完整信息（管理员额外附带 note）
      if (canSeeAll) {
        if (isAdmin && noteMap.has(link.id)) {
          return { ...link, note: noteMap.get(link.id) || '' };
        }
        return link;
      }
      // 公开访问 + 链接加密 → 返回占位信息（隐藏敏感字段）
      if (link.is_locked) {
        return {
          id: link.id,
          category_id: link.category_id,
          is_locked: 1,
          sort_order: link.sort_order,
          name: '已加密',
          url: '',
          domain: '',
          avatar_text: '🔒',
          avatar_color: 'slate',
          is_pinned: 0,
          pin_order: 0,
        };
      }
      // 公开访问 + 链接未加密 → 返回完整信息
      return link;
    });

    return { ...cat, links: catLinks, locked: false, allLinksLocked, vaultUnlocked: canSeeAll };
  });

  // HTTP 协商缓存：配合 Express 默认生成的 ETag，数据未变时浏览器刷新直接返回 304（零传输）
  // no-cache 语义：允许浏览器缓存，但每次需重新验证；数据变更或保险库解锁状态变化时，
  // 响应体变化 → ETag 变化 → 自动返回 200 新数据，不会展示陈旧内容
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
  // 响应内容与登录状态/保险库解锁状态相关，缓存键需区分，避免不同状态的响应互相覆盖
  res.append('Vary', 'Authorization, X-Vault-Token');

  return jsonSuccess(res, result);
}

/**
 * 新建分类
 * POST /api/categories
 */
export function createCategory(req, res) {
  const { name, subtitle, emoji, bg_color, sort_order } = req.body;

  // 未显式传排序权重时，自动排到末尾（当前最大权重 + 1），避免新分类与已有分类权重全部相同
  const nextSort = sort_order ?? db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories WHERE deleted_at IS NULL'
  ).get().next;

  const result = db.prepare(`
    INSERT INTO categories (name, subtitle, emoji, bg_color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, subtitle || null, emoji || '🧭', bg_color || null, nextSort);

  const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

  console.log(`[${new Date().toISOString()}] [分类] [新增] [成功] ${name}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.CATEGORY,
    action: LOG_ACTION.CREATE,
    detail: `新建分类：${name}`,
    meta: { id: Number(result.lastInsertRowid) },
  }, req);

  return jsonSuccess(res, newCategory, '创建成功');
}

/**
 * 编辑分类
 * PUT /api/categories/:id
 */
export function updateCategory(req, res) {
  const { id } = req.params;
  const { name, subtitle, emoji, bg_color, sort_order } = req.body;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '分类不存在');
  }

  db.prepare(`
    UPDATE categories
    SET name = ?, subtitle = ?, emoji = ?, bg_color = ?, sort_order = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    subtitle ?? existing.subtitle,
    emoji ?? existing.emoji,
    bg_color ?? existing.bg_color,
    sort_order ?? existing.sort_order,
    id
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

  console.log(`[${new Date().toISOString()}] [分类] [编辑] [成功] ${name || existing.name}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.CATEGORY,
    action: LOG_ACTION.UPDATE,
    detail: `编辑分类：${name || existing.name}`,
    meta: { id: Number(id) },
  }, req);

  return jsonSuccess(res, updated, '更新成功');
}

/**
 * 删除分类（软删除，级联软删除书签）
 * DELETE /api/categories/:id
 */
export function deleteCategory(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '分类不存在');
  }

  const now = new Date().toISOString();

  // 软删除分类
  db.prepare('UPDATE categories SET deleted_at = ? WHERE id = ?').run(now, id);

  // 级联软删除该分类下的书签，并统计删除数量
  const result = db.prepare('UPDATE links SET deleted_at = ? WHERE category_id = ? AND deleted_at IS NULL').run(now, id);
  const deletedLinksCount = result.changes;

  console.log(`[${now}] [分类] [删除] [成功] ${existing.name} (级联删除 ${deletedLinksCount} 个书签)`);
  // 操作日志：记录级联删除的书签数量，批量异常删除可事后追溯
  writeLog({
    module: LOG_MODULE.CATEGORY,
    action: LOG_ACTION.DELETE,
    detail: `删除分类：${existing.name}（级联删除 ${deletedLinksCount} 个书签）`,
    meta: { id: Number(id), deletedLinks: deletedLinksCount },
  }, req);

  return jsonSuccess(res, { deletedLinks: deletedLinksCount }, `删除成功，已级联删除 ${deletedLinksCount} 个书签`);
}

/**
 * 回收站：已删除分类列表
 * GET /api/categories/trash?page=1&pageSize=20
 * 返回所有 deleted_at NOT NULL 的分类（附带回收站内/正常的书签数量，便于展示）
 * - 传 pageSize（>0）时分页返回 { list, total, page, pageSize }，数据量大时请传参
 * - 不传则兼容旧调用，返回全量数组
 */
export function getTrashCategories(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 0, 0), 200);

  // 用 LEFT JOIN + 聚合替代相关子查询，配合 category_id 索引避免大表全扫描
  const selectSql = `
    SELECT c.id, c.name, c.subtitle, c.emoji, c.bg_color, c.sort_order, c.deleted_at,
           COALESCE(SUM(CASE WHEN l.deleted_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS trash_link_count,
           COALESCE(SUM(CASE WHEN l.deleted_at IS NULL THEN 1 ELSE 0 END), 0) AS active_link_count
    FROM categories c
    LEFT JOIN links l ON l.category_id = c.id
    WHERE c.deleted_at IS NOT NULL
    GROUP BY c.id
  `;

  if (pageSize > 0) {
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM categories WHERE deleted_at IS NOT NULL').get().cnt;
    const list = db.prepare(`${selectSql} ORDER BY c.deleted_at DESC LIMIT ? OFFSET ?`)
      .all(pageSize, (page - 1) * pageSize);
    return jsonSuccess(res, { list, total, page, pageSize });
  }

  const list = db.prepare(`${selectSql} ORDER BY c.deleted_at DESC`).all();
  return jsonSuccess(res, list);
}

/**
 * 恢复已删除分类
 * POST /api/categories/:id/restore
 * 只恢复分类本身，其下书签仍留在书签回收站，可前往书签管理单独恢复
 */
export function restoreCategory(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NOT NULL').get(id);
  if (!existing) {
    return jsonError(res, '分类不在回收站中');
  }

  db.prepare('UPDATE categories SET deleted_at = NULL WHERE id = ?').run(id);

  console.log(`[${new Date().toISOString()}] [分类] [恢复] [成功] ${existing.name}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.CATEGORY,
    action: LOG_ACTION.RESTORE,
    detail: `恢复分类：${existing.name}`,
    meta: { id: Number(id) },
  }, req);

  return jsonSuccess(res, null, '已恢复');
}

/**
 * 彻底删除分类（物理删除，不可恢复）
 * DELETE /api/categories/:id/purge
 * 需按外键依赖顺序清理：先删书签访问记录 → 再删书签 → 最后删分类
 */
export function purgeCategory(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NOT NULL').get(id);
  if (!existing) {
    return jsonError(res, '分类不在回收站中');
  }

  // 先清理该分类下所有书签的访问记录（visit_logs.link_id 引用 links.id）
  db.prepare('DELETE FROM visit_logs WHERE link_id IN (SELECT id FROM links WHERE category_id = ?)').run(id);
  // 再物理删除该分类下的书签
  db.prepare('DELETE FROM links WHERE category_id = ?').run(id);
  // 最后物理删除分类
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  console.log(`[${new Date().toISOString()}] [分类] [彻底删除] [成功] ${existing.name}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.CATEGORY,
    action: LOG_ACTION.DELETE,
    detail: `彻底删除分类：${existing.name}`,
    meta: { id: Number(id) },
  }, req);

  return jsonSuccess(res, null, '已彻底删除');
}

/**
 * 切换分类锁定状态
 * PUT /api/categories/:id/lock
 * 简化方案：独立开关，只改分类自己的 is_locked，不联动链接
 */
export function toggleCategoryLock(req, res) {
  const { id } = req.params;
  const { locked } = req.body;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '分类不存在');
  }

  // 锁定时检查保险库是否已开启且密码已设置
  if (locked) {
    const admin = db.prepare('SELECT vault_enabled, vault_password_hash FROM admin WHERE id = 1').get();
    if (!admin?.vault_enabled) {
      return jsonError(res, '请先在设置页开启保险库功能');
    }
    if (!admin?.vault_password_hash) {
      return jsonError(res, '请先在设置页设置保险库密码');
    }
  }

  const newLocked = locked ? 1 : 0;
  const now = new Date().toISOString();

  // 更新分类锁定状态
  db.prepare('UPDATE categories SET is_locked = ? WHERE id = ?').run(newLocked, id);

  // 递增加密版本号，让旧的 vaultToken 失效
  db.prepare('UPDATE admin SET lock_version = lock_version + 1 WHERE id = 1').run();

  console.log(`[${now}] [分类] [锁定] [成功] ${existing.name} -> ${locked ? '锁定' : '解锁'}`);

  return jsonSuccess(res, { id: Number(id), is_locked: newLocked }, locked ? '已加密' : '已解密');
}

/**
 * 批量更新分类排序权重（上移/下移等操作互换 sort_order）
 * @param {Object} req - Express 请求对象，body: { orders: [{ id, sort_order }] }
 * @param {Object} res - Express 响应对象
 */
export function sortCategories(req, res) {
  const { orders } = req.body;

  if (!Array.isArray(orders)) return jsonError(res, '排序数据格式错误');

  // node:sqlite 没有 transaction 方法，手动开启事务
  db.exec('BEGIN');
  try {
    const updateSort = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ? AND deleted_at IS NULL');
    for (const item of orders) {
      updateSort.run(item.sort_order, item.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.log(`[${new Date().toISOString()}] [分类] [排序] [失败] ${e.message}`);
    return jsonError(res, '排序失败，请稍后重试');
  }

  console.log(`[${new Date().toISOString()}] [分类] [排序] [成功]`);

  return jsonSuccess(res, null, '排序更新成功');
}
