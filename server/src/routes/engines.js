/**
 * 搜索引擎路由
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  getActiveEngines,
  getAllEngines,
  createEngine,
  updateEngine,
  deleteEngine,
  sortEngines,
} from '../controllers/engineController.js';

const router = Router();

// GET /api/engines - 启用的引擎列表（公开，前台用）
router.get('/', getActiveEngines);

// GET /api/engines/all - 所有引擎（含禁用，后台用）
router.get('/all', authMiddleware, getAllEngines);

// POST /api/engines - 创建引擎
router.post(
  '/',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('引擎名称不能为空'),
    body('label').notEmpty().withMessage('引擎标签不能为空'),
    body('key').notEmpty().withMessage('引擎标识不能为空'),
    body('url_template')
      .notEmpty().withMessage('URL 模板不能为空')
      .custom(value => value.includes('{q}')).withMessage('URL 模板必须包含 {q} 占位符'),
  ],
  validate,
  createEngine
);

// PUT /api/engines/sort - 批量排序（需在 /:id 之前定义）
router.put(
  '/sort',
  authMiddleware,
  [
    // 校验数组元素结构：每项必须包含整数 id 和 sort_order（S8 修复）
    body('orders')
      .isArray({ min: 1 }).withMessage('排序数据格式错误')
      .custom(orders => orders.every(o => o && Number.isInteger(o.id) && Number.isInteger(o.sort_order)))
      .withMessage('排序数据需包含整数 id 和 sort_order'),
  ],
  validate,
  sortEngines
);

// PUT /api/engines/:id - 更新引擎
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('引擎 ID 非法'),
    body('url_template')
      .optional()
      .custom(value => value.includes('{q}')).withMessage('URL 模板必须包含 {q} 占位符'),
  ],
  validate,
  updateEngine
);

// DELETE /api/engines/:id - 删除引擎
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('引擎 ID 非法')],
  validate,
  deleteEngine
);

export default router;
