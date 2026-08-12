import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';
import { normalizeUrl } from '../utils/urlNormalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../data/cozy-nav.db');

// 确保数据目录存在
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

// 开启外键约束
db.exec('PRAGMA foreign_keys = ON');

/**
 * 初始化数据库表结构
 */
export function initDatabase() {
  db.exec(`
    -- 管理员表（单用户，固定 id=1）
    CREATE TABLE IF NOT EXISTS admin (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      password_changed_at  DATETIME,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 分类表
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      subtitle    TEXT,
      emoji       TEXT DEFAULT '🧭',
      bg_color    TEXT,
      sort_order  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at  DATETIME
    );

    -- 书签表
    CREATE TABLE IF NOT EXISTS links (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id  INTEGER NOT NULL,
      name         TEXT NOT NULL,
      url          TEXT NOT NULL,
      domain       TEXT,
      avatar_text  TEXT,
      avatar_color TEXT,
      is_pinned    INTEGER DEFAULT 0,
      pin_order    INTEGER DEFAULT 0,
      sort_order   INTEGER DEFAULT 0,
      favicon_path TEXT,                                  -- favicon 文件名标识（如 'abc123.png'）
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at   DATETIME,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- 偏好表（单行，固定 id=1）
    CREATE TABLE IF NOT EXISTS preferences (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      theme           TEXT DEFAULT 'light',
      search_engine   TEXT DEFAULT 'google',
      engine_display_count INTEGER DEFAULT 3,
      theme_preset    TEXT DEFAULT 'amber-pine',
      show_domain     INTEGER DEFAULT 1,                           -- 是否在前台显示域名（1=显示 0=隐藏）
      view_mode       TEXT DEFAULT 'card',                         -- 视图模式：card / list / compact
      font_family     TEXT DEFAULT 'system',                        -- 字体族：system / rounded / serif
      view_layout_enabled INTEGER DEFAULT 1                        -- 视图布局开关（1=开启 0=关闭）
    );

    -- 搜索引擎表
    CREATE TABLE IF NOT EXISTS search_engines (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      label         TEXT NOT NULL,
      key           TEXT NOT NULL UNIQUE,
      url_template  TEXT NOT NULL,
      icon          TEXT,
      color         TEXT,
      sort_order    INTEGER DEFAULT 0,
      is_active     INTEGER DEFAULT 1,
      deleted_at    DATETIME,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * 写入管理员 + 偏好种子数据
 * 仅首次建库（admin 表为空）时执行；生产环境强制校验密码强度
 * 独立演示实例可设置 ALLOW_DEMO_PASSWORD=true 放行默认密码 admin123，仅演示用途
 */
function seedAdminAndPrefs() {
  // 生产环境强校验：禁止使用默认密码 admin123（仅首次建库生效，后续改密后不受影响）
  // 独立演示实例通过 ALLOW_DEMO_PASSWORD=true 放行，严禁用于正式环境
  const adminPassword = process.env.ADMIN_PASSWORD;
  const allowDemoPassword = process.env.ALLOW_DEMO_PASSWORD === 'true';
  if (
    process.env.NODE_ENV === 'production' &&
    !allowDemoPassword &&
    (!adminPassword || adminPassword === 'admin123')
  ) {
    console.error('[启动][严重] 生产环境禁止使用默认管理员密码 admin123！');
    console.error('  请在 .env 中设置 ADMIN_PASSWORD（至少 8 位，建议字母+数字组合）');
    console.error('  仅独立演示实例可设置 ALLOW_DEMO_PASSWORD=true 放行，严禁用于正式环境');
    throw new Error('生产环境必须配置强 ADMIN_PASSWORD，禁止使用默认密码 admin123');
  }

  const hashedPassword = bcrypt.hashSync(adminPassword || 'admin123', 12);

  db.prepare('INSERT INTO admin (id, username, password) VALUES (1, ?, ?)')
    .run(process.env.ADMIN_USERNAME || 'admin', hashedPassword);

  db.prepare('INSERT INTO preferences (id, theme, search_engine) VALUES (1, ?, ?)')
    .run('light', 'google');
}

/**
 * 种子分类数据
 * @returns {Object} 分类名称到 ID 的映射
 */
function seedCategories() {
  const categories = [
    { name: '常用直达', subtitle: 'Direct · 每天都要去', emoji: '🧭', bg_color: 'peach', sort_order: 1 },
    { name: '开发者', subtitle: 'Dev · 写代码必备', emoji: '⚙', bg_color: 'mint', sort_order: 2 },
    { name: '设计灵感', subtitle: 'Design · 找点子', emoji: '🎨', bg_color: 'lav', sort_order: 3 },
    { name: '效率工具', subtitle: 'Tools · 顺手就好', emoji: '📝', bg_color: 'sky', sort_order: 4 },
    { name: '资讯阅读', subtitle: 'Read · 看看世界', emoji: '📖', bg_color: 'rose', sort_order: 5 },
    { name: '影音娱乐', subtitle: 'Play · 放松一下', emoji: '🎬', bg_color: 'peach', sort_order: 6 },
  ];

  const stmt = db.prepare(
    'INSERT INTO categories (name, subtitle, emoji, bg_color, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  const categoryIds = {};
  for (const cat of categories) {
    const result = stmt.run(cat.name, cat.subtitle, cat.emoji, cat.bg_color, cat.sort_order);
    categoryIds[cat.name] = Number(result.lastInsertRowid);
  }
  return categoryIds;
}

/**
 * 种子搜索引擎数据
 */
function seedEngines() {
  const engines = [
    { name: 'Google', label: 'G', key: 'google', url_template: 'https://www.google.com/search?q={q}', icon: '🔍', color: 'sky', sort_order: 0 },
    { name: 'Bing', label: 'B', key: 'bing', url_template: 'https://www.bing.com/search?q={q}', icon: '🌿', color: 'mint', sort_order: 1 },
    { name: '百度', label: '百', key: 'baidu', url_template: 'https://www.baidu.com/s?wd={q}', icon: '🐾', color: 'rose', sort_order: 2 },
    { name: 'DuckDuckGo', label: 'D', key: 'duckduckgo', url_template: 'https://duckduckgo.com/?q={q}', icon: '🦆', color: 'amber', sort_order: 3 },
    { name: 'GitHub', label: 'GH', key: 'github', url_template: 'https://github.com/search?q={q}', icon: '🐙', color: 'slate', sort_order: 4 },
    { name: 'YouTube', label: 'YT', key: 'youtube', url_template: 'https://www.youtube.com/results?search_query={q}', icon: '▶️', color: 'rose', sort_order: 5 },
    { name: '知乎', label: '知', key: 'zhihu', url_template: 'https://www.zhihu.com/search?type=content&q={q}', icon: '💬', color: 'sky', sort_order: 6 },
    { name: 'AI', label: 'AI', key: 'ai', url_template: 'https://www.perplexity.ai/search?q={q}', icon: '🤖', color: 'lav', sort_order: 7 },
  ];

  const stmt = db.prepare(
    `INSERT INTO search_engines (name, label, key, url_template, icon, color, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );

  for (const eng of engines) {
    stmt.run(eng.name, eng.label, eng.key, eng.url_template, eng.icon, eng.color, eng.sort_order);
  }
}

/**
 * 种子书签数据
 * @param {Object} categoryIds - 分类名称到 ID 的映射
 */
function seedLinks(categoryIds) {
  const links = [
    { cat: '常用直达', name: 'Google', url: 'https://google.com', domain: 'google.com', avatar_text: 'G', avatar_color: 'var(--pop)', sort_order: 1, is_pinned: 1, pin_order: 2 },
    { cat: '常用直达', name: 'GitHub', url: 'https://github.com', domain: 'github.com', avatar_text: 'Gi', avatar_color: '#5B4A42', sort_order: 2, is_pinned: 1, pin_order: 1 },
    { cat: '常用直达', name: 'YouTube', url: 'https://youtube.com', domain: 'youtube.com', avatar_text: 'Yt', avatar_color: '#FF6B8A', sort_order: 3, is_pinned: 1, pin_order: 4 },
    { cat: '常用直达', name: '哔哩哔哩', url: 'https://bilibili.com', domain: 'bilibili.com', avatar_text: '哔', avatar_color: '#FB7299', sort_order: 4 },
    { cat: '开发者', name: 'Stack Overflow', url: 'https://stackoverflow.com', domain: 'stackoverflow.com', avatar_text: 'Sf', avatar_color: '#F48024', sort_order: 1 },
    { cat: '开发者', name: 'MDN', url: 'https://developer.mozilla.org', domain: 'developer.mozilla', avatar_text: 'MD', avatar_color: '#3FA376', sort_order: 2 },
    { cat: '开发者', name: 'npm', url: 'https://npmjs.com', domain: 'npmjs.com', avatar_text: 'np', avatar_color: '#CB3837', sort_order: 3 },
    { cat: '开发者', name: 'CodePen', url: 'https://codepen.io', domain: 'codepen.io', avatar_text: 'CP', avatar_color: '#5EEAD4', sort_order: 4 },
    { cat: '设计灵感', name: 'Figma', url: 'https://figma.com', domain: 'figma.com', avatar_text: 'Fi', avatar_color: '#A259FF', sort_order: 1, is_pinned: 1, pin_order: 3 },
    { cat: '设计灵感', name: 'Dribbble', url: 'https://dribbble.com', domain: 'dribbble.com', avatar_text: 'Dr', avatar_color: '#EA4C89', sort_order: 2 },
    { cat: '设计灵感', name: 'Behance', url: 'https://behance.net', domain: 'behance.net', avatar_text: 'Be', avatar_color: '#1769FF', sort_order: 3 },
    { cat: '设计灵感', name: 'Unsplash', url: 'https://unsplash.com', domain: 'unsplash.com', avatar_text: 'Up', avatar_color: '#3A6B8C', sort_order: 4 },
    { cat: '效率工具', name: 'Notion', url: 'https://notion.so', domain: 'notion.so', avatar_text: 'No', avatar_color: '#111', sort_order: 1, is_pinned: 1, pin_order: 6 },
    { cat: '效率工具', name: '飞书', url: 'https://feishu.cn', domain: 'feishu.cn', avatar_text: '飞', avatar_color: '#00C8B4', sort_order: 2 },
    { cat: '效率工具', name: '语雀', url: 'https://yuque.com', domain: 'yuque.com', avatar_text: '语', avatar_color: 'var(--pop)', sort_order: 3 },
    { cat: '效率工具', name: '有道云笔记', url: 'https://note.youdao.com', domain: 'note.youdao', avatar_text: '有道', avatar_color: '#3FA376', sort_order: 4 },
    { cat: '资讯阅读', name: '知乎', url: 'https://zhihu.com', domain: 'zhihu.com', avatar_text: '知', avatar_color: '#0084FF', sort_order: 1, is_pinned: 1, pin_order: 5 },
    { cat: '资讯阅读', name: '微博', url: 'https://weibo.com', domain: 'weibo.com', avatar_text: '微', avatar_color: '#E6162D', sort_order: 2 },
    { cat: '资讯阅读', name: 'Hacker News', url: 'https://news.ycombinator.com', domain: 'news.ycombinator', avatar_text: 'HN', avatar_color: '#FF6B00', sort_order: 3 },
    { cat: '资讯阅读', name: '少数派', url: 'https://sspai.com', domain: 'sspai.com', avatar_text: '少数', avatar_color: '#3A6B8C', sort_order: 4 },
    { cat: '影音娱乐', name: 'Netflix', url: 'https://netflix.com', domain: 'netflix.com', avatar_text: 'Nf', avatar_color: '#E50914', sort_order: 1 },
    { cat: '影音娱乐', name: 'Spotify', url: 'https://spotify.com', domain: 'spotify.com', avatar_text: 'Sp', avatar_color: '#1DB954', sort_order: 2 },
    { cat: '影音娱乐', name: '网易云音乐', url: 'https://music.163.com', domain: 'music.163', avatar_text: '网', avatar_color: '#02B340', sort_order: 3 },
    { cat: '影音娱乐', name: '豆瓣', url: 'https://douban.com', domain: 'douban.com', avatar_text: '豆', avatar_color: 'var(--pop)', sort_order: 4 },
  ];

  const stmt = db.prepare(
    'INSERT INTO links (category_id, name, url, domain, avatar_text, avatar_color, is_pinned, pin_order, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const link of links) {
    stmt.run(
      categoryIds[link.cat], link.name, link.url, link.domain,
      link.avatar_text, link.avatar_color,
      link.is_pinned || 0, link.pin_order || 0, link.sort_order
    );
  }
}

/**
 * 写入种子数据（仅首次启动时）
 * 设置 SEED_DEMO_DATA=false 可实现"纯净启动"：只建 admin 账号和默认搜索引擎，
 * 不写入示例分类与书签；搜索引擎是搜索功能必需的基础数据，始终保留
 */
export function seedDatabase() {
  const hasAdmin = db.prepare('SELECT COUNT(*) as count FROM admin').get();
  if (hasAdmin.count > 0) return;

  seedAdminAndPrefs();

  const demoEnabled = process.env.SEED_DEMO_DATA !== 'false';
  if (demoEnabled) {
    const categoryIds = seedCategories();
    seedLinks(categoryIds);
  } else {
    console.log('[数据库] SEED_DEMO_DATA=false，跳过示例分类与书签（纯净启动）');
  }

  // 搜索引擎幂等写入：migrateDatabase 已对空库补种，此处避免重复插入触发 UNIQUE 冲突
  const hasEngines = db.prepare('SELECT COUNT(*) as count FROM search_engines').get();
  if (hasEngines.count === 0) {
    seedEngines();
  }

  console.log('[数据库] 种子数据写入完成');
}

/**
 * 迁移：为已有表结构补列
 */
function migrateDatabase() {
  try {
    db.exec('ALTER TABLE admin ADD COLUMN password_changed_at DATETIME');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 engine_display_count 列
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN engine_display_count INTEGER DEFAULT 3');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：已有数据库补种子搜索引擎数据
  const hasEngines = db.prepare('SELECT COUNT(*) as count FROM search_engines').get();
  if (hasEngines.count === 0) {
    seedEngines();
    console.log('[数据库] 搜索引擎种子数据已补充');
  } else {
    // 为已有数据库补充缺失的默认引擎（按 key 去重）
    const defaultEngines = [
      { name: '百度', label: '百', key: 'baidu', url_template: 'https://www.baidu.com/s?wd={q}', icon: '🐾', color: 'rose', sort_order: 2 },
      { name: 'DuckDuckGo', label: 'D', key: 'duckduckgo', url_template: 'https://duckduckgo.com/?q={q}', icon: '🦆', color: 'amber', sort_order: 3 },
      { name: 'GitHub', label: 'GH', key: 'github', url_template: 'https://github.com/search?q={q}', icon: '🐙', color: 'slate', sort_order: 4 },
      { name: 'YouTube', label: 'YT', key: 'youtube', url_template: 'https://www.youtube.com/results?search_query={q}', icon: '▶️', color: 'rose', sort_order: 5 },
      { name: '知乎', label: '知', key: 'zhihu', url_template: 'https://www.zhihu.com/search?type=content&q={q}', icon: '💬', color: 'sky', sort_order: 6 },
    ];
    const insertStmt = db.prepare(
      `INSERT INTO search_engines (name, label, key, url_template, icon, color, sort_order, is_active)
       SELECT ?, ?, ?, ?, ?, ?, ?, 1
       WHERE NOT EXISTS (SELECT 1 FROM search_engines WHERE key = ?)`
    );
    let addedCount = 0;
    for (const eng of defaultEngines) {
      const result = insertStmt.run(eng.name, eng.label, eng.key, eng.url_template, eng.icon, eng.color, eng.sort_order, eng.key);
      if (result.changes > 0) addedCount++;
    }
    if (addedCount > 0) {
      console.log(`[数据库] 已补充 ${addedCount} 个默认搜索引擎`);
    }
  }

  // 迁移：admin 表补 vault_password_hash 列（保险库密码哈希）
  try {
    db.exec('ALTER TABLE admin ADD COLUMN vault_password_hash TEXT');
    console.log('[数据库] admin 表已添加 vault_password_hash 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：admin 表补 lock_version 列（保险库锁定版本号，密码修改后递增使旧 Token 失效）
  try {
    db.exec('ALTER TABLE admin ADD COLUMN lock_version INTEGER DEFAULT 0');
    console.log('[数据库] admin 表已添加 lock_version 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：categories 表补 is_locked 列（锁定标识）
  try {
    db.exec('ALTER TABLE categories ADD COLUMN is_locked INTEGER DEFAULT 0');
    console.log('[数据库] categories 表已添加 is_locked 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 is_locked 列（锁定标识）
  try {
    db.exec('ALTER TABLE links ADD COLUMN is_locked INTEGER DEFAULT 0');
    console.log('[数据库] links 表已添加 is_locked 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：admin 表补 vault_enabled 列（保险库功能开关，0=关闭 1=开启）
  try {
    db.exec('ALTER TABLE admin ADD COLUMN vault_enabled INTEGER DEFAULT 0');
    console.log('[数据库] admin 表已添加 vault_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：search_engines 表补 deleted_at 列（软删除时间）
  try {
    db.exec('ALTER TABLE search_engines ADD COLUMN deleted_at DATETIME');
    console.log('[数据库] search_engines 表已添加 deleted_at 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 theme_preset 列（配色预设标识）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN theme_preset TEXT DEFAULT 'amber-pine'");
    console.log('[数据库] preferences 表已添加 theme_preset 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 favicon_path 列（favicon 文件名标识，如 'abc123.png'）
  try {
    db.exec('ALTER TABLE links ADD COLUMN favicon_path TEXT');
    console.log('[数据库] links 表已添加 favicon_path 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 show_domain 列（是否在前台显示域名，1=显示 0=隐藏）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN show_domain INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 show_domain 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 no_image 列（无图模式，1=隐藏 favicon/字母头像 0=显示）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN no_image INTEGER DEFAULT 0');
    console.log('[数据库] preferences 表已添加 no_image 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 view_mode 列（视图模式：card / list / compact）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN view_mode TEXT DEFAULT 'card'");
    console.log('[数据库] preferences 表已添加 view_mode 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 view_layout_enabled 列（视图布局开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN view_layout_enabled INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 view_layout_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 sort_enabled 列（前台排序开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN sort_enabled INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 sort_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 font_family 列（字体族：system / rounded / serif）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN font_family TEXT DEFAULT 'system'");
    console.log('[数据库] preferences 表已添加 font_family 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 note 列（书签备注，仅管理员可见）
  try {
    db.exec("ALTER TABLE links ADD COLUMN note TEXT DEFAULT ''");
    console.log('[数据库] links 表已添加 note 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 font_switch_enabled 列（字体切换功能开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN font_switch_enabled INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 font_switch_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 hero_tagline 列（自定义 Hero 标语，空字符串表示使用默认）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN hero_tagline TEXT DEFAULT ''");
    console.log('[数据库] preferences 表已添加 hero_tagline 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 festival_enabled 列（节日彩蛋功能开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN festival_enabled INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 festival_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 festival_countdown_enabled 列（前台节日倒计时开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN festival_countdown_enabled INTEGER DEFAULT 1');
    console.log('[数据库] preferences 表已添加 festival_countdown_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 last_visited 列（最近访问时间，闲置标记用）
  try {
    db.exec('ALTER TABLE links ADD COLUMN last_visited DATETIME');
    console.log('[数据库] links 表已添加 last_visited 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 idle_mark_enabled 列（闲置书签标记开关，1=开启 0=关闭）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN idle_mark_enabled INTEGER DEFAULT 0');
    console.log('[数据库] preferences 表已添加 idle_mark_enabled 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 custom_theme 列（自定义配色覆盖层，JSON：{light:{--bg:'#xxx',...}, dark:{...}}）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN custom_theme TEXT DEFAULT '{}'");
    console.log('[数据库] preferences 表已添加 custom_theme 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补站点基本配置列（网站标题/Logo/关键词/描述/版权信息）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN site_title TEXT DEFAULT '悦行'");
    console.log('[数据库] preferences 表已添加 site_title 列');
  } catch { /* 列已存在则忽略 */ }
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN site_logo TEXT DEFAULT ''");
    console.log('[数据库] preferences 表已添加 site_logo 列');
  } catch { /* 列已存在则忽略 */ }
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN site_keywords TEXT DEFAULT ''");
    console.log('[数据库] preferences 表已添加 site_keywords 列');
  } catch { /* 列已存在则忽略 */ }
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN site_description TEXT DEFAULT ''");
    console.log('[数据库] preferences 表已添加 site_description 列');
  } catch { /* 列已存在则忽略 */ }
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN site_copyright TEXT DEFAULT ''");
    console.log('[数据库] preferences 表已添加 site_copyright 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 visit_count 列（访问次数，冗余计数避免每次 SUM）
  try {
    db.exec('ALTER TABLE links ADD COLUMN visit_count INTEGER DEFAULT 0');
    console.log('[数据库] links 表已添加 visit_count 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：建 visit_logs 表（访问明细，支撑趋势图 / TOP 榜单 / 冷链接分析）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS visit_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id     INTEGER NOT NULL REFERENCES links(id),
        visited_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_visit_logs_link ON visit_logs(link_id, visited_at);
      CREATE INDEX IF NOT EXISTS idx_visit_logs_time ON visit_logs(visited_at);
    `);
    console.log('[数据库] visit_logs 表已创建');
  } catch (err) { console.log('[数据库] visit_logs 表创建失败', err.message); }

  // 迁移：links 表补 health_status 列（可用性检测状态：ok 正常 / blocked 疑似被墙 / fail 打不开 / skip 跳过）
  try {
    db.exec('ALTER TABLE links ADD COLUMN health_status TEXT');
    console.log('[数据库] links 表已添加 health_status 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 last_check_at 列（最后检测时间）
  try {
    db.exec('ALTER TABLE links ADD COLUMN last_check_at DATETIME');
    console.log('[数据库] links 表已添加 last_check_at 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 health_note 列（检测诊断备注，如"疑似被墙"）
  try {
    db.exec('ALTER TABLE links ADD COLUMN health_note TEXT');
    console.log('[数据库] links 表已添加 health_note 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 favicon_status 列（NULL=未获取 / ok=获取成功 / fail=获取失败）
  try {
    db.exec('ALTER TABLE links ADD COLUMN favicon_status TEXT');
    console.log('[数据库] links 表已添加 favicon_status 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 stat_tagline 列（统计卡底部标语文案，可在后台编辑）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN stat_tagline TEXT DEFAULT '— everything in its place —'");
    console.log('[数据库] preferences 表已添加 stat_tagline 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：为回收站查询与级联删除的常用条件列建索引（幂等，数据量大时显著提速）
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_links_category_id ON links(category_id);
      CREATE INDEX IF NOT EXISTS idx_links_deleted_at ON links(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at);
    `);
    console.log('[数据库] 回收站查询索引已就绪');
  } catch (err) { console.log('[数据库] 索引创建失败', err.message); }

  // 迁移：links 表补 url_normalized 列（URL 规范化指纹，用于重复链接检测）
  try {
    db.exec('ALTER TABLE links ADD COLUMN url_normalized TEXT');
    console.log('[数据库] links 表已添加 url_normalized 列');
  } catch { /* 列已存在则忽略 */ }
  // 规范化判重走索引，避免全表扫描
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_links_url_normalized ON links(url_normalized)');
    console.log('[数据库] url_normalized 判重索引已就绪');
  } catch { /* 索引已存在则忽略 */ }
  // 存量数据回填：只补 url_normalized 为 NULL 的行（个人站数据量小，一次性跑完）
  try {
    const rows = db.prepare('SELECT id, url FROM links WHERE url_normalized IS NULL').all();
    if (rows.length) {
      const update = db.prepare('UPDATE links SET url_normalized = ? WHERE id = ?');
      let filled = 0;
      for (const row of rows) {
        const normalized = normalizeUrl(row.url);
        if (normalized) { update.run(normalized, row.id); filled++; }
      }
      console.log(`[数据库] 存量链接 URL 规范化回填完成：${filled}/${rows.length}`);
    }
  } catch (err) { console.log('[数据库] url_normalized 回填失败', err.message); }

  // 迁移：links 表补 fail_streak 列（连续失败次数，达到判死阈值后状态置为 down 死链）
  try {
    db.exec('ALTER TABLE links ADD COLUMN fail_streak INTEGER DEFAULT 0');
    console.log('[数据库] links 表已添加 fail_streak 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：links 表补 tls_expires_at 列（HTTPS 证书到期日，供到期告警展示）
  try {
    db.exec('ALTER TABLE links ADD COLUMN tls_expires_at DATETIME');
    console.log('[数据库] links 表已添加 tls_expires_at 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 health_config 列（巡检配置 JSON，集中一个字段避免拆散列）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN health_config TEXT');
    console.log('[数据库] preferences 表已添加 health_config 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 notification_config 列（巡检通知配置 JSON，含 Server酱 SendKey）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN notification_config TEXT');
    console.log('[数据库] preferences 表已添加 notification_config 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补 backup_config 列（备份配置 JSON：autoEnabled/retainCount）
  try {
    db.exec('ALTER TABLE preferences ADD COLUMN backup_config TEXT');
    console.log('[数据库] preferences 表已添加 backup_config 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：preferences 表补排序模式列（前台分类/书签排序模式，如 sort_order:asc / created_at:desc / name:asc）
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN category_sort_mode TEXT DEFAULT 'sort_order:asc'");
    console.log('[数据库] preferences 表已添加 category_sort_mode 列');
  } catch { /* 列已存在则忽略 */ }
  try {
    db.exec("ALTER TABLE preferences ADD COLUMN link_sort_mode TEXT DEFAULT 'sort_order:asc'");
    console.log('[数据库] preferences 表已添加 link_sort_mode 列');
  } catch { /* 列已存在则忽略 */ }

  // 迁移：巡检历史报告表（每轮巡检结束写入一条，支撑历史报告/趋势分析）
  db.exec(`CREATE TABLE IF NOT EXISTS patrol_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT,        -- 开始时间
    finished_at TEXT,       -- 结束时间
    trigger_type TEXT DEFAULT 'manual', -- 触发方式：scheduled 定时 / manual 手动
    total INTEGER DEFAULT 0,  -- 检测总数
    ok INTEGER DEFAULT 0,     -- 正常
    blocked INTEGER DEFAULT 0,-- 需代理
    fail INTEGER DEFAULT 0,   -- 打不开（含判死 down）
    skip INTEGER DEFAULT 0,   -- 跳过
    duration_ms INTEGER DEFAULT 0, -- 耗时（ms）
    issue_links TEXT          -- 本轮异常链接快照 JSON：[{id, status}]
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_patrol_reports_finished_at ON patrol_reports(finished_at)');
  console.log('[数据库] 巡检历史报告表已就绪');

  // 迁移：为巡检分片排序与健康状态过滤建索引（幂等，数据量大时显著提速）
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_links_last_check_at ON links(last_check_at);
      CREATE INDEX IF NOT EXISTS idx_links_health ON links(health_status);
    `);
    console.log('[数据库] 健康巡检索引已就绪');
  } catch (err) { console.log('[数据库] 索引创建失败', err.message); }

  // 迁移：更新记录表（后台「关于悦行」维护，记录每次版本修复内容，幂等建表 + 按版本补充缺失记录）
  db.exec(`CREATE TABLE IF NOT EXISTS changelog (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    version     TEXT NOT NULL,      -- 版本号，如 1.0.1
    description TEXT NOT NULL,      -- 本次改动说明
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // 基础更新记录：新部署写入全部，存量库按 version 幂等补充缺失版本（后台手动维护的记录不会被覆盖）
  const baseChangelog = [
    ['1.0.0', '🎉 首个正式版本：书签管理 / 多搜索引擎 / 链接巡检 / 访问统计 / 保险库 / 自动备份 / 多主题 / 浏览器扩展 / 双端适配'],
    ['1.0.1', '🐛 修复：新建/编辑书签未自动解析域名，导致「域名」列空白；新增 fix-link-domain.js 一键补全历史空域名'],
    ['1.0.2', '修复测试/正式环境切换后旧Token失效导致收藏失败的问题'],
    ['1.0.3', '✨ 新增 3 套配色主题：极光星夜 / 奶油拿铁 / 莫兰迪灰；统计卡三块颜色互不重复且贴合主题，自定义配色面板升级'],
    ['1.0.4', '✨ 书签批量移动分类 / Emoji 图标库扩充至约 290 个 / 置顶上限提升至 8 个'],
  ];
  const hasChangelogVersion = db.prepare('SELECT COUNT(*) as count FROM changelog WHERE version = ?');
  const insertChangelog = db.prepare('INSERT INTO changelog (version, description) VALUES (?, ?)');
  let changelogAdded = 0;
  for (const [version, description] of baseChangelog) {
    if (hasChangelogVersion.get(version).count === 0) {
      insertChangelog.run(version, description);
      changelogAdded++;
    }
  }
  if (changelogAdded > 0) {
    console.log(`[数据库] 更新记录已补充（新增 ${changelogAdded} 条）`);
  }
}

/**
 * 初始化并填充数据库
 */
export function setupDatabase() {
  initDatabase();
  migrateDatabase();
  seedDatabase();
}

export default db;
