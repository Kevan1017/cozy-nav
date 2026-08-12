/**
 * 书签路由
 */
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import {
  createLink,
  batchCreateLinks,
  updateLink,
  deleteLink,
  getTrashLinks,
  restoreLink,
  purgeLink,
  togglePin,
  toggleLinkLock,
  fetchFaviconSync,
  fetchPageTitle,
  recordVisit,
  checkLink,
  checkAllLinks,
  getCheckProgress,
  getIssues,
  batchCheckLinks,
  resetHealthBatch,
  batchMoveLinks,
  getFavicon,
  fetchFaviconByUrl,
  uploadFaviconCustom,
  removeFaviconCustom,
} from '../controllers/linkController.js';

const router = Router();

// 访问埋点限流：60 次/分钟/IP（公开接口，防脚本高频刷写 visit_count / visit_logs）
// 正常用户点击频率远低于此阈值，不会误伤；仅拦截批量脚本
const visitLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: '访问记录请求过于频繁',
});

// POST /api/links/:id/visit - 记录书签访问时间【公开接口，前台埋点用，限流 60 次/分钟/IP】
// 注：id 必须为正整数，非数字输入返回 400；数字但不存在时仍统一返回成功（配合 S10 防 ID 探测）
router.post(
  '/:id/visit',
  visitLimiter,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  recordVisit
);

// POST /api/links/:id/check - 检测单个链接可用性（同步等待结果）
router.post(
  '/:id/check',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  checkLink
);

// GET /api/links/fetch-title?url=xxx - 获取网页标题
router.get(
  '/fetch-title',
  authMiddleware,
  [
    // 严格校验 URL：仅 http/https 且必须带协议，拦截内网地址在控制器内做（需 DNS 解析）
    query('url')
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('URL 必须以 http:// 或 https:// 开头'),
  ],
  validate,
  fetchPageTitle
);

// POST /api/links/check-all - 批量检测所有链接可用性（后台任务）
router.post('/check-all', authMiddleware, checkAllLinks);

// GET /api/links/check-progress - 查询批量检测进度
router.get('/check-progress', authMiddleware, getCheckProgress);

// GET /api/links/issues - 异常链接分页列表（巡检页批量处理）
router.get(
  '/issues',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page 需为正整数'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize 需为 1-100 的整数'),
  ],
  validate,
  getIssues
);

// POST /api/links/batch-check - 批量重新检测指定链接
router.post(
  '/batch-check',
  authMiddleware,
  [body('ids').isArray({ min: 1, max: 100 }).withMessage('ids 必须为 1-100 个书签 ID')],
  validate,
  batchCheckLinks
);

// PUT /api/links/health/reset - 批量重置链接健康状态
router.put(
  '/health/reset',
  authMiddleware,
  [body('ids').isArray({ min: 1, max: 200 }).withMessage('ids 必须为 1-200 个书签 ID')],
  validate,
  resetHealthBatch
);

// PUT /api/links/batch-move - 批量移动书签到目标分类
router.put(
  '/batch-move',
  authMiddleware,
  [
    body('ids').isArray({ min: 1, max: 200 }).withMessage('ids 必须为 1-200 个书签 ID'),
    body('ids.*').isInt({ min: 1 }).withMessage('书签 ID 必须为正整数'),
    body('category_id').isInt({ min: 1 }).withMessage('分类ID必须为正整数'),
  ],
  validate,
  batchMoveLinks
);

// POST /api/links/batch - 批量新建书签（多行粘贴，URL 命中重复时跳过该条）
router.post(
  '/batch',
  authMiddleware,
  [
    body('category_id').isInt({ min: 1 }).withMessage('分类ID必须为正整数'),
    body('items').isArray({ min: 1, max: 100 }).withMessage('items 必须为 1-100 条书签'),
    body('items.*.name').optional().isString().withMessage('书签名称必须为字符串'),
    body('items.*.url')
      .notEmpty()
      .withMessage('URL不能为空')
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('URL 必须以 http:// 或 https:// 开头'),
  ],
  validate,
  batchCreateLinks
);

// POST /api/links - 新建书签
router.post(
  '/',
  authMiddleware,
  [
    body('category_id').isInt({ min: 1 }).withMessage('分类ID必须为正整数'),
    body('name').notEmpty().withMessage('书签名称不能为空'),
    body('url')
      .notEmpty()
      .withMessage('URL不能为空')
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('URL 必须以 http:// 或 https:// 开头'),
    body('note').optional().isString().isLength({ max: 200 }).withMessage('备注不能超过200字'),
    // force：重复链接检测命中时，前端确认后传 true 强制保存
    body('force').optional().isBoolean().withMessage('force必须为布尔值'),
  ],
  validate,
  createLink
);

// PUT /api/links/:id - 编辑书签
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('书签 ID 非法'),
    // name 选填：不传则保留原值（updateLink 内部 name ?? existing.name 支持部分更新）
    body('name').optional().notEmpty().withMessage('书签名称不能为空'),
    // url 选填：若提供则必须为合法 http/https URL
    body('url')
      .optional()
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('URL 必须以 http:// 或 https:// 开头'),
    // category_id 选填：若提供则必须为正整数
    body('category_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('分类ID必须为正整数'),
    body('note').optional().isString().isLength({ max: 200 }).withMessage('备注不能超过200字'),
    // force：重复链接检测命中时，前端确认后传 true 强制保存
    body('force').optional().isBoolean().withMessage('force必须为布尔值'),
  ],
  validate,
  updateLink
);

// DELETE /api/links/:id - 删除书签（软删除）
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  deleteLink
);

// GET /api/links/trash - 回收站列表（已删除书签）
router.get('/trash', authMiddleware, getTrashLinks);

// POST /api/links/:id/restore - 从回收站恢复书签
router.post(
  '/:id/restore',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  restoreLink
);

// DELETE /api/links/:id/purge - 从回收站彻底删除（物理删除，不可恢复）
router.delete(
  '/:id/purge',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  purgeLink
);

// PUT /api/links/:id/pin - 置顶/取消置顶书签
router.put(
  '/:id/pin',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('书签 ID 非法'),
    body('pinned').isBoolean().withMessage('pinned必须为布尔值'),
  ],
  validate,
  togglePin
);

// PUT /api/links/:id/lock - 切换书签锁定状态
router.put(
  '/:id/lock',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('书签 ID 非法'),
    body('locked').isBoolean().withMessage('locked必须为布尔值'),
  ],
  validate,
  toggleLinkLock
);

// POST /api/links/:id/fetch-favicon - 手动获取书签 favicon
router.post(
  '/:id/fetch-favicon',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  fetchFaviconSync
);

// POST /api/links/:id/upload-favicon - 上传自定义 favicon 图标（data URL）
router.post(
  '/:id/upload-favicon',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('书签 ID 非法'),
    body('dataUrl').isString().withMessage('dataUrl 必须为字符串'),
  ],
  validate,
  uploadFaviconCustom
);

// DELETE /api/links/:id/favicon - 移除书签 favicon（回退字母头像）
router.delete(
  '/:id/favicon',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('书签 ID 非法')],
  validate,
  removeFaviconCustom
);

export default router;

/* ============================== favicon 路由（原 favicon.js 合并，挂载前缀 /api/favicon 保持不变） ============================== */

const faviconRouter = Router();

// GET /api/favicon?domain=example.com - 兜底获取 favicon（公开，前台用）
faviconRouter.get('/', getFavicon);

// POST /api/favicon/fetch - 按 URL 手动抓取 favicon（需鉴权，后台用）
faviconRouter.post(
  '/fetch',
  authMiddleware,
  [body('url').isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('URL 不合法')],
  validate,
  fetchFaviconByUrl
);

export { faviconRouter };
