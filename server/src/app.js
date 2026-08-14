import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { setupDatabase } from './db/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes, { vaultRouter } from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import linkRoutes, { faviconRouter } from './routes/links.js';
import statsRoutes from './routes/stats.js';
import prefsRoutes from './routes/preferences.js';
import engineRoutes from './routes/engines.js';
import importExportRoutes from './routes/importExport.js';
import backupRoutes from './routes/backup.js';
import changelogRoutes from './routes/changelog.js';
import operationLogRoutes from './routes/operationLogs.js';
import { cleanExpiredFailedRecords, FAVICON_DIR } from './utils/faviconFetcher.js';
import { startHealthPatrol, startDailyBackup } from './utils/scheduler.js';
import { LOGO_DIR } from './controllers/prefsController.js';
import { getVersionInfo } from './utils/version.js';

// 校验环境变量
const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!PORT || !JWT_SECRET) {
  console.error('[启动] 缺少必要环境变量 PORT 或 JWT_SECRET');
  process.exit(1);
}

// JWT_SECRET 强度校验（生产环境严格，开发环境宽松但告警）
const DEFAULT_SECRET = 'cozy-nav-secret-change-me';
if (JWT_SECRET === DEFAULT_SECRET) {
  if (NODE_ENV === 'production') {
    console.error('[启动][严重] JWT_SECRET 仍为默认值，生产环境禁止使用！');
    console.error('  请在 .env 中设置至少 32 位的随机字符串，例如：');
    console.error('  JWT_SECRET=' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    process.exit(1);
  } else {
    console.warn('[启动][警告] JWT_SECRET 为默认值，仅限本地开发使用！');
  }
} else if (JWT_SECRET.length < 32) {
  if (NODE_ENV === 'production') {
    console.error(`[启动][严重] JWT_SECRET 长度 ${JWT_SECRET.length} 位，生产环境至少需要 32 位`);
    process.exit(1);
  } else {
    console.warn(`[启动][警告] JWT_SECRET 长度仅 ${JWT_SECRET.length} 位，建议至少 32 位`);
  }
}

// 初始化数据库
setupDatabase();

const app = express();

// 关闭 X-Powered-By: Express 响应头（避免暴露后端框架）
app.disable('x-powered-by');

// 反向代理信任配置（公网部署关键项）：
// 经 nginx / frp 等反代转发时，若不设置，Express 认为 req.ip 全是 127.0.0.1，
// 限流中间件会按同一 IP 计数 → 一人误触限流导致全站登录被锁。
// 取值（环境变量 TRUST_PROXY）：
//   0        = 不信任任何代理（默认，本机直连 Node 场景）
//   loopback = 仅信任来自本机（127.0.0.1）的代理转发【nginx/frpc 同机部署推荐，最安全】
//   1        = 信任第一层代理（Node 前恰好一层可信反代时用）
//   true     = 信任所有代理（仅当 Node 端口完全不对公网开放时用）
const TRUST_PROXY = process.env.TRUST_PROXY || '0';
if (TRUST_PROXY !== '0') {
  app.set('trust proxy', TRUST_PROXY);
  console.log(`[启动][代理] 已开启 trust proxy=${TRUST_PROXY}（限流按真实客户端 IP 计数）`);
} else if (NODE_ENV === 'production') {
  console.warn('[启动][警告] 未设置 TRUST_PROXY。若经 nginx/frp 反代部署，请设置 TRUST_PROXY=loopback，否则登录/解锁限流会误伤全站');
}

// CORS 配置：生产环境收紧 origin，开发环境允许所有来源
const corsOrigin = process.env.CORS_ORIGIN;

// 浏览器扩展来源白名单（可选，S5 修复）：生产环境可通过 CORS_EXTENSIONS 配置扩展 ID（逗号分隔）
// 未配置时默认放行所有 chrome-extension:// 来源（扩展仍需 JWT 鉴权，安全不受影响）
const corsExtensions = (process.env.CORS_EXTENSIONS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// 判断来源是否为白名单内的浏览器扩展（扩展 ID 可在 chrome://extensions 查看）
function isAllowedExtensionOrigin(origin) {
  const prefix = 'chrome-extension://';
  if (!origin.startsWith(prefix)) return false;
  // 未配置白名单时保持默认放行，兼容未固定 key 的本地扩展
  if (corsExtensions.length === 0) return true;
  const extId = origin.slice(prefix.length).split('/')[0].toLowerCase();
  return corsExtensions.includes(extId);
}

let corsOptions = {};
if (NODE_ENV === 'production') {
  if (!corsOrigin) {
    console.error('[启动][严重] 生产环境必须设置 CORS_ORIGIN（允许的前端域名）');
    console.error('  例如：CORS_ORIGIN=https://nav.yourdomain.com');
    process.exit(1);
  }
  // 支持多个域名（逗号分隔）
  const origins = corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
  corsOptions = {
    // origin 回调：白名单域名 + 浏览器扩展来源放行（扩展仍需 JWT 鉴权，安全不受影响）
    origin(origin, cb) {
      // 无 Origin 头（curl/服务端调用）默认放行
      if (!origin) return cb(null, true);
      // 浏览器扩展（chrome-extension://xxx）按白名单校验
      if (isAllowedExtensionOrigin(origin)) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS 来源不在白名单内'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Vault-Token'],
    credentials: true,
    maxAge: 86400, // 预检请求缓存 24 小时
  };
  console.log(`[启动][CORS] 生产环境已收紧，允许来源：${origins.join(', ')}`);
  if (corsExtensions.length > 0) {
    console.log(`[启动][CORS] 浏览器扩展 ID 白名单已启用：${corsExtensions.join(', ')}`);
  } else {
    console.warn('[启动][CORS] 未配置 CORS_EXTENSIONS，浏览器扩展来源默认放行；如需收紧请在 .env 设置扩展 ID 白名单');
  }
} else {
  corsOptions = { origin: true }; // 开发环境允许所有来源
}

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// 安全响应头中间件（S3 修复）：不引入 helmet 依赖，手动设置关键安全头
// 说明：Express 仅托管 /api、/favicons、/logo 等资源，SPA 页面由 nginx/Vite 提供，
// 因此此处 CSP 不作配置（Vue SPA 大量内联样式/脚本，错误 CSP 反而破坏前台主题切换）
app.use((req, res, next) => {
  // 禁止浏览器 MIME 嗅探，防止将 JSON 误解析为可执行内容
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 禁止页面被 iframe 嵌入（防点击劫持）
  res.setHeader('X-Frame-Options', 'DENY');
  // 跨域时仅携带来源信息，减少 Referer 泄露
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 限制浏览器能力（本系统无需摄像头/麦克风/地理位置/支付）
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS：仅在 HTTPS 下生效（浏览器忽略 HTTP 明文响应中的该头）
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// 静态文件：favicon 图标直接访问（通过 /favicons/xxx.png）
app.use('/favicons', express.static(FAVICON_DIR, {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// 静态文件：站点 Logo（通过 /logo/logo.png 访问）
app.use('/logo', express.static(LOGO_DIR, {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// 禁止搜索引擎抓取：全站 noindex（个人导航站无 SEO 需求，避免暴露个人书签结构）
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// 路由
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'success', data: { status: 'ok' } });
});

// 版本信息（公开）：配合 Git 版本管理，前台页脚 / 后台设置展示当前部署版本
app.get('/api/version', (req, res) => {
  res.json({ code: 200, message: 'success', data: getVersionInfo() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/preferences', prefsRoutes);
app.use('/api/engines', engineRoutes);
app.use('/api/vault', vaultRouter);
app.use('/api/favicon', faviconRouter);
app.use('/api', importExportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/operation-logs', operationLogRoutes);

// 全局 404 兜底：对 /api 路径返回统一 JSON（避免命中 Express 默认 404 HTML）
app.use('/api', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// 全局错误处理
app.use(errorHandler);

// 启动时清理过期 favicon 失败记录 + 每 24 小时清理一次
cleanExpiredFailedRecords();
setInterval(cleanExpiredFailedRecords, 24 * 60 * 60 * 1000);

// 启动链接健康定时巡检（配置在 preferences.health_config，每轮结束后动态重排）
startHealthPatrol();

// 启动每日自动备份（配置在 preferences.backup_config，每天 03:00 本地快照，数据无变化自动跳过）
startDailyBackup();

// 启动服务
app.listen(PORT, () => {
  console.log(`[启动] 悦行 后端服务运行在 http://localhost:${PORT}`);
});

export default app;
