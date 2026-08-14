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
  testWebdav,
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
    // 坚果云 WebDAV 云端备份配置（嵌套对象）
    body('webdav').optional().isObject().withMessage('webdav 必须为对象'),
    body('webdav.enabled').optional().isBoolean().withMessage('webdav.enabled 必须为布尔值'),
    body('webdav.url').optional().isURL({ require_tld: false }).withMessage('WebDAV 地址格式不正确'),
    body('webdav.user').optional().isString().isLength({ max: 200 }).withMessage('坚果云账号不能超过 200 字符'),
    body('webdav.pass').optional().isString().isLength({ max: 200 }).withMessage('应用密码不能超过 200 字符'),
    body('webdav.path').optional().isString().isLength({ max: 100 }).withMessage('远程目录名不能超过 100 字符'),
    body('webdav.retainCount').optional().isInt({ min: 1, max: 30 }).withMessage('云端保留份数需为 1-30 的整数'),
  ],
  validate,
  updateBackupConfig
);

// POST /api/backup/run - 立即备份（增量判断：数据无变化则跳过；启用 WebDAV 同步上传云端）
router.post('/run', validate, runBackupNow);

// POST /api/backup/webdav-test - 测试坚果云 WebDAV 连接（不保存）
router.post(
  '/webdav-test',
  [
    body('webdav').optional().isObject().withMessage('webdav 必须为对象'),
    body('webdav.url').optional().isURL({ require_tld: false }).withMessage('WebDAV 地址格式不正确'),
  ],
  validate,
  testWebdav
);

// GET /api/backup/list - 最近备份记录
router.get('/list', getBackupList);

export default router;
