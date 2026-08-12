/**
 * 更新记录路由（后台「关于悦行」维护的版本修复记录）
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { listChangelog, createChangelog, deleteChangelog } from '../controllers/changelogController.js';

const router = Router();

// GET /api/changelog - 更新记录列表
router.get('/', authMiddleware, listChangelog);

// POST /api/changelog - 新增更新记录
router.post(
  '/',
  authMiddleware,
  [
    body('version').trim().notEmpty().withMessage('版本号不能为空').isLength({ max: 20 }).withMessage('版本号最长 20 字符'),
    body('description').trim().notEmpty().withMessage('更新说明不能为空').isLength({ max: 500 }).withMessage('更新说明最长 500 字'),
  ],
  validate,
  createChangelog
);

// DELETE /api/changelog/:id - 删除更新记录
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('记录 id 非法')],
  validate,
  deleteChangelog
);

export default router;
