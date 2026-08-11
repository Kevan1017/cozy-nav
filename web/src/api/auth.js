/**
 * 认证接口
 */
import request from './request.js';

export const authApi = {
  /** 管理员登录 */
  login(username, password) {
    return request.post('/auth/login', { username, password });
  },

  /** 修改密码 */
  changePassword(oldPassword, newPassword) {
    return request.post('/auth/change-password', { oldPassword, newPassword });
  },
};
