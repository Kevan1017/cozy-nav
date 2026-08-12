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

  /** 立即备份（增量判断：数据无变化则跳过；启用 WebDAV 同步上传云端） */
  runNow() {
    return request.post('/backup/run');
  },

  /** 测试坚果云 WebDAV 连接（不保存配置） */
  testWebdav(data) {
    return request.post('/backup/webdav-test', { webdav: data });
  },

  /** 最近备份记录列表 */
  list() {
    return request.get('/backup/list');
  },
};
