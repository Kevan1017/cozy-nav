/**
 * 统计接口
 */
import request from './request.js';

export const statsApi = {
  /** 数据概览 */
  getOverview() {
    return request.get('/stats/overview');
  },
  /** 热门链接 TOP N（近 days 天） */
  getTopLinks(days = 7, limit = 5) {
    return request.get('/stats/links/top', { params: { days, limit } });
  },
  /** 近 N 天每日访问趋势 */
  getVisitTrend(days = 7) {
    return request.get('/stats/visits/trend', { params: { days } });
  },
  /** 链接健康总览（状态分布 + TLS 到期 + 连续失败 TOP） */
  getHealthOverview() {
    return request.get('/stats/links/health');
  },
  /** 巡检历史报告（分页列表） */
  getPatrolReports(page = 1, pageSize = 10) {
    return request.get('/stats/patrol/reports', { params: { page, pageSize } });
  },
  /** 巡检趋势（最近 N 轮，不分页，供趋势图） */
  getPatrolTrend(limit = 10) {
    return request.get('/stats/patrol/reports', { params: { limit } });
  },
  /** 巡检报告详情（含本轮异常链接明细） */
  getPatrolReportDetail(id) {
    return request.get(`/stats/patrol/reports/${id}`);
  },
};
