/**
 * 导入导出路由
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  exportJSON,
  exportBookmarks,
  importJSON,
  importBookmarks,
} from '../controllers/importExportController.js';

const router = Router();

// 导出 JSON 格式
router.get('/export/json', authMiddleware, exportJSON);

// 导出浏览器书签 HTML 格式
router.get('/export/bookmarks', authMiddleware, exportBookmarks);

// 导入 JSON 数据
router.post(
  '/import/json',
  authMiddleware,
  [
    body('strategy')
      .optional()
      .isIn(['skip', 'overwrite'])
      .withMessage('strategy 仅支持 skip 或 overwrite'),
    body('categories').isArray({ min: 1 }).withMessage('categories 必须是非空数组'),
  ],
  validate,
  importJSON
);

// 导入浏览器书签 HTML
router.post(
  '/import/bookmarks',
  authMiddleware,
  [body('html').isString().notEmpty().withMessage('html 不能为空')],
  validate,
  importBookmarks
);

export default router;