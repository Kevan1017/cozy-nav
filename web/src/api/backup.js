/**
 * 备份接口
 */
import request from './request.js';

export const backupApi = {
  /** 读取备份配置 */
  getConfig() {
    return request.get('/backup/config');
  },

  /** 保存备份配置 */
  saveConfig(data) {
    return request.put('/backup/config', data);
  },

  /** 立即备份（可选 pushGit 覆盖 Git 推送开关） */
  runNow(pushGit) {
    return request.post('/backup/run', { pushGit });
  },

  /** 最近备份记录列表 */
  list() {
    return request.get('/backup/list');
  },
};
