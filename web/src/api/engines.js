/**
 * 搜索引擎接口
 */
import request from './request.js';

export const enginesApi = {
  /** 获取启用的引擎列表（前台用） */
  list() {
    return request.get('/engines');
  },

  /** 获取所有引擎（含禁用，后台用） */
  listAll() {
    return request.get('/engines/all');
  },

  /** 创建引擎 */
  create(data) {
    return request.post('/engines', data);
  },

  /** 更新引擎 */
  update(id, data) {
    return request.put(`/engines/${id}`, data);
  },

  /** 删除引擎 */
  remove(id) {
    return request.delete(`/engines/${id}`);
  },

  /** 批量排序 */
  sort(orders) {
    return request.put('/engines/sort', { orders });
  },
};
