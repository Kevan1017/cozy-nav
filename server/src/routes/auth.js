/**
 * 认证路由
 */
import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  changePassword,
  getVaultStatus,
  toggleVault,
  setVaultPassword,
  changeVaultPassword,
  unlockVault,
  lockVault,
  refreshVaultToken,
  resetVaultPassword,
} from '../controllers/authController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { loginLimiter, vaultUnlockLimiter, passwordChangeLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// POST /api/auth/login - 管理员登录（限流：5 次/分钟/IP，防爆破）
router.post(
  '/login',
  loginLimiter,
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
  ],
  validate,
  login
);

// POST /api/auth/change-password - 修改密码（需登录，限流：3 次/分钟/IP）
router.post(
  '/change-password',
  authMiddleware,
  passwordChangeLimiter,
  [
    body('oldPassword').notEmpty().withMessage('原密码不能为空'),
    body('newPassword').notEmpty().isLength({ min: 8 }).withMessage('新密码至少 8 位'),
  ],
  validate,
  changePassword
);

export default router;

/* ============================== 保险库路由（原 vault.js 合并，挂载前缀 /api/vault 保持不变） ============================== */
/* 除 refresh 外所有接口均需登录鉴权（authMiddleware） */

const vaultRouter = Router();

// GET /api/vault/status - 查询保险库状态
vaultRouter.get('/status', authMiddleware, getVaultStatus);

// PUT /api/vault/toggle - 开启/关闭保险库功能
vaultRouter.put(
  '/toggle',
  authMiddleware,
  [body('enabled').isBoolean().withMessage('enabled 必须为布尔值')],
  validate,
  toggleVault
);

// POST /api/vault/password - 设置保险库密码（首次，限流：3 次/分钟/IP）
vaultRouter.post(
  '/password',
  authMiddleware,
  passwordChangeLimiter,
  [body('password').notEmpty().isLength({ min: 8 }).withMessage('保险库密码至少 8 位')],
  validate,
  setVaultPassword
);

// PUT /api/vault/password - 修改保险库密码（限流：3 次/分钟/IP）
vaultRouter.put(
  '/password',
  authMiddleware,
  passwordChangeLimiter,
  [
    body('oldPassword').notEmpty().withMessage('原密码不能为空'),
    body('newPassword').notEmpty().isLength({ min: 8 }).withMessage('新密码至少 8 位'),
  ],
  validate,
  changeVaultPassword
);

// POST /api/vault/unlock - 解锁保险库（限流：5 次/分钟/IP，防爆破）
vaultRouter.post(
  '/unlock',
  authMiddleware,
  vaultUnlockLimiter,
  [body('password').notEmpty().withMessage('保险库密码不能为空')],
  validate,
  unlockVault
);

// POST /api/vault/lock - 锁定保险库
vaultRouter.post('/lock', authMiddleware, lockVault);

// POST /api/vault/reset-password - 忘记密码重置（验证管理员登录密码，限流：3 次/分钟/IP）
vaultRouter.post(
  '/reset-password',
  authMiddleware,
  passwordChangeLimiter,
  [
    body('adminPassword').notEmpty().withMessage('管理员密码不能为空'),
    body('newPassword').notEmpty().isLength({ min: 8 }).withMessage('新保险库密码至少 8 位'),
  ],
  validate,
  resetVaultPassword
);

// POST /api/vault/refresh - 刷新保险库 Token（用 refresh_token 静默换取新 token）
vaultRouter.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('refresh_token 不能为空')],
  validate,
  refreshVaultToken
);

export { vaultRouter };
