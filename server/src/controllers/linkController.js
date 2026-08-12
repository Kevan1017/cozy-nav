/**
 * 书签控制器
 */
import { writeFile } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import {
  fetchFaviconAsync,
  normalizeDomain,
  fetchFaviconByDomain,
  isValidPublicDomain,
  getCachedFavicon,
  fetchFromSources,
  saveToCache,
  isRecentlyFailed,
  markAsFailed,
  hashDomain,
  clearFailedRecord,
  isImageBuffer,
  FAVICON_DIR,
} from '../utils/faviconFetcher.js';
import { isPublicHostname, classifyHostname } from '../utils/ssrfGuard.js';
import { checkLinkHealth } from '../utils/linkHealth.js';
import { startHealthBatch, getHealthBatchProgress, persistHealth } from '../utils/healthRunner.js';
import { normalizeUrl } from '../utils/urlNormalize.js';

/**
 * 记录书签访问
 * POST /api/links/:id/visit
 * 公开接口（前台埋点用），事务内完成两步：
 * 1. 更新 last_visited + visit_count（冗余计数，避免统计时 SUM 全表）
 * 2. 插入 visit_logs 明细（支撑趋势图 / TOP 榜单 / 冷链接分析）
 */
export function recordVisit(req, res) {
  const { id } = req.params;

  // 不校验链接是否存在：统一执行 UPDATE + 条件插入明细，
  // 无效 ID 时 UPDATE 影响 0 行、不写任何数据，且响应统一成功（杜绝 ID 探测）
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const info = db.prepare('UPDATE links SET last_visited = ?, visit_count = visit_count + 1 WHERE id = ?').run(now, id);
    // 仅链接存在时插入明细，避免无效 ID 产生引用不到的外键垃圾行
    if (info.changes > 0) {
      db.prepare('INSERT INTO visit_logs (link_id, visited_at) VALUES (?, ?)').run(id, now);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.log(`[${new Date().toISOString()}] [访问] [记录] [失败] linkId=${id} ${err.message}`);
    return jsonError(res, '访问记录失败');
  }

  return jsonSuccess(res, null, '已记录访问');
}

/** 从 URL 解析域名（hostname），解析失败返回 null（创建/编辑书签时兜底补全 domain） */
function extractDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * 新建书签
 * POST /api/links
 */
export async function createLink(req, res) {
  const { category_id, name, url, domain, avatar_text, avatar_color, sort_order, note, force, favicon_data_url } = req.body;

  // 校验分类是否存在
  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(category_id);
  if (!category) {
    return jsonError(res, '分类不存在');
  }

  // 重复链接检测：URL 规范化后查重（软删除的不参与），命中且未带 force 时返回 409 由前端确认
  const normalized = normalizeUrl(url);
  if (normalized) {
    const dup = db.prepare(
      'SELECT id, name, url FROM links WHERE url_normalized = ? AND deleted_at IS NULL'
    ).get(normalized);
    if (dup && !force) {
      return res.status(200).json({
        code: 409,
        message: '已存在相同地址的书签',
        data: { duplicate: { id: dup.id, name: dup.name, url: dup.url } },
      });
    }
  }

  // 未显式传排序权重时，自动排到该分类末尾（分类内最大权重 + 1），避免新书签与同分类书签权重全部相同
  const nextSort = sort_order ?? db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM links WHERE category_id = ? AND deleted_at IS NULL'
  ).get(category_id).next;

  // 创建模式下用户可直接上传自定义图标（data URL），保存为 up- 前缀文件并写入 favicon_path
  let faviconPath = null;
  if (favicon_data_url) {
    const buffer = decodeUploadDataUrl(favicon_data_url);
    if (buffer) {
      const host = (() => { try { return normalizeDomain(new URL(url).hostname); } catch { return 'unknown'; } })();
      const fileName = `up-${hashDomain(host)}-${randomBytes(4).toString('hex')}.png`;
      try {
        await writeFile(join(FAVICON_DIR, fileName), buffer);
        faviconPath = fileName;
      } catch (err) {
        console.log(`[${new Date().toISOString()}] [favicon] [自定义上传] [失败] ${err.message}`);
      }
    }
  }

  const result = db.prepare(`
    INSERT INTO links (category_id, name, url, domain, avatar_text, avatar_color, sort_order, note, url_normalized, favicon_path, favicon_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(category_id, name, url, domain || extractDomain(url), avatar_text || null, avatar_color || null, nextSort, note || '', normalized, faviconPath, faviconPath ? 'ok' : null);

  const newLink = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);

  console.log(`[${new Date().toISOString()}] [书签] [新增] [成功] ${name}`);

  // 未上传自定义图标时，异步抓取 favicon（不阻塞响应）
  if (!faviconPath) {
    setImmediate(() => {
      fetchFaviconAsync(url, Number(result.lastInsertRowid)).catch(() => {});
    });
  }

  return jsonSuccess(res, newLink, '创建成功');
}

/**
 * 编辑书签
 * PUT /api/links/:id
 */
export function updateLink(req, res) {
  const { id } = req.params;
  const { category_id, name, url, domain, avatar_text, avatar_color, sort_order, note, force, favicon_path } = req.body;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不存在');
  }

  // 重复链接检测：按最终 URL 规范化查重（排除自身），命中且未带 force 时返回 409 由前端确认
  const finalUrl = url ?? existing.url;
  const normalized = normalizeUrl(finalUrl);
  if (normalized) {
    const dup = db.prepare(
      'SELECT id, name, url FROM links WHERE url_normalized = ? AND deleted_at IS NULL AND id != ?'
    ).get(normalized, id);
    if (dup && !force) {
      return res.status(200).json({
        code: 409,
        message: '已存在相同地址的书签',
        data: { duplicate: { id: dup.id, name: dup.name, url: dup.url } },
      });
    }
  }

  db.prepare(`
    UPDATE links
    SET category_id = ?, name = ?, url = ?, domain = ?, avatar_text = ?, avatar_color = ?, sort_order = ?, note = ?, url_normalized = ?
    WHERE id = ?
  `).run(
    category_id ?? existing.category_id,
    name ?? existing.name,
    url ?? existing.url,
    domain ?? extractDomain(finalUrl) ?? existing.domain,
    avatar_text ?? existing.avatar_text,
    avatar_color ?? existing.avatar_color,
    sort_order ?? existing.sort_order,
    note !== undefined ? note : existing.note,
    normalized,
    id
  );

  // url 变更时清空旧 favicon 并重新抓取
  if (url && url !== existing.url) {
    db.prepare('UPDATE links SET favicon_path = NULL, favicon_status = NULL WHERE id = ?').run(id);
    setImmediate(() => {
      fetchFaviconAsync(url, Number(id)).catch(() => {});
    });
  }

  // favicon：编辑弹窗内新获取到图标时前端会提交 favicon_path，写回数据库（URL 未变时的补抓结果）
  // 值格式校验：仅接受 favicon 文件名（hash.ext），防止写入任意值
  if (favicon_path && /^[\w-]+\.(png|ico|jpg|jpeg)$/i.test(favicon_path)) {
    db.prepare('UPDATE links SET favicon_path = ?, favicon_status = ? WHERE id = ?').run(favicon_path, 'ok', id);
  }

  const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);

  console.log(`[${new Date().toISOString()}] [书签] [编辑] [成功] ${name || existing.name}`);

  return jsonSuccess(res, updated, '更新成功');
}

/**
 * 删除书签（软删除）
 * DELETE /api/links/:id
 */
export function deleteLink(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不存在');
  }

  db.prepare('UPDATE links SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);

  console.log(`[${new Date().toISOString()}] [书签] [删除] [成功] ${existing.name}`);

  return jsonSuccess(res, null, '删除成功');
}

/**
 * 回收站：已删除书签列表
 * GET /api/links/trash?page=1&pageSize=20
 * 返回所有 deleted_at NOT NULL 的书签（附带所属分类名与分类是否已删除，便于展示）
 * - 传 pageSize（>0）时分页返回 { list, total, page, pageSize }，数据量大时请传参
 * - 不传则兼容旧调用，返回全量数组
 */
export function getTrashLinks(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 0, 0), 200);

  const selectSql = `
    SELECT l.id, l.category_id, l.name, l.url, l.domain, l.avatar_text, l.avatar_color,
           l.sort_order, l.note, l.favicon_path, l.favicon_status, l.deleted_at,
           c.name AS category_name, c.deleted_at AS category_deleted
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.deleted_at IS NOT NULL
  `;

  if (pageSize > 0) {
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM links WHERE deleted_at IS NOT NULL').get().cnt;
    const list = db.prepare(`${selectSql} ORDER BY l.deleted_at DESC LIMIT ? OFFSET ?`)
      .all(pageSize, (page - 1) * pageSize);
    return jsonSuccess(res, { list, total, page, pageSize });
  }

  const list = db.prepare(`${selectSql} ORDER BY l.deleted_at DESC`).all();
  return jsonSuccess(res, list);
}

/**
 * 恢复已删除书签
 * POST /api/links/:id/restore
 * 恢复前提：所属分类仍存在且未删除，否则无处归属
 */
export function restoreLink(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NOT NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不在回收站中');
  }

  // 分类必须存在且未删除，否则恢复后无法在前台显示
  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(existing.category_id);
  if (!category) {
    return jsonError(res, '所属分类已删除，请先恢复该分类');
  }

  db.prepare('UPDATE links SET deleted_at = NULL WHERE id = ?').run(id);

  console.log(`[${new Date().toISOString()}] [书签] [恢复] [成功] ${existing.name}`);

  return jsonSuccess(res, null, '已恢复');
}

/**
 * 彻底删除书签（物理删除，不可恢复）
 * DELETE /api/links/:id/purge
 */
export function purgeLink(req, res) {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NOT NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不在回收站中');
  }

  // 先清理关联的访问记录（外键约束：visit_logs.link_id 引用 links.id），再删除书签
  db.prepare('DELETE FROM visit_logs WHERE link_id = ?').run(id);
  db.prepare('DELETE FROM links WHERE id = ?').run(id);

  console.log(`[${new Date().toISOString()}] [书签] [彻底删除] [成功] ${existing.name}`);

  return jsonSuccess(res, null, '已彻底删除');
}

/**
 * 置顶/取消置顶书签
 * PUT /api/links/:id/pin
 */
export function togglePin(req, res) {
  const { id } = req.params;
  const { pinned, order } = req.body;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不存在');
  }

  if (pinned) {
    // 置顶：限制最多 6 个
    const pinnedCount = db.prepare('SELECT COUNT(*) as cnt FROM links WHERE is_pinned = 1 AND deleted_at IS NULL').get();
    if (existing.is_pinned !== 1 && pinnedCount.cnt >= 6) {
      return jsonError(res, '置顶数量不能超过 6 个');
    }
    // 置顶
    const maxOrder = db.prepare('SELECT COALESCE(MAX(pin_order), 0) as max FROM links WHERE is_pinned = 1 AND deleted_at IS NULL').get();
    db.prepare('UPDATE links SET is_pinned = 1, pin_order = ? WHERE id = ?')
      .run(order ?? maxOrder.max + 1, id);
  } else {
    // 取消置顶
    db.prepare('UPDATE links SET is_pinned = 0, pin_order = 0 WHERE id = ?').run(id);
  }

  const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);

  console.log(`[${new Date().toISOString()}] [书签] [置顶] [成功] ${existing.name} -> ${pinned ? '置顶' : '取消'}`);

  return jsonSuccess(res, updated, pinned ? '置顶成功' : '取消置顶成功');
}

/**
 * 切换书签锁定状态
 * PUT /api/links/:id/lock
 * 简化方案：独立开关，只改链接自己的 is_locked，不联动分类
 */
export function toggleLinkLock(req, res) {
  const { id } = req.params;
  const { locked } = req.body;

  const existing = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    return jsonError(res, '书签不存在');
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

  // 更新链接锁定状态
  db.prepare('UPDATE links SET is_locked = ? WHERE id = ?').run(newLocked, id);

  // 递增加密版本号，让旧的 vaultToken 失效
  db.prepare('UPDATE admin SET lock_version = lock_version + 1 WHERE id = 1').run();

  console.log(`[${now}] [书签] [锁定] [成功] ${existing.name} -> ${locked ? '锁定' : '解锁'}`);

  return jsonSuccess(res, { id: Number(id), is_locked: newLocked }, locked ? '已加密' : '已解密');
}

/**
 * 手动获取书签 favicon
 * POST /api/links/:id/fetch-favicon
 */
export async function fetchFaviconSync(req, res) {
  const { id } = req.params;

  const link = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!link) {
    return jsonError(res, '书签不存在');
  }

  try {
    const domain = normalizeDomain(new URL(link.url).hostname);
    // SSRF 防护：仅允许公网域名
    if (!domain || !(await isValidPublicDomain(domain))) {
      db.prepare('UPDATE links SET favicon_status = ? WHERE id = ?').run('fail', Number(id));
      return jsonSuccess(res, { favicon_path: '', favicon_status: 'fail' }, 'URL 域名无效，无法抓取图标');
    }

    // 与按 URL 入口共用同一套抓取核心流程（清除失败记录 → 查缓存 → 同步抓取）
    const fileName = await fetchFaviconByDomain(domain);

    if (!fileName) {
      db.prepare('UPDATE links SET favicon_status = ? WHERE id = ?').run('fail', Number(id));
      console.log(`[${new Date().toISOString()}] [书签] [手动获取图标] [失败] ${link.name}`);
      return jsonSuccess(res, { favicon_path: '', favicon_status: 'fail' }, '未获取到图标，将使用字母头像');
    }

    // 写路径到指定书签 + 标记成功
    db.prepare('UPDATE links SET favicon_path = ?, favicon_status = ? WHERE id = ?').run(fileName, 'ok', Number(id));

    console.log(`[${new Date().toISOString()}] [书签] [手动获取图标] [成功] ${link.name}`);
    return jsonSuccess(res, { favicon_path: fileName, favicon_status: 'ok' }, '图标获取成功');
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [书签] [手动获取图标] [异常] ${link.name} ${err.message}`);
    return jsonSuccess(res, { favicon_path: '', favicon_status: 'fail' }, '图标获取失败，请稍后重试');
  }
}

/** 释放响应体连接（重定向/非 200 时调用，避免连接泄漏） */
async function drainBody(response) {
  try {
    if (response.body) await response.body.cancel();
  } catch { /* 忽略 */ }
}

/**
 * 按页面编码解码 HTML 内容
 * 依次尝试：响应头 charset → HTML <meta> charset → BOM → utf-8（大量乱码时回退 gbk）
 * @param {Buffer} buffer
 * @param {string} contentType 响应头 Content-Type
 * @returns {string}
 */
function decodeHtml(buffer, contentType) {
  // BOM 检测（utf-8 BOM）
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf-8');
  }

  let charset = '';
  // 1. 响应头 Content-Type 中的 charset
  const ctCharset = (contentType || '').toLowerCase().match(/charset=["']?([\w-]+)/);
  if (ctCharset) charset = ctCharset[1];
  // 2. HTML <meta> 中的 charset（扫描头部 4096 字节）
  if (!charset) {
    const head = buffer.subarray(0, 4096).toString('ascii').toLowerCase();
    const metaCharset = head.match(/charset=["']?([\w-]+)/);
    if (metaCharset) charset = metaCharset[1];
  }
  // 3. 按检测到的编码解码
  if (charset) {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch { /* 不支持的编码，走默认解码 */ }
  }
  // 4. 默认 utf-8；若出现大量替换符（乱码），回退尝试 gbk
  const utf8Text = buffer.toString('utf-8');
  const utf8Replacement = (utf8Text.match(/\uFFFD/g) || []).length;
  if (utf8Replacement > 0) {
    try {
      const gbkText = new TextDecoder('gbk').decode(buffer);
      const gbkReplacement = (gbkText.match(/\uFFFD/g) || []).length;
      if (gbkReplacement < utf8Replacement) return gbkText;
    } catch { /* gbk 不可用时保持 utf-8 */ }
  }
  return utf8Text;
}

/**
 * 获取网页标题
 * GET /api/links/fetch-title?url=xxx
 * 安全：出站前逐跳校验 hostname（防 SSRF），仅允许公网地址；重定向手动跟随并逐跳校验
 */
export async function fetchPageTitle(req, res) {
  const { url } = req.query;
  if (!url) {
    return jsonError(res, '缺少 url 参数');
  }

  try {
    // 解析并校验初始 URL（协议限定 http/https）
    let currentUrl;
    try {
      currentUrl = new URL(url);
    } catch {
      return jsonError(res, 'URL 格式不合法');
    }
    if (!['http:', 'https:'].includes(currentUrl.protocol)) {
      return jsonError(res, 'URL 必须以 http:// 或 https:// 开头');
    }

    // 手动跟随重定向（最多 5 跳），每跳校验目标 host，防止跳转到内网
    const MAX_REDIRECTS = 5;
    const MAX_SIZE = 65536;
    let html = null;
    let isHtml = false;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // SSRF 防护：当前跳目标必须为公网主机（内网/回环/链路本地拒绝）
      if (!(await isPublicHostname(currentUrl.hostname))) {
        return jsonError(res, '该地址不允许访问（内网地址）');
      }

      // 请求页面 HTML，超时 5 秒
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        response = await fetch(currentUrl.toString(), {
          signal: controller.signal,
          redirect: 'manual', // 手动控制跳转，逐跳校验目标
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0)' },
        });
      } finally {
        clearTimeout(timeout);
      }

      // 3xx：解析下一跳地址并继续（兼容相对跳转）
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await drainBody(response);
        if (!location) {
          return jsonError(res, `请求失败 (${response.status})`);
        }
        try {
          currentUrl = new URL(location, currentUrl);
        } catch {
          return jsonError(res, '重定向地址不合法');
        }
        continue;
      }

      if (!response.ok) {
        await drainBody(response);
        return jsonError(res, `请求失败 (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      isHtml = contentType.includes('text/html');

      // 只读取前 64KB，标题通常在头部
      const reader = response.body.getReader();
      const chunks = [];
      let totalSize = 0;
      while (totalSize < MAX_SIZE) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalSize += value.length;
      }
      reader.cancel();
      // 按页面编码解码（GBK/GB2312 老站也能正确解析标题）
      html = decodeHtml(Buffer.concat(chunks), contentType);
      break;
    }

    if (html === null) {
      return jsonError(res, '重定向次数过多');
    }
    if (!isHtml) {
      return jsonError(res, '该 URL 不是 HTML 页面');
    }

    // 提取 <title> 标签内容
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) {
      return jsonError(res, '未找到页面标题');
    }

    // 清理标题：去除空白、换行、HTML 实体
    const title = match[1]
      .replace(/\s+/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!title) {
      return jsonError(res, '页面标题为空');
    }

    console.log(`[${new Date().toISOString()}] [书签] [获取标题] [成功] ${url} → ${title}`);
    return jsonSuccess(res, { title }, '获取成功');
  } catch (err) {
    const reason = err.name === 'AbortError' ? '请求超时' : err.message;
    console.log(`[${new Date().toISOString()}] [书签] [获取标题] [失败] ${url} ${reason}`);
    // 不向客户端泄露内部错误细节，仅输出到日志
    return jsonError(res, '获取标题失败，请稍后重试');
  }
}

/* ---------- 链接可用性检测（批量执行统一走 utils/healthRunner.js，与定时巡检共用） ---------- */

/**
 * 检测单个链接可用性
 * POST /api/links/:id/check
 * 同步等待结果（最长约 8s：直连 5s + DoH 3s），Node 异步 I/O 不阻塞其他请求
 */
export async function checkLink(req, res) {
  const { id } = req.params;

  const link = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!link) {
    return jsonError(res, '书签不存在');
  }

  const result = await checkLinkHealth(link.url);
  persistHealth(Number(id), result);

  console.log(`[${new Date().toISOString()}] [书签] [可用性检测] [${result.status}] ${link.name} (${result.ms}ms)`);

  // S9 修复：生产环境将详细网络诊断模糊化为通用提示。
  // 详细诊断（DNS 解析失败/连接被拒绝等）仍完整持久化到数据库供后台巡检视图使用，
  // 此处仅对外部响应做脱敏，避免泄露内网可达性探测信息。
  const isProd = process.env.NODE_ENV === 'production';
  const note = isProd && (result.status === 'fail' || result.status === 'blocked')
    ? '站点不可达，请稍后重试'
    : result.note;

  return jsonSuccess(res, {
    id: Number(id),
    status: result.status,
    httpCode: result.httpCode,
    ms: result.ms,
    note,
    checkedAt: new Date().toISOString(),
  }, '检测完成');
}

/**
 * 批量检测所有链接可用性（后台任务 + 轮询进度）
 * POST /api/links/check-all
 * 执行统一走 healthRunner（含任务锁、并发、同域名节流与进度维护）
 */
export async function checkAllLinks(req, res) {
  const links = db.prepare('SELECT id, url FROM links WHERE deleted_at IS NULL ORDER BY id ASC').all();
  if (!links.length) {
    return jsonError(res, '没有可检测的书签');
  }

  const { started } = startHealthBatch(links, { logTag: '批量检测', triggerType: 'manual' });
  if (!started) {
    return jsonError(res, '已有批量检测任务进行中');
  }
  return jsonSuccess(res, { total: links.length, started: true }, `批量检测已启动，共 ${links.length} 条`);
}

/**
 * 查询批量检测进度
 * GET /api/links/check-progress
 */
export function getCheckProgress(req, res) {
  return jsonSuccess(res, getHealthBatchProgress());
}

/* ---------- 异常链接批量处理（巡检页新功能） ---------- */

/**
 * 异常链接分页列表（供批量处理页面）
 * GET /api/links/issues?page=1&pageSize=20
 * 非正常状态（down/fail/blocked/skip/未检测）按严重度排序
 */
export function getIssues(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);

  const where = `WHERE deleted_at IS NULL AND (health_status IS NULL OR health_status != 'ok')`;
  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM links ${where}`).get();
  const rows = db.prepare(`
    SELECT id, name, url, domain, favicon_path, avatar_text, avatar_color,
           health_status, fail_streak, last_check_at, tls_expires_at
    FROM links ${where}
    ORDER BY CASE health_status
        WHEN 'down' THEN 0
        WHEN 'fail' THEN 1
        WHEN 'blocked' THEN 2
        WHEN 'skip' THEN 3
        ELSE 4 END ASC,
        last_check_at IS NULL DESC, last_check_at ASC
    LIMIT ? OFFSET ?
  `).all(pageSize, (page - 1) * pageSize);

  return jsonSuccess(res, { rows, total, page, pageSize });
}

/**
 * 批量重新检测指定链接（后台任务，复用 healthRunner 任务锁）
 * POST /api/links/batch-check
 */
export async function batchCheckLinks(req, res) {
  const { ids } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const links = db.prepare(
    `SELECT id, url, domain FROM links WHERE deleted_at IS NULL AND id IN (${placeholders})`
  ).all(...ids);
  if (!links.length) {
    return jsonError(res, '没有可检测的书签');
  }

  const { started } = startHealthBatch(links, { logTag: '批量重检', triggerType: 'manual' });
  if (!started) {
    return jsonError(res, '已有检测任务进行中，请稍后再试');
  }
  return jsonSuccess(res, { total: links.length, started: true }, `已启动对 ${links.length} 条链接的重新检测`);
}

/**
 * 批量重置链接健康状态（清空判死/失败记录，排入下次巡检优先队列）
 * PUT /api/links/health/reset
 */
export function resetHealthBatch(req, res) {
  const { ids } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const { changes } = db.prepare(
    `UPDATE links SET health_status = NULL, fail_streak = 0, last_check_at = NULL
     WHERE deleted_at IS NULL AND id IN (${placeholders})`
  ).run(...ids);
  return jsonSuccess(res, { reset: changes }, `已重置 ${changes} 条链接的检测状态`);
}

/* ============================== favicon 兜底 API（原 faviconController.js 合并） ============================== */

/** 7 天浏览器强缓存 */
const CACHE_MAX_AGE = 604800;

/** 透明 1x1 PNG（base64）— 占位图 */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * 将 domain 的 favicon_path 同步到数据库（供前端走快速路径）
 * @param {string} domain
 * @param {string} fileName
 */
function syncFaviconToDb(domain, fileName) {
  try {
    // 跳过 up- 前缀的自定义上传图标，避免批量同步覆盖用户手动设置的图标
    const info = db.prepare(
      "UPDATE links SET favicon_path = ?, favicon_status = ? WHERE domain = ? AND (favicon_path IS NULL OR (favicon_path NOT LIKE 'up-%' AND favicon_path != ?))"
    ).run(fileName, 'ok', domain, fileName);
    if (info.changes > 0) {
      console.log(`[${new Date().toISOString()}] [favicon] [同步DB] 更新 ${info.changes} 条链接 favicon_path=${fileName}`);
    }
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [同步DB] [失败] ${err.message}`);
  }
}

/**
 * 后台异步抓取 favicon（不阻塞响应）
 * @param {string} domain
 */
function triggerBackgroundFetch(domain) {
  fetchFromSources(domain)
    .then(async (buffer) => {
      if (buffer) {
        await saveToCache(domain, buffer, 'png');
        await clearFailedRecord(domain);
        const fileName = `${hashDomain(domain)}.png`;
        syncFaviconToDb(domain, fileName);
        console.log(`[${new Date().toISOString()}] [favicon] [兜底API] [后台抓取成功] domain=${domain}`);
      } else {
        await markAsFailed(domain);
        console.log(`[${new Date().toISOString()}] [favicon] [兜底API] [后台抓取失败] domain=${domain}`);
      }
    })
    .catch(async () => {
      await markAsFailed(domain);
    });
}

/**
 * 按文件头魔数探测图片真实 MIME。
 * favicon 磁盘文件内容保持抓取源的原始格式（ICO/GIF/SVG 等，仅文件名统一 .png），
 * 返回图片时需按真实格式声明 Content-Type，避免 MIME 与实际内容不符。
 */
function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return 'image/png';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  // ICO: 00 00 01 00
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return 'image/x-icon';
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp';
  // SVG: 文本检测（<?xml 或 <svg）
  const head = buffer.slice(0, 200).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml';
  // 未知格式：回退 PNG（浏览器内容嗅探通常仍能正常显示）
  return 'image/png';
}

/**
 * 返回占位图：1 小时浏览器缓存（favicon 缺失/抓取失败时，减少重复请求，避免拖慢页面）
 */
function sendFaviconPlaceholder(res) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.end(PLACEHOLDER_PNG);
}

/**
 * GET /api/favicon?domain=example.com
 */
export async function getFavicon(req, res) {
  const { domain: rawDomain } = req.query;

  // 参数校验
  if (!rawDomain || typeof rawDomain !== 'string') {
    return res.status(400).json({ code: 400, message: '缺少 domain 参数', data: null });
  }

  const domain = normalizeDomain(rawDomain);

  // 失败缓存命中（24h）：直接返回占位图，跳过 DNS 解析与抓取，避免慢域名阻塞页面加载
  if (await isRecentlyFailed(domain)) {
    return sendFaviconPlaceholder(res);
  }

  // SSRF 防护：仅允许公网域名（拒绝内网/端口/路径/IP 直连）
  const classify = await classifyHostname(domain);
  // 解析失败（域名不存在/DNS 无响应）：写失败缓存并返回占位图，避免每次重复 DNS 超时阻塞页面
  if (classify === 'unresolved') {
    await markAsFailed(domain);
    return sendFaviconPlaceholder(res);
  }
  if (classify !== 'public') {
    return res.status(400).json({ code: 400, message: 'domain 参数无效', data: null });
  }

  try {
    // ① 查内存/磁盘缓存（快速路径）
    const buffer = await getCachedFavicon(domain);

    // ② 命中：立即返回图片 + 7 天强缓存 + 同步更新数据库
    if (buffer) {
      const fileName = `${hashDomain(domain)}.png`;
      syncFaviconToDb(domain, fileName);

      res.setHeader('Content-Type', detectImageMime(buffer));
      res.setHeader('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
      return res.end(buffer);
    }

    // ③ 未命中：返回占位图（1h 浏览器缓存）+ 后台异步触发抓取，不阻塞响应
    triggerBackgroundFetch(domain);
    return sendFaviconPlaceholder(res);
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [兜底API] [异常] ${err.message}`);
    return sendFaviconPlaceholder(res);
  }
}

/**
 * POST /api/favicon/fetch
 * 按 URL 手动抓取 favicon（创建书签时使用，无需 linkId）
 * body: { url: 'https://github.com' }
 * 返回: { favicon_path: 'abc123.png' }
 */
export async function fetchFaviconByUrl(req, res) {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ code: 400, message: '缺少 url 参数', data: null });
  }

  try {
    const domain = normalizeDomain(new URL(url).hostname);
    // SSRF 防护：仅允许公网域名
    if (!domain || !(await isValidPublicDomain(domain))) {
      return res.status(400).json({ code: 400, message: 'URL 域名无效', data: null });
    }

    // 共用抓取核心流程：清除失败记录 → 查缓存 → 未命中同步抓取 → 写缓存
    const fileName = await fetchFaviconByDomain(domain);

    if (!fileName) {
      console.log(`[${new Date().toISOString()}] [favicon] [手动抓取] [失败] domain=${domain}`);
      return res.status(200).json({ code: 200, message: '未获取到图标，将使用字母头像', data: { favicon_path: '' } });
    }

    // 同步到所有匹配域名的书签
    syncFaviconToDb(domain, fileName);

    console.log(`[${new Date().toISOString()}] [favicon] [手动抓取] [成功] domain=${domain}`);
    return res.status(200).json({ code: 200, message: '图标获取成功', data: { favicon_path: fileName } });
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [手动抓取] [异常] ${err.message}`);
    return res.status(200).json({ code: 200, message: '图标获取失败，请稍后重试', data: { favicon_path: '' } });
  }
}

/* ------------------------------ 自定义图标上传 ------------------------------ */

/**
 * 校验 base64 图片是否合法（魔数 + 大小限制）
 * @param {string} dataUrl data:image/xxx;base64,xxxx 格式
 * @returns {Buffer|null} 合法返回解码后的 Buffer，否则 null
 */
function decodeUploadDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp|ico|x-icon|svg\+xml);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  const buffer = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (buffer.length < 4 || buffer.length > 512 * 1024) return null;
  if (!isImageBuffer(buffer)) return null;
  return buffer;
}

/**
 * 上传自定义 favicon 图标（编辑弹窗内手动上传）
 * POST /api/links/:id/upload-favicon
 * body: { dataUrl: 'data:image/png;base64,...' }
 * 返回: { favicon_path: 'up-xxx.png' }
 */
export async function uploadFaviconCustom(req, res) {
  const { id } = req.params;
  const { dataUrl } = req.body;

  const link = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!link) {
    return jsonError(res, '书签不存在');
  }

  const buffer = decodeUploadDataUrl(dataUrl);
  if (!buffer) {
    return jsonError(res, '图标数据无效（仅支持 PNG/JPEG/GIF/WebP/ICO/SVG，≤512KB）');
  }

  // 自定义图标文件名带 up- 前缀（与自动抓取的域名哈希文件名区分，避免被 syncFaviconToDb 覆盖）
  const fileName = `up-${hashDomain(link.domain || new URL(link.url).hostname)}-${randomBytes(4).toString('hex')}.png`;
  try {
    await writeFile(join(FAVICON_DIR, fileName), buffer);
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [自定义上传] [失败] linkId=${id} ${err.message}`);
    return jsonError(res, '图标保存失败');
  }

  db.prepare('UPDATE links SET favicon_path = ?, favicon_status = ? WHERE id = ?').run(fileName, 'ok', Number(id));

  console.log(`[${new Date().toISOString()}] [favicon] [自定义上传] [成功] ${link.name} -> ${fileName}`);
  return jsonSuccess(res, { favicon_path: fileName }, '图标上传成功');
}

/**
 * 移除书签 favicon（回退字母头像）
 * DELETE /api/links/:id/favicon
 */
export async function removeFaviconCustom(req, res) {
  const { id } = req.params;

  const link = db.prepare('SELECT * FROM links WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!link) {
    return jsonError(res, '书签不存在');
  }

  // 清理旧自定义图标文件（仅删除 up- 前缀的上传文件，自动抓取的共享文件不删）
  if (link.favicon_path && link.favicon_path.startsWith('up-')) {
    try {
      if (existsSync(join(FAVICON_DIR, link.favicon_path))) {
        unlinkSync(join(FAVICON_DIR, link.favicon_path));
      }
    } catch { /* 忽略删除失败 */ }
  }

  db.prepare('UPDATE links SET favicon_path = NULL, favicon_status = NULL WHERE id = ?').run(id);

  console.log(`[${new Date().toISOString()}] [favicon] [移除图标] [成功] ${link.name}`);
  return jsonSuccess(res, null, '已移除图标');
}
