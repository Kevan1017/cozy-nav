/**
 * 统计路由
 */
import { Router } from 'express';
import { query, param } from 'express-validator';
import { authMiddleware } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { getOverview, getTopLinks, getVisitTrend, getHealthOverview, getColdLinks, getPatrolReports, getPatrolReportDetail } from '../controllers/statsController.js';

const router = Router();

// GET /api/stats/overview - 数据概览
router.get('/overview', authMiddleware, getOverview);

// GET /api/stats/links/top?days=7&limit=5 - 热门链接 TOP N
router.get(
  '/links/top',
  authMiddleware,
  [
    query('days').optional().isInt({ min: 1, max: 30 }).withMessage('days 需为 1-30 的整数'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('limit 需为 1-20 的整数'),
  ],
  validate,
  getTopLinks
);

// GET /api/stats/visits/trend?days=7 - 近 N 天每日访问趋势
router.get(
  '/visits/trend',
  authMiddleware,
  [
    query('days').optional().isInt({ min: 1, max: 30 }).withMessage('days 需为 1-30 的整数'),
  ],
  validate,
  getVisitTrend
);

// GET /api/stats/links/health - 链接健康总览（状态分布 + TLS 到期 + 连续失败 TOP）
router.get('/links/health', authMiddleware, getHealthOverview);

// GET /api/stats/links/cold?days=90 - 冷链接（N 天未访问）
router.get(
  '/links/cold',
  authMiddleware,
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days 需为 1-365 的整数'),
  ],
  validate,
  getColdLinks
);

// GET /api/stats/patrol/reports - 巡检历史报告（分页 / ?limit=N 取最近 N 条）
router.get(
  '/patrol/reports',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page 需为正整数'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize 需为 1-100 的整数'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit 需为 1-50 的整数'),
  ],
  validate,
  getPatrolReports
);

// GET /api/stats/patrol/reports/:id - 巡检报告详情（含异常链接明细）
router.get(
  '/patrol/reports/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('报告 id 非法'),
  ],
  validate,
  getPatrolReportDetail
);

export default router;
