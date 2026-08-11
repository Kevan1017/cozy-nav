/**
 * Axios 封装
 * 拦截器：token 注入 / vault 401 静默刷新 / 登录 401 弹窗 / 超时断网处理
 *
 * 错误处理策略：
 * - 不做 console 打印，只保留浏览器自带的网络错误提示
 * - reject 对象：始终携带 message/status/code/data，供组件 try/catch 使用
 * - silent 标记：表示拦截器已统一处理（如登录过期弹窗），组件可按需决定是否再次提示
 */
import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截：自动注入 token + 保险库 token
request.interceptors.request.use((config) => {
  // skipAuth=true 时不注入登录 token（前台公开访问分类列表时使用）
  if (!config.skipAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // 自动注入保险库 Token（如已解锁）
  const vaultToken = localStorage.getItem('vaultAccessToken');
  if (vaultToken) {
    config.headers['X-Vault-Token'] = vaultToken;
  }
  return config;
});

/**
 * 判断是否为保险库相关的 401 错误
 * 后端 vaultGuard 中间件返回的 401 消息包含"保险库"
 */
function isVaultError(responseData) {
  const msg = responseData?.message || '';
  return msg.includes('保险库') || msg.includes('vault');
}

// 响应拦截：统一错误处理
request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config || {};

    // ===== 保险库 Token 过期处理 =====
    // 条件：401 + 消息含"保险库" + 非刷新请求自身 + 未重试过
    if (
      error.response?.status === 401 &&
      isVaultError(error.response.data) &&
      !config._isVaultRefresh &&
      !config._vaultRetried
    ) {
      config._vaultRetried = true; // 防止无限重试

      // 动态导入避免循环依赖（vault.js → request.js → vault.js）
      const { useVaultStore } = await import('../stores/vault.js');
      const vaultStore = useVaultStore();

      try {
        // 1. 尝试用 refresh_token 静默刷新
        const newToken = await vaultStore.refresh();
        config.headers['X-Vault-Token'] = newToken;
        return request(config);
      } catch {
        // 2. refresh_token 也过期了，弹密码框等待用户输入
        try {
          const newToken = await vaultStore.waitForPassword();
          config.headers['X-Vault-Token'] = newToken;
          return request(config);
        } catch {
          // 用户取消解锁
          return Promise.reject({
            message: '保险库已锁定',
            status: 401,
            code: 401,
            silent: true,
          });
        }
      }
    }

    // ===== 常规错误处理 =====
    let message = '请求失败';
    let status = error.response?.status;
    let code = error.response?.data?.code || status;
    let data = error.response?.data;

    if (error.code === 'ECONNABORTED') {
      message = '请求超时，请稍后重试';
      status = null;
      code = 'TIMEOUT';
    } else if (!error.response) {
      message = '网络不可用';
      status = null;
      code = 'NETWORK_ERROR';
    } else if (status === 401) {
      // 登录 token 过期（非保险库）
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      // 触发登录弹窗（动态导入避免循环依赖）
      import('../stores/auth.js').then(({ useAuthStore }) => {
        const authStore = useAuthStore();
        authStore.openLoginModal();
      });
      message = '登录已过期，请重新登录';
    } else {
      message = data?.message || '请求失败';
    }

    return Promise.reject({ message, status, code, data, silent: true });
  }
);

export default request;
