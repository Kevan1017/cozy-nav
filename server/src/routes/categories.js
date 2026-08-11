/**
 * 分类路由
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTrashCategories,
  restoreCategory,
  purgeCategory,
  toggleCategoryLock,
  sortCategories,
} from '../controllers/categoryController.js';

const router = Router();

// GET /api/categories - 获取所有分类（含书签）【公开接口，前台展示用】
router.get('/', getCategories);

// POST /api/categories - 新建分类
router.post(
  '/',
  authMiddleware,
  [body('name').notEmpty().withMessage('分类名称不能为空')],
  validate,
  createCategory
);

// PUT /api/categories/sort - 批量排序（需在 /:id 之前定义）
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
  sortCategories
);

// PUT /api/categories/:id - 编辑分类
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('分类 ID 非法'),
    body('name').notEmpty().withMessage('分类名称不能为空'),
  ],
  validate,
  updateCategory
);

// DELETE /api/categories/:id - 删除分类（软删除）
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('分类 ID 非法')],
  validate,
  deleteCategory
);

// GET /api/categories/trash - 回收站列表（已删除分类）
router.get('/trash', authMiddleware, getTrashCategories);

// POST /api/categories/:id/restore - 从回收站恢复分类
router.post(
  '/:id/restore',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('分类 ID 非法')],
  validate,
  restoreCategory
);

// DELETE /api/categories/:id/purge - 从回收站彻底删除（物理删除，不可恢复）
router.delete(
  '/:id/purge',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('分类 ID 非法')],
  validate,
  purgeCategory
);

// PUT /api/categories/:id/lock - 切换分类锁定状态
router.put(
  '/:id/lock',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('分类 ID 非法'),
    body('locked').isBoolean().withMessage('locked必须为布尔值'),
  ],
  validate,
  toggleCategoryLock
);

export default router;
