/**
 * 保险库接口
 */
import request from './request.js';

export const vaultApi = {
  /** 查询保险库状态（是否已开启、是否已设置密码） */
  getStatus() {
    return request.get('/vault/status');
  },

  /** 开启/关闭保险库功能 */
  toggle(enabled) {
    return request.put('/vault/toggle', { enabled });
  },

  /** 设置保险库密码（首次） */
  setPassword(password) {
    return request.post('/vault/password', { password });
  },

  /** 修改保险库密码 */
  changePassword(oldPassword, newPassword) {
    return request.put('/vault/password', { oldPassword, newPassword });
  },

  /** 解锁保险库 */
  unlock(password) {
    return request.post('/vault/unlock', { password });
  },

  /** 锁定保险库 */
  lock() {
    return request.post('/vault/lock');
  },

  /** 刷新保险库 Token（用 refresh_token 静默换取新 token） */
  refresh(refreshToken) {
    // _isVaultRefresh 标记：防止 axios 拦截器对此请求的 401 再次触发刷新逻辑
    return request.post('/vault/refresh', { refreshToken }, { _isVaultRefresh: true });
  },

  /** 忘记密码 - 重置保险库密码（验证管理员登录密码后重置） */
  resetPassword(adminPassword, newPassword) {
    return request.post('/vault/reset-password', { adminPassword, newPassword });
  },
};
