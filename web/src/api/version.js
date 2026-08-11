/**
 * 版本信息接口：返回当前部署的 Git 版本信息（前台页脚 / 后台设置页展示）
 */
import request from './request.js';

export const versionApi = {
  /** 获取版本信息 */
  get() {
    return request.get('/version', { skipAuth: true });
  },
};
