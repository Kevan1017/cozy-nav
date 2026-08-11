/**
 * 偏好接口
 */
import request from './request.js';

export const prefsApi = {
  /** 获取偏好 */
  get() {
    return request.get('/preferences');
  },

  /** 获取通知配置（仅管理员，含渠道密码等敏感信息） */
  getNotifyConfig() {
    return request.get('/preferences/notify-config');
  },

  /** 更新偏好 */
  update(data) {
    return request.put('/preferences', data);
  },

  /** 上传站点 Logo（base64） */
  uploadLogo(dataUrl) {
    return request.post('/preferences/logo', { data: dataUrl });
  },

  /** 移除站点 Logo */
  removeLogo() {
    return request.delete('/preferences/logo');
  },

  /** 测试通知渠道：serverchan（sendKey）/ email（config） */
  sendTestNotify(payload) {
    return request.post('/preferences/notify-test', payload);
  },
};
