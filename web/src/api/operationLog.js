/**
 * 操作日志接口
 */
import request from './request.js';

export const operationLogApi = {
  /** 分页查询操作日志（module: 模块筛选，keyword: 关键字模糊搜索） */
  getLogs(params = {}) {
    return request.get('/operation-logs', { params });
  },

  /** 清空操作日志 */
  clearAll() {
    return request.delete('/operation-logs');
  },
};
