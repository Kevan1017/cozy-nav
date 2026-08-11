/**
 * 备份路由（仅管理员）
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  getBackupConfig,
  updateBackupConfig,
  runBackupNow,
  getBackupList,
} from '../controllers/backupController.js';

const router = Router();

router.use(authMiddleware);

// GET /api/backup/config - 读取备份配置
router.get('/config', getBackupConfig);

// PUT /api/backup/config - 保存备份配置
router.put(
  '/config',
  [
    body('autoEnabled').optional().isBoolean().withMessage('autoEnabled 必须为布尔值'),
    body('retainCount').optional().isInt({ min: 1, max: 90 }).withMessage('retainCount 需为 1-90 的整数'),
    body('gitEnabled').optional().isBoolean().withMessage('gitEnabled 必须为布尔值'),
    body('gitRemote').optional().isString().isLength({ max: 200 }).withMessage('仓库地址不能超过 200 字符'),
    body('gitBranch').optional().isString().isLength({ max: 50 }).withMessage('分支名不能超过 50 字符'),
  ],
  validate,
  updateBackupConfig
);

// POST /api/backup/run - 立即备份（body 可选 pushGit 覆盖 Git 推送开关）
router.post(
  '/run',
  [
    body('pushGit').optional().isBoolean().withMessage('pushGit 必须为布尔值'),
  ],
  validate,
  runBackupNow
);

// GET /api/backup/list - 最近备份记录
router.get('/list', getBackupList);

export default router;
