/**
 * 偏好路由
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { getPreferences, getNotifyConfig, updatePreferences, uploadLogo, removeLogo, testNotify } from '../controllers/prefsController.js';

const router = Router();

/** 自定义配色允许覆盖的 CSS 变量白名单（与前端设置面板保持一致） */
const CUSTOM_THEME_KEYS = [
  // 前台（页面背景 + blob 光斑）
  '--bg', '--blob-1', '--blob-2', '--blob-3', '--blob-4',
  // 顶栏独立变量
  '--topbar-logo', '--topbar-logo2', '--topbar-logo-ink', '--topbar-name',
  '--topbar-sub', '--topbar-pill-border', '--topbar-icon',
  // Hero 区域独立变量
  '--hero-greet', '--hero-title', '--hero-title-pop', '--hero-handwrite',
  '--hero-desc', '--hero-desc-strong',
  // 统计卡片 + 搜索框独立变量
  '--stat-card', '--stat-card2', '--stat-peach', '--stat-mint', '--stat-ink', '--stat-site-text',
  '--stat-cat-ink', '--stat-cat-text', '--stat-fest-ink', '--stat-fest-text', '--stat-label',
  '--search-bg', '--search-border', '--search-ink', '--search-placeholder',
  '--search-btn', '--search-btn2', '--search-btn-ink', '--search-eng-on', '--search-eng-ink',
  // 置顶栏独立变量
  '--pin-title', '--pin-sub', '--pin-line', '--pin-card', '--pin-name',
  '--pin-rank', '--pin-shadow', '--pin-empty-border', '--pin-empty-text',
  // 分类卡独立变量
  '--cat-card', '--cat-title', '--cat-sub', '--cat-count', '--cat-count-bg',
  '--cat-shadow', '--cat-accent', '--cat-lock-border',
  // 书签条目独立变量
  '--link-bg', '--link-hover', '--link-name', '--link-domain', '--link-accent',
  '--link-lock-bg', '--link-lock-border', '--link-lock-text', '--link-idle',
  // 页脚独立变量
  '--foot-text', '--foot-line', '--foot-sig', '--foot-accent',
  // 后台（与前台完全分离，仅在后台区调整）
  '--admin-sidebar', '--admin-header', '--admin-surface',
  '--admin-input', '--admin-input-border', '--admin-table-head',
  '--admin-text', '--admin-text-2', '--admin-muted',
  '--admin-accent', '--admin-accent-2', '--admin-accent-3', '--admin-on-accent',
  '--admin-peach', '--admin-peach-dark',
  '--admin-card', '--admin-card-solid', '--admin-border', '--admin-shadow',
];

/** 校验 custom_theme：{light:{...}, dark:{...}}，key 在白名单内，值为非空字符串 */
function isValidCustomTheme(val) {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  for (const [mode, vars] of Object.entries(val)) {
    if (mode !== 'light' && mode !== 'dark') return false;
    if (typeof vars !== 'object' || vars === null || Array.isArray(vars)) return false;
    for (const [key, value] of Object.entries(vars)) {
      if (!CUSTOM_THEME_KEYS.includes(key)) return false;
      if (typeof value !== 'string' || !value.trim()) return false;
    }
  }
  return true;
}

/** 标语视觉宽度：半角（英文/数字）每字符计 1，全角（中文等）每字计 2，总宽不超过 50 */
function isValidTaglineWidth(val) {
  if (typeof val !== 'string') return false;
  let w = 0;
  for (const ch of val) w += ch.codePointAt(0) > 0xff ? 2 : 1;
  return w <= 50;
}

/** 校验 health_config：巡检配置对象，仅允许已知字段且各字段在可调范围内 */
function isValidHealthConfig(val) {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const allowed = ['enabled', 'intervalHours', 'batchSize', 'deadStreak', 'recheckDead', 'tlsYellowDays', 'tlsRedDays', 'coldDays'];
  for (const key of Object.keys(val)) {
    if (!allowed.includes(key)) return false;
  }
  if (val.enabled !== undefined && typeof val.enabled !== 'boolean') return false;
  if (val.recheckDead !== undefined && typeof val.recheckDead !== 'boolean') return false;
  if (val.intervalHours !== undefined && ![24, 48, 72, 168].includes(val.intervalHours)) return false;
  if (val.batchSize !== undefined && (!Number.isInteger(val.batchSize) || val.batchSize < 20 || val.batchSize > 500)) return false;
  if (val.deadStreak !== undefined && (!Number.isInteger(val.deadStreak) || val.deadStreak < 2 || val.deadStreak > 10)) return false;
  if (val.tlsYellowDays !== undefined && (!Number.isInteger(val.tlsYellowDays) || val.tlsYellowDays < 7 || val.tlsYellowDays > 90)) return false;
  if (val.tlsRedDays !== undefined && (!Number.isInteger(val.tlsRedDays) || val.tlsRedDays < 1 || val.tlsRedDays > 30)) return false;
  if (val.coldDays !== undefined && (!Number.isInteger(val.coldDays) || val.coldDays < 30 || val.coldDays > 365)) return false;
  return true;
}

/**
 * 校验 notification_config：channels（渠道）+ events（事件）嵌套结构
 * - channels.serverchan: {enabled, sendKey}
 * - channels.email: {enabled, host, port(465|587), user, pass, to}
 * - events.patrol: {enabled, strategy(abnormal|always), minIssues, titleTemplate, bodyTemplate}
 * - events.backup: {enabled, onSuccess, onFailure, titleTemplate, bodyTemplate}
 */
function isValidNotificationConfig(val) {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const allowedTop = ['channels', 'events'];
  for (const key of Object.keys(val)) {
    if (!allowedTop.includes(key)) return false;
  }

  // ===== channels 渠道校验 =====
  if (val.channels !== undefined) {
    if (typeof val.channels !== 'object' || val.channels === null || Array.isArray(val.channels)) return false;
    const chAllowed = ['serverchan', 'email'];
    for (const k of Object.keys(val.channels)) {
      if (!chAllowed.includes(k)) return false;
    }
    // serverchan 子渠道
    if (val.channels.serverchan !== undefined) {
      const sc = val.channels.serverchan;
      if (typeof sc !== 'object' || sc === null || Array.isArray(sc)) return false;
      const scAllowed = ['enabled', 'sendKey'];
      for (const k of Object.keys(sc)) {
        if (!scAllowed.includes(k)) return false;
      }
      if (sc.enabled !== undefined && typeof sc.enabled !== 'boolean') return false;
      if (sc.sendKey !== undefined && (typeof sc.sendKey !== 'string' || sc.sendKey.length > 100)) return false;
    }
    // email 子渠道
    if (val.channels.email !== undefined) {
      const em = val.channels.email;
      if (typeof em !== 'object' || em === null || Array.isArray(em)) return false;
      const emAllowed = ['enabled', 'host', 'port', 'user', 'pass', 'to'];
      for (const k of Object.keys(em)) {
        if (!emAllowed.includes(k)) return false;
      }
      if (em.enabled !== undefined && typeof em.enabled !== 'boolean') return false;
      if (em.host !== undefined && (typeof em.host !== 'string' || em.host.length > 200)) return false;
      if (em.port !== undefined && ![465, 587].includes(em.port)) return false;
      if (em.user !== undefined && (typeof em.user !== 'string' || em.user.length > 200)) return false;
      if (em.pass !== undefined && (typeof em.pass !== 'string' || em.pass.length > 200)) return false;
      if (em.to !== undefined && (typeof em.to !== 'string' || em.to.length > 500)) return false;
    }
  }

  // ===== events 事件校验 =====
  if (val.events !== undefined) {
    if (typeof val.events !== 'object' || val.events === null || Array.isArray(val.events)) return false;
    const evAllowed = ['patrol', 'backup'];
    for (const k of Object.keys(val.events)) {
      if (!evAllowed.includes(k)) return false;
    }
    // 通用模板字段校验
    const isValidEventObj = (ev, extraKeys) => {
      if (typeof ev !== 'object' || ev === null || Array.isArray(ev)) return false;
      const base = ['enabled', 'titleTemplate', 'bodyTemplate'];
      for (const k of Object.keys(ev)) {
        if (!base.includes(k) && !extraKeys.includes(k)) return false;
      }
      if (ev.enabled !== undefined && typeof ev.enabled !== 'boolean') return false;
      if (ev.titleTemplate !== undefined && (typeof ev.titleTemplate !== 'string' || ev.titleTemplate.length > 200)) return false;
      if (ev.bodyTemplate !== undefined && (typeof ev.bodyTemplate !== 'string' || ev.bodyTemplate.length > 1000)) return false;
      return true;
    };
    // patrol 事件：strategy + minIssues
    if (val.events.patrol !== undefined) {
      const ev = val.events.patrol;
      if (!isValidEventObj(ev, ['strategy', 'minIssues'])) return false;
      if (ev.strategy !== undefined && !['abnormal', 'always'].includes(ev.strategy)) return false;
      if (ev.minIssues !== undefined && (!Number.isInteger(ev.minIssues) || ev.minIssues < 1 || ev.minIssues > 100)) return false;
    }
    // backup 事件：onSuccess + onFailure
    if (val.events.backup !== undefined) {
      const ev = val.events.backup;
      if (!isValidEventObj(ev, ['onSuccess', 'onFailure'])) return false;
      if (ev.onSuccess !== undefined && typeof ev.onSuccess !== 'boolean') return false;
      if (ev.onFailure !== undefined && typeof ev.onFailure !== 'boolean') return false;
    }
  }
  return true;
}

// GET /api/preferences - 获取偏好【公开接口，前台展示用】
router.get('/', getPreferences);

// GET /api/preferences/notify-config - 获取通知配置【仅管理员】
// 公开的 GET / 已剔除 notification_config，防止泄露邮箱授权码 / Server酱 SendKey
router.get('/notify-config', authMiddleware, getNotifyConfig);

// PUT /api/preferences - 更新偏好
router.put(
  '/',
  authMiddleware,
  [
    body('theme').optional().isIn(['light', 'dark', 'auto']).withMessage('主题只能为 light、dark 或 auto'),
    body('search_engine').optional().isString().withMessage('搜索引擎标识必须为字符串'),
    body('engine_display_count').optional().isInt({ min: 1, max: 10 }).withMessage('展示数量范围为 1-10'),
    body('theme_preset').optional().isString().isLength({ min: 3, max: 30 }).withMessage('配色预设标识长度需在 3-30 之间'),
    body('show_domain').optional().isInt({ min: 0, max: 1 }).withMessage('show_domain 只能为 0 或 1'),
    body('no_image').optional().isInt({ min: 0, max: 1 }).withMessage('no_image 只能为 0 或 1'),
    body('view_mode').optional().isIn(['card', 'list', 'compact', 'dial']).withMessage('view_mode 只能为 card、list、compact 或 dial'),
    body('view_layout_enabled').optional().isInt({ min: 0, max: 1 }).withMessage('view_layout_enabled 只能为 0 或 1'),
    body('sort_enabled').optional().isInt({ min: 0, max: 1 }).withMessage('sort_enabled 只能为 0 或 1'),
    body('font_family').optional().isIn(['system', 'kai', 'serif']).withMessage('font_family 只能为 system、kai 或 serif'),
    body('font_switch_enabled').optional().isInt({ min: 0, max: 1 }).withMessage('font_switch_enabled 只能为 0 或 1'),
    body('hero_tagline').optional().isString().custom(isValidTaglineWidth).withMessage('自定义标语宽度超限（中文每字计 2、英文每字符计 1，总宽不超过 50）'),
    body('festival_enabled').optional().isInt({ min: 0, max: 1 }).withMessage('festival_enabled 只能为 0 或 1'),
    body('idle_mark_enabled').optional().isInt({ min: 0, max: 1 }).withMessage('idle_mark_enabled 只能为 0 或 1'),
    body('custom_theme').optional().custom(isValidCustomTheme).withMessage('custom_theme 格式不正确'),
    body('site_title').optional().isString().isLength({ min: 1, max: 50 }).withMessage('网站标题长度需在 1-50 字之间'),
    body('site_logo').optional().isString().isLength({ max: 200 }).withMessage('站点 Logo 路径过长'),
    body('site_keywords').optional().isString().isLength({ max: 200 }).withMessage('站点关键词不能超过 200 字'),
    body('site_description').optional().isString().isLength({ max: 300 }).withMessage('站点描述不能超过 300 字'),
    body('site_copyright').optional().isString().isLength({ max: 100 }).withMessage('版权信息不能超过 100 字'),
    body('stat_tagline').optional().isString().custom(isValidTaglineWidth).withMessage('统计区标语宽度超限（中文每字计 2、英文每字符计 1，总宽不超过 50）'),
    body('health_config').optional().custom(isValidHealthConfig).withMessage('health_config 格式不正确（巡检配置字段或范围非法）'),
    body('notification_config').optional().custom(isValidNotificationConfig).withMessage('notification_config 格式不正确（通知配置字段或取值非法）'),
    body('category_sort_mode').optional().isIn(['sort_order:asc', 'created_at:asc', 'created_at:desc', 'name:asc', 'name:desc']).withMessage('category_sort_mode 取值非法（sort_order:asc / created_at:asc|desc / name:asc|desc）'),
    body('link_sort_mode').optional().isIn(['sort_order:asc', 'created_at:asc', 'created_at:desc', 'name:asc', 'name:desc']).withMessage('link_sort_mode 取值非法（sort_order:asc / created_at:asc|desc / name:asc|desc）'),
  ],
  validate,
  updatePreferences
);

// POST /api/preferences/notify-test - 测试通知渠道（serverchan / email，仅管理员）
router.post(
  '/notify-test',
  authMiddleware,
  [
    body('channel').optional().isIn(['serverchan', 'email']).withMessage('channel 只能为 serverchan 或 email'),
    body('sendKey').optional().isString().isLength({ max: 100 }).withMessage('SendKey 长度不合法'),
    body('config').optional().isObject().withMessage('config 格式不正确'),
  ],
  validate,
  testNotify
);

// POST /api/preferences/logo - 上传站点 Logo（base64，仅管理员）
router.post(
  '/logo',
  authMiddleware,
  [
    body('data').isString().isLength({ min: 20, max: 512 * 1024 }).withMessage('图片数据无效'),
  ],
  validate,
  uploadLogo
);

// DELETE /api/preferences/logo - 移除站点 Logo
router.delete('/logo', authMiddleware, removeLogo);

export default router;
