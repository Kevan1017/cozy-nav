/**
 * 统计控制器
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';

/** 本地日期格式化 YYYY-MM-DD（避免 toISOString 时区偏移一天） */
function fmtDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 生成最近 N 天（含今天）的本地日期列表 */
function buildDayList(days) {
  const list = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    list.push(fmtDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return list;
}

/**
 * 获取数据概览
 * GET /api/stats/overview
 */
export function getOverview(req, res) {
  const linkCount = db.prepare('SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL').get();
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL').get();
  const pinnedCount = db.prepare('SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL AND is_pinned = 1').get();
  const recentLinks = db.prepare("SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL AND created_at >= datetime('now', '-7 days')").get();
  const totalVisits = db.prepare('SELECT COALESCE(SUM(visit_count), 0) as total FROM links WHERE deleted_at IS NULL').get();
  const todayVisits = db.prepare("SELECT COUNT(*) as count FROM visit_logs WHERE date(visited_at, 'localtime') = date('now', 'localtime')").get();

  return jsonSuccess(res, {
    linkCount: linkCount.count,
    categoryCount: categoryCount.count,
    pinnedCount: pinnedCount.count,
    recentLinks: recentLinks.count,
    totalVisits: totalVisits.total,
    todayVisits: todayVisits.count,
  });
}

/**
 * 热门链接 TOP N
 * GET /api/stats/links/top?days=7&limit=5
 * 近 N 天访问次数最多的书签（已软删除的不计入）
 */
export function getTopLinks(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

  const rows = db.prepare(`
    SELECT l.id, l.name, l.domain, l.favicon_path, COUNT(v.id) AS visits
    FROM visit_logs v
    JOIN links l ON l.id = v.link_id AND l.deleted_at IS NULL
    WHERE date(v.visited_at, 'localtime') >= date('now', 'localtime', ?)
    GROUP BY v.link_id
    ORDER BY visits DESC, l.name ASC
    LIMIT ?
  `).all(`-${days - 1} days`, limit);

  return jsonSuccess(res, { days, rows });
}

/**
 * 近 N 天每日访问趋势
 * GET /api/stats/visits/trend?days=7
 * 返回含全部日期的数组，无访问的天数补 0，方便前端直接绘图
 */
export function getVisitTrend(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);

  const rows = db.prepare(`
    SELECT date(visited_at, 'localtime') AS day, COUNT(*) AS count
    FROM visit_logs
    WHERE date(visited_at, 'localtime') >= date('now', 'localtime', ?)
    GROUP BY day
    ORDER BY day
  `).all(`-${days - 1} days`);

  const countMap = Object.fromEntries(rows.map((r) => [r.day, r.count]));
  const data = buildDayList(days).map((day) => ({ day, count: countMap[day] || 0 }));

  return jsonSuccess(res, { days, data });
}

/** 读取巡检配置中 TLS 告警阈值（默认黄 30 天 / 红 7 天，异常回退默认） */
function getTlsConfig() {
  const row = db.prepare('SELECT health_config FROM preferences WHERE id = 1').get();
  if (row?.health_config) {
    try {
      const cfg = JSON.parse(row.health_config);
      return {
        yellow: Math.max(1, parseInt(cfg.tlsYellowDays, 10) || 30),
        red: Math.max(1, parseInt(cfg.tlsRedDays, 10) || 7),
      };
    } catch { /* 解析失败回退默认 */ }
  }
  return { yellow: 30, red: 7 };
}

/**
 * 链接健康总览
 * GET /api/stats/links/health
 * 返回各健康状态数量 + TLS 即将到期列表（黄/红分级）+ 连续失败 TOP
 */
export function getHealthOverview(req, res) {
  // 状态分布（未检测的 health_status 为 NULL，归入 unknown）
  const rows = db.prepare(`
    SELECT health_status, COUNT(*) AS count FROM links
    WHERE deleted_at IS NULL GROUP BY health_status
  `).all();
  const stat = { ok: 0, blocked: 0, fail: 0, down: 0, skip: 0, unknown: 0, total: 0 };
  for (const r of rows) {
    const key = r.health_status || 'unknown';
    if (stat[key] !== undefined) stat[key] = r.count;
    else stat.unknown += r.count;
    stat.total += r.count;
  }

  // TLS 即将到期（剩余天数 ≤ 黄色阈值即列出，≤ 红色阈值标记 red），按剩余天数升序
  const { yellow, red } = getTlsConfig();
  const tlsRows = db.prepare(`
    SELECT id, name, domain, tls_expires_at FROM links
    WHERE deleted_at IS NULL AND tls_expires_at IS NOT NULL
      AND tls_expires_at <= datetime('now', '+' || :days || ' days')
    ORDER BY tls_expires_at ASC
    LIMIT 20
  `).all({ days: yellow });
  const now = Date.now();
  const tlsExpiring = tlsRows.map((r) => {
    const daysLeft = Math.max(0, Math.ceil((new Date(r.tls_expires_at).getTime() - now) / 86400000));
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      tlsExpiresAt: r.tls_expires_at,
      daysLeft,
      level: daysLeft <= red ? 'red' : 'yellow',
    };
  });

  // 连续失败 TOP（含 1 次，便于排查）
  const failTop = db.prepare(`
    SELECT id, name, domain, fail_streak, last_check_at FROM links
    WHERE deleted_at IS NULL AND fail_streak >= 1
    ORDER BY fail_streak DESC, last_check_at ASC
    LIMIT 10
  `).all();

  // 异常链接清单：所有非正常状态（含未检测），按严重度排序，最多 50 条
  const issueRows = db.prepare(`
    SELECT id, name, domain, url, health_status, fail_streak, tls_expires_at, last_check_at FROM links
    WHERE deleted_at IS NULL
      AND (health_status IS NULL OR health_status != 'ok')
    ORDER BY
      CASE health_status
        WHEN 'down' THEN 0 WHEN 'fail' THEN 1 WHEN 'blocked' THEN 2
        WHEN 'skip' THEN 3 ELSE 4 END ASC,
      last_check_at IS NULL DESC, last_check_at ASC
    LIMIT 50
  `).all();
  const issueList = issueRows.map((r) => {
    // 附带 TLS 预警（仅当在黄色阈值内）
    let tls = null;
    if (r.tls_expires_at) {
      const daysLeft = Math.max(0, Math.ceil((new Date(r.tls_expires_at).getTime() - now) / 86400000));
      if (daysLeft <= yellow) tls = { tlsExpiresAt: r.tls_expires_at, daysLeft, level: daysLeft <= red ? 'red' : 'yellow' };
    }
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      url: r.url,
      status: r.health_status || 'unknown',
      failStreak: r.fail_streak || 0,
      tls,
      lastCheckAt: r.last_check_at,
    };
  });

  return jsonSuccess(res, { ...stat, tlsExpiring, failTop, issueList });
}

/**
 * 冷链接列表（N 天未访问或从未访问）
 * GET /api/stats/links/cold?days=90
 * 按最后访问升序、访问次数升序，供后续清理依据
 */
export function getColdLinks(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 1), 365);
  const rows = db.prepare(`
    SELECT id, name, domain, url, visit_count, last_visited, created_at FROM links
    WHERE deleted_at IS NULL
      AND (last_visited IS NULL OR last_visited < datetime('now', :daysAgo))
    ORDER BY last_visited IS NOT NULL ASC, last_visited ASC, visit_count ASC
    LIMIT 50
  `).all({ daysAgo: `-${days} days` });

  return jsonSuccess(res, { days, count: rows.length, rows });
}

/** 解析报告行：补充异常链接数量，隐藏原始 issue_links JSON 串 */
function decorateReport(r) {
  let issueCount = 0;
  try {
    issueCount = JSON.parse(r.issue_links || '[]').length;
  } catch { /* 损坏数据按 0 处理 */ }
  const { issue_links, ...rest } = r;
  return { ...rest, issueCount };
}

/**
 * 巡检历史报告列表
 * GET /api/stats/patrol/reports?page=1&pageSize=10 （分页列表）
 * GET /api/stats/patrol/reports?limit=10          （取最近 N 条，供趋势图）
 */
export function getPatrolReports(req, res) {
  // limit 模式：不分页，取最近 N 条
  const limit = parseInt(req.query.limit, 10) || 0;
  if (limit > 0) {
    const rows = db.prepare('SELECT * FROM patrol_reports ORDER BY id DESC LIMIT ?').all(limit);
    return jsonSuccess(res, { rows: rows.map(decorateReport) });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const { c: total } = db.prepare('SELECT COUNT(*) AS c FROM patrol_reports').get();
  const rows = db.prepare('SELECT * FROM patrol_reports ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize, (page - 1) * pageSize);
  return jsonSuccess(res, { rows: rows.map(decorateReport), total, page, pageSize });
}

/**
 * 巡检报告详情（含本轮异常链接明细）
 * GET /api/stats/patrol/reports/:id
 */
export function getPatrolReportDetail(req, res) {
  const report = db.prepare('SELECT * FROM patrol_reports WHERE id = ?').get(req.params.id);
  if (!report) {
    return jsonError(res, '巡检报告不存在', 404);
  }

  let snapshot = [];
  try {
    snapshot = JSON.parse(report.issue_links || '[]');
  } catch { /* 损坏数据按空处理 */ }

  // 按快照 id 关联当前链接信息（已删除的标记 gone，仅显示快照状态）
  const issues = snapshot.map(({ id, status }) => {
    const link = db.prepare('SELECT id, name, url, domain, health_status, fail_streak FROM links WHERE id = ?').get(id);
    return link
      ? { id, name: link.name, url: link.url, domain: link.domain, failStreak: link.fail_streak, status }
      : { id, status, gone: true };
  });

  return jsonSuccess(res, { ...decorateReport(report), issues });
}

/**
 * 收藏时光机：指定日期当天收藏的书签 + 当天访问轨迹
 * GET /api/stats/day/detail?date=YYYY-MM-DD【鉴权】
 */
export function getDayDetail(req, res) {
  const date = req.query.date;

  // 当天收藏的书签（按创建时间倒序，新收藏在前）
  const collected = db.prepare(`
    SELECT l.id, l.name, l.url, l.domain, l.favicon_path, l.avatar_text, l.avatar_color,
           c.name AS category_name, l.created_at
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.deleted_at IS NULL AND date(l.created_at, 'localtime') = ?
    ORDER BY l.created_at DESC
  `).all(date);

  // 当天访问轨迹（同一书签合并计数，按首次访问正序）
  const visited = db.prepare(`
    SELECT l.id AS link_id, l.name, l.url, l.domain, l.favicon_path, l.avatar_text, l.avatar_color,
           c.name AS category_name,
           strftime('%H:%M', MIN(v.visited_at), 'localtime') AS time,
           COUNT(*) AS count
    FROM visit_logs v
    JOIN links l ON l.id = v.link_id AND l.deleted_at IS NULL
    LEFT JOIN categories c ON c.id = l.category_id AND c.deleted_at IS NULL
    WHERE date(v.visited_at, 'localtime') = ?
    GROUP BY v.link_id
    ORDER BY MIN(v.visited_at) ASC
  `).all(date);

  return jsonSuccess(res, { date, collected, visited });
}

/**
 * 时光机日历标记：近 N 天有收藏 / 访问的日期集合
 * GET /api/stats/highlight/days?days=365【鉴权】
 * 返回 [{ date: 'YYYY-MM-DD', collected: bool, visited: bool }]，供日期选择器打点
 */
export function getHighlightDays(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days) || 365, 30), 1095);

  // 有收藏的日期（按本地日期分组）
  const collectedRows = db.prepare(`
    SELECT date(created_at, 'localtime') AS d
    FROM links
    WHERE deleted_at IS NULL AND date(created_at, 'localtime') >= date('now', 'localtime', ?)
    GROUP BY d
  `).all(`-${days} day`);

  // 有访问的日期（按本地日期分组）
  const visitedRows = db.prepare(`
    SELECT date(visited_at, 'localtime') AS d
    FROM visit_logs
    WHERE date(visited_at, 'localtime') >= date('now', 'localtime', ?)
    GROUP BY d
  `).all(`-${days} day`);

  const collectedSet = new Set(collectedRows.map((r) => r.d));
  const visitedSet = new Set(visitedRows.map((r) => r.d));
  const allDates = new Set([...collectedSet, ...visitedSet]);

  const items = [...allDates]
    .sort()
    .map((date) => ({ date, collected: collectedSet.has(date), visited: visitedSet.has(date) }));

  return jsonSuccess(res, { items });
}
