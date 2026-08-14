/**
 * 书签接口
 */
import request from './request.js';

export const linkApi = {
  /** 新建书签 */
  create(data) {
    return request.post('/links', data);
  },

  /** 批量新建书签（items: [{ name, url, avatar_text, avatar_color }]） */
  batchCreate(categoryId, items) {
    return request.post('/links/batch', { category_id: categoryId, items });
  },

  /** 编辑书签 */
  update(id, data) {
    return request.put(`/links/${id}`, data);
  },

  /** 删除书签 */
  remove(id) {
    return request.delete(`/links/${id}`);
  },

  /** 回收站：已删除书签列表（pageSize 不传或为 0 时返回全量） */
  getTrash(page = 1, pageSize = 0) {
    return request.get('/links/trash', { params: { page, pageSize } });
  },

  /** 回收站：恢复书签 */
  restore(id) {
    return request.post(`/links/${id}/restore`);
  },

  /** 回收站：彻底删除书签（物理删除，不可恢复） */
  purge(id) {
    return request.delete(`/links/${id}/purge`);
  },

  /** 置顶/取消置顶 */
  togglePin(id, pinned, order) {
    return request.put(`/links/${id}/pin`, { pinned, order });
  },

  /** 标记/取消标记常用书签 */
  toggleFavorite(id, favorite) {
    return request.put(`/links/${id}/favorite`, { favorite });
  },

  /** 切换书签锁定状态 */
  toggleLock(id, locked) {
    return request.put(`/links/${id}/lock`, { locked });
  },

  /** 手动获取书签 favicon（已有书签 ID） */
  fetchFavicon(id) {
    return request.post(`/links/${id}/fetch-favicon`);
  },

  /** 上传自定义 favicon 图标（data URL） */
  uploadFavicon(id, dataUrl) {
    return request.post(`/links/${id}/upload-favicon`, { dataUrl });
  },

  /** 移除书签 favicon（回退字母头像） */
  removeFavicon(id) {
    return request.delete(`/links/${id}/favicon`);
  },

  /** 按 URL 抓取 favicon（创建时无 ID） */
  fetchFaviconByUrl(url) {
    return request.post('/favicon/fetch', { url });
  },

  /** 获取网页标题 */
  fetchTitle(url) {
    return request.get('/links/fetch-title', { params: { url } });
  },

  /** 记录书签访问时间（公开埋点，点击书签时调用） */
  visit(id) {
    return request.post(`/links/${id}/visit`);
  },

  /** 检测单个链接可用性 */
  checkLink(id) {
    return request.post(`/links/${id}/check`);
  },

  /** 批量检测所有链接可用性 */
  checkAll() {
    return request.post('/links/check-all');
  },

  /** 查询批量检测进度 */
  checkProgress() {
    return request.get('/links/check-progress');
  },

  /** 异常链接分页列表（巡检页批量处理） */
  getIssues(page = 1, pageSize = 20) {
    return request.get('/links/issues', { params: { page, pageSize } });
  },

  /** 批量重新检测指定链接 */
  batchCheck(ids) {
    return request.post('/links/batch-check', { ids });
  },

  /** 批量移动书签到目标分类 */
  batchMove(ids, categoryId) {
    return request.put('/links/batch-move', { ids, category_id: categoryId });
  },

  /** 批量重置链接健康状态（清空判死/失败记录） */
  batchResetHealth(ids) {
    return request.put('/links/health/reset', { ids });
  },
};
