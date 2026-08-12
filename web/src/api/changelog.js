import request from './request.js';

/** 更新记录接口（后台「关于悦行」维护版本修复记录） */
export const changelogApi = {
  /** 获取更新记录列表 */
  list() { return request.get('/changelog'); },
  /** 新增更新记录 */
  create(data) { return request.post('/changelog', data); },
  /** 删除更新记录 */
  remove(id) { return request.delete(`/changelog/${id}`); },
};
