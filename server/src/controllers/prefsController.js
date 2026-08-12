/**
 * 偏好控制器
 */
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { sendServerChan, sendEmail, DEFAULT_NOTIFICATION_CONFIG } from '../utils/notifier.js';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Logo 图片存储目录（app.js 通过 /logo 静态服务对外提供） */
export const LOGO_DIR = join(__dirname, '../../data/logo');
const LOGO_FILE = 'logo.png';
/** Logo 文件大小上限（300KB） */
const LOGO_MAX_SIZE = 300 * 1024;

/** 读取偏好时可选的列 */
const PREFS_COLUMNS =
  'theme, search_engine, engine_display_count, theme_preset, show_domain, no_image, view_mode, view_layout_enabled, sort_enabled, font_family, font_switch_enabled, hero_tagline, festival_enabled, festival_countdown_enabled, idle_mark_enabled, custom_theme, site_title, site_logo, site_keywords, site_description, site_copyright, stat_tagline, health_config, notification_config, category_sort_mode, link_sort_mode';

/** 巡检配置默认值（与 preferences.health_config 结构保持一致） */
const DEFAULT_HEALTH_CONFIG = {
  enabled: true, intervalHours: 24, batchSize: 50, deadStreak: 3, recheckDead: false,
  tlsYellowDays: 30, tlsRedDays: 7, coldDays: 90,
};

/** 通知配置默认值：见 utils/notifier.js（channels 渠道 + events 事件） */

/** 解析巡检配置 health_config 存储的 JSON，损坏时回退默认结构 */
function parseHealthConfig(raw) {
  try {
    const parsed = JSON.parse(raw || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...DEFAULT_HEALTH_CONFIG, ...parsed };
    }
  } catch { /* 解析失败回退 */ }
  return { ...DEFAULT_HEALTH_CONFIG };
}

/** 解析通知配置 notification_config 存储的 JSON，损坏时回退默认结构（兼容旧平铺结构自动迁移） */
function parseNotificationConfig(raw) {
  let parsed = {};
  try {
    parsed = JSON.parse(raw || '');
  } catch { /* 解析失败回退 */ }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // 迁移 1：最早的 serverChanKey 平铺 → serverchan 子模块
    if (parsed.serverChanKey !== undefined && parsed.serverchan === undefined) {
      parsed.serverchan = { enabled: !!parsed.serverChanKey, sendKey: parsed.serverChanKey };
      delete parsed.serverChanKey;
    }
    // 迁移 2：上一代平铺结构（顶层 enabled/strategy/模板 + serverchan/email 子模块）→ channels/events 嵌套
    if (!parsed.channels && (parsed.serverchan || parsed.email)) {
      parsed.channels = { serverchan: parsed.serverchan, email: parsed.email };
      delete parsed.serverchan;
      delete parsed.email;
      if (parsed.strategy !== undefined || parsed.minIssues !== undefined ||
          parsed.titleTemplate !== undefined || parsed.bodyTemplate !== undefined || parsed.enabled !== undefined) {
        parsed.events = {
          patrol: {
            enabled: parsed.enabled ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.enabled,
            strategy: parsed.strategy ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.strategy,
            minIssues: parsed.minIssues ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.minIssues,
            titleTemplate: parsed.titleTemplate ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.titleTemplate,
            bodyTemplate: parsed.bodyTemplate ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.bodyTemplate,
          },
        };
        delete parsed.enabled;
        delete parsed.strategy;
        delete parsed.minIssues;
        delete parsed.titleTemplate;
        delete parsed.bodyTemplate;
      }
    }
    return {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...parsed,
      channels: {
        serverchan: { ...DEFAULT_NOTIFICATION_CONFIG.channels.serverchan, ...(parsed.channels?.serverchan || {}) },
        email: { ...DEFAULT_NOTIFICATION_CONFIG.channels.email, ...(parsed.channels?.email || {}) },
      },
      events: {
        patrol: { ...DEFAULT_NOTIFICATION_CONFIG.events.patrol, ...(parsed.events?.patrol || {}) },
        backup: { ...DEFAULT_NOTIFICATION_CONFIG.events.backup, ...(parsed.events?.backup || {}) },
      },
    };
  }
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_CONFIG));
}

/** 解析 custom_theme 存储的 JSON 字符串，损坏时回退为空对象 */
function parseCustomTheme(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* 解析失败回退 */ }
  return {};
}

/**
 * 获取偏好设置
 * GET /api/preferences
 */
export function getPreferences(req, res) {
  const prefs = db.prepare(`SELECT ${PREFS_COLUMNS} FROM preferences WHERE id = 1`).get();

  if (!prefs) {
    return jsonError(res, '偏好未初始化', 500);
  }

  // HTTP 协商缓存：配合 Express 默认 ETag，偏好未变更时刷新直接 304，挂载前等待更短
  //（main.js 在 Vue 挂载前 await 该接口，缓存命中可显著缩短首屏白屏时间）
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');

  // 剔除敏感字段：notification_config 含邮箱密码 / Server酱 SendKey，仅管理员可读（见 getNotifyConfig）
  const { notification_config, ...publicPrefs } = prefs;

  return jsonSuccess(res, {
    ...publicPrefs,
    custom_theme: parseCustomTheme(prefs.custom_theme),
    health_config: parseHealthConfig(prefs.health_config),
  });
}

/**
 * 获取通知配置（仅管理员）
 * GET /api/preferences/notify-config
 * 公开的 GET /api/preferences 已剔除该字段，防止泄露邮箱授权码 / Server酱 SendKey
 */
export function getNotifyConfig(req, res) {
  const row = db.prepare('SELECT notification_config FROM preferences WHERE id = 1').get();
  if (!row) {
    return jsonError(res, '偏好未初始化', 500);
  }
  return jsonSuccess(res, { notification_config: parseNotificationConfig(row.notification_config) });
}

/**
 * 更新偏好设置
 * PUT /api/preferences
 */
export function updatePreferences(req, res) {
  const {
    theme, search_engine, engine_display_count, theme_preset, show_domain, no_image, view_mode, view_layout_enabled,
    sort_enabled, font_family, font_switch_enabled, hero_tagline, festival_enabled, festival_countdown_enabled,
    idle_mark_enabled, custom_theme, site_title, site_logo, site_keywords, site_description, site_copyright,
    stat_tagline, health_config, notification_config, category_sort_mode, link_sort_mode,
  } = req.body;

  const existing = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  if (!existing) {
    return jsonError(res, '偏好未初始化', 500);
  }

  db.prepare(
    `UPDATE preferences SET theme = ?, search_engine = ?, engine_display_count = ?, theme_preset = ?,
     show_domain = ?, no_image = ?, view_mode = ?, view_layout_enabled = ?, sort_enabled = ?, font_family = ?, font_switch_enabled = ?, hero_tagline = ?,
     festival_enabled = ?, festival_countdown_enabled = ?, idle_mark_enabled = ?, custom_theme = ?,
     site_title = ?, site_logo = ?, site_keywords = ?, site_description = ?, site_copyright = ?,
     stat_tagline = ?, health_config = ?, notification_config = ?, category_sort_mode = ?, link_sort_mode = ?
     WHERE id = 1`
  ).run(
    theme ?? existing.theme,
    search_engine ?? existing.search_engine,
    engine_display_count ?? existing.engine_display_count,
    theme_preset ?? existing.theme_preset,
    show_domain ?? existing.show_domain,
    no_image ?? existing.no_image,
    view_mode ?? existing.view_mode,
    view_layout_enabled ?? existing.view_layout_enabled,
    sort_enabled ?? existing.sort_enabled,
    font_family ?? existing.font_family,
    font_switch_enabled ?? existing.font_switch_enabled,
    hero_tagline ?? existing.hero_tagline,
    festival_enabled ?? existing.festival_enabled,
    festival_countdown_enabled ?? existing.festival_countdown_enabled,
    idle_mark_enabled ?? existing.idle_mark_enabled,
    custom_theme !== undefined ? JSON.stringify(custom_theme) : existing.custom_theme,
    site_title ?? existing.site_title,
    site_logo ?? existing.site_logo,
    site_keywords ?? existing.site_keywords,
    site_description ?? existing.site_description,
    site_copyright ?? existing.site_copyright,
    stat_tagline ?? existing.stat_tagline,
    health_config !== undefined ? JSON.stringify(health_config) : existing.health_config,
    notification_config !== undefined ? JSON.stringify(notification_config) : existing.notification_config,
    category_sort_mode ?? existing.category_sort_mode,
    link_sort_mode ?? existing.link_sort_mode
  );

  const updated = db.prepare(`SELECT ${PREFS_COLUMNS} FROM preferences WHERE id = 1`).get();

  console.log(
    `[${new Date().toISOString()}] [偏好] [更新] [成功] ` +
    `theme=${theme || existing.theme} ` +
    `engine=${search_engine || existing.search_engine} ` +
    `displayCount=${engine_display_count || existing.engine_display_count} ` +
    `preset=${theme_preset || existing.theme_preset} ` +
    `showDomain=${show_domain ?? existing.show_domain} ` +
    `noImage=${no_image ?? existing.no_image} ` +
    `viewMode=${view_mode || existing.view_mode} ` +
    `viewLayoutEnabled=${view_layout_enabled ?? existing.view_layout_enabled} ` +
    `sortEnabled=${sort_enabled ?? existing.sort_enabled} ` +
    `fontFamily=${font_family || existing.font_family} ` +
    `festival=${festival_enabled ?? existing.festival_enabled} ` +
    `festivalCountdown=${festival_countdown_enabled ?? existing.festival_countdown_enabled} ` +
    `idleMark=${idle_mark_enabled ?? existing.idle_mark_enabled} ` +
    `customTheme=${custom_theme !== undefined ? 'updated' : 'kept'} ` +
    `siteTitle=${site_title ?? 'kept'} ` +
    `siteLogo=${site_logo !== undefined ? 'updated' : 'kept'} ` +
    `siteKeywords=${site_keywords !== undefined ? 'updated' : 'kept'} ` +
    `siteDescription=${site_description !== undefined ? 'updated' : 'kept'} ` +
    `siteCopyright=${site_copyright !== undefined ? 'updated' : 'kept'} ` +
    `tagline=${stat_tagline ?? 'kept'} ` +
    `healthConfig=${health_config !== undefined ? 'updated' : 'kept'} ` +
    `notifyConfig=${notification_config !== undefined ? 'updated' : 'kept'} ` +
    `categorySortMode=${category_sort_mode ?? 'kept'} ` +
    `linkSortMode=${link_sort_mode ?? 'kept'}`
  );

  return jsonSuccess(res, {
    ...updated,
    custom_theme: parseCustomTheme(updated.custom_theme),
    health_config: parseHealthConfig(updated.health_config),
    notification_config: parseNotificationConfig(updated.notification_config),
  }, '更新成功');
}

/** 校验 base64 图片是否合法（魔数检测，仅允许 PNG/JPEG/WebP） */
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
}

/**
 * 测试通知渠道（发送一条测试消息，验证渠道配置是否有效）
 * POST /api/preferences/notify-test
 * 请求体：
 * - { channel: 'serverchan', sendKey?: string }   不传 sendKey 则用已保存配置
 * - { channel: 'email', config?: {host,port,user,pass,to} }  不传 config 则用已保存配置
 */
export async function testNotify(req, res) {
  const channel = req.body?.channel || 'serverchan';
  const row = db.prepare('SELECT notification_config FROM preferences WHERE id = 1').get();
  const saved = parseNotificationConfig(row?.notification_config);

  if (channel === 'serverchan') {
    let sendKey = req.body?.sendKey || '';
    if (!sendKey) sendKey = saved.channels?.serverchan?.sendKey || '';
    if (!sendKey) {
      return jsonError(res, '请先填写 Server酱 SendKey');
    }
    const ok = await sendServerChan({
      key: sendKey,
      title: 'cozy·nav 通知测试',
      desp: '如果你收到这条消息，说明 Server酱通知配置正常 ✅',
    });
    return ok
      ? jsonSuccess(res, null, '测试消息已发送，请查看微信')
      : jsonError(res, '发送失败，请检查 SendKey 是否正确');
  }

  if (channel === 'email') {
    const cfg = req.body?.config || saved.channels?.email || {};
    if (!cfg.user || !cfg.pass || !cfg.to) {
      return jsonError(res, '请先完整填写邮箱配置（发件邮箱/授权码/收件邮箱）');
    }
    const ok = await sendEmail({
      config: cfg,
      title: 'cozy·nav 通知测试',
      desp: '如果你收到这封邮件，说明 QQ 邮箱通知配置正常 ✅',
    });
    return ok
      ? jsonSuccess(res, null, '测试邮件已发送，请查收邮箱')
      : jsonError(res, '发送失败，请检查邮箱配置（尤其授权码与 SMTP 端口）');
  }

  return jsonError(res, '不支持的测试渠道');
}

/**
 * 上传站点 Logo
 * POST /api/preferences/logo
 * 请求体：{ data: 'data:image/png;base64,...' }
 * 存储为固定文件名 logo.png（覆盖式），路径写入 preferences.site_logo
 */
export async function uploadLogo(req, res) {
  const { data } = req.body;

  // 校验 base64 data URL 格式
  if (!data || typeof data !== 'string' || !data.startsWith('data:image/')) {
    return jsonError(res, '请选择有效的图片');
  }
  const comma = data.indexOf(',');
  if (comma < 0) {
    return jsonError(res, '图片数据格式不正确');
  }
  const mimeMatch = data.slice(0, comma).match(/^data:(image\/(?:png|jpeg|webp));base64$/i);
  if (!mimeMatch) {
    return jsonError(res, '仅支持 PNG / JPG / WebP 格式的图片');
  }

  const buffer = Buffer.from(data.slice(comma + 1), 'base64');
  if (!buffer.length) {
    return jsonError(res, '图片内容为空');
  }
  if (buffer.length > LOGO_MAX_SIZE) {
    return jsonError(res, '图片大小需小于 300KB');
  }
  if (!isValidImageBuffer(buffer)) {
    return jsonError(res, '图片文件格式无效');
  }

  try {
    await mkdir(LOGO_DIR, { recursive: true });
    await writeFile(join(LOGO_DIR, LOGO_FILE), buffer);
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [偏好] [上传Logo] [失败] ${err.message}`);
    return jsonError(res, 'Logo 保存失败，请重试');
  }

  // 路径带时间戳参数做缓存破坏：图片 URL 每次上传都不同，避免浏览器强缓存显示旧图
  const siteLogo = `/logo/${LOGO_FILE}?v=${Date.now()}`;
  db.prepare('UPDATE preferences SET site_logo = ? WHERE id = 1').run(siteLogo);

  console.log(`[${new Date().toISOString()}] [偏好] [上传Logo] [成功] ${buffer.length} bytes`);
  return jsonSuccess(res, { site_logo: siteLogo }, 'Logo 上传成功');
}

/**
 * 移除站点 Logo（恢复为默认文字 Logo）
 * DELETE /api/preferences/logo
 */
export function removeLogo(req, res) {
  db.prepare('UPDATE preferences SET site_logo = ? WHERE id = 1').run('');
  const filePath = join(LOGO_DIR, LOGO_FILE);
  if (existsSync(filePath)) {
    unlink(filePath).catch(() => { /* 忽略删除失败 */ });
  }
  console.log(`[${new Date().toISOString()}] [偏好] [移除Logo] [成功]`);
  return jsonSuccess(res, { site_logo: '' }, '已移除 Logo');
}
