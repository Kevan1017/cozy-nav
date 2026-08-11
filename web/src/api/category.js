/**
 * 分类接口
 */
import request from './request.js';

export const categoryApi = {
  /**
   * 获取所有分类（含书签）
   * @param {boolean} skipAuth - true 时不带登录 token（前台公开访问）
   */
  getAll(skipAuth = false) {
    return request.get('/categories', { skipAuth });
  },

  /** 新建分类 */
  create(data) {
    return request.post('/categories', data);
  },

  /** 编辑分类 */
  update(id, data) {
    return request.put(`/categories/${id}`, data);
  },

  /** 删除分类 */
  remove(id) {
    return request.delete(`/categories/${id}`);
  },

  /** 回收站：已删除分类列表（pageSize 不传或为 0 时返回全量） */
  getTrash(page = 1, pageSize = 0) {
    return request.get('/categories/trash', { params: { page, pageSize } });
  },

  /** 回收站：恢复分类 */
  restore(id) {
    return request.post(`/categories/${id}/restore`);
  },

  /** 回收站：彻底删除分类（物理删除，不可恢复） */
  purge(id) {
    return request.delete(`/categories/${id}/purge`);
  },

  /** 切换分类锁定状态 */
  toggleLock(id, locked) {
    return request.put(`/categories/${id}/lock`, { locked });
  },

  /** 批量更新排序权重（上移/下移互换 sort_order） */
  sort(orders) {
    return request.put('/categories/sort', { orders });
  },
};
