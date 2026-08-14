/**
 * 操作日志路由
 * - GET    /api/operation-logs     分页查询
 * - DELETE /api/operation-logs     清空日志
 */
import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { listLogs, clearLogs } from '../controllers/operationLogController.js';

const router = Router();

// 分页查询操作日志（管理员登录）
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('module').optional().isString().trim(),
    query('keyword').optional().isString().trim(),
  ],
  validate,
  listLogs
);

// 清空操作日志（管理员登录）
router.delete('/', authMiddleware, clearLogs);

export default router;
