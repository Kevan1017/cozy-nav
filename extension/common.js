/* cozy·nav 扩展共享工具（popup 与 background 共用，非 ES Module）
 * - 服务器地址 / 登录 Token / 最近使用分类 存 chrome.storage.local
 * - api() 统一封装：拼地址、带鉴权头、解析项目统一响应 { code, message, data }
 */
const CNAV = {
  STORAGE_KEYS: {
    serverUrl: 'cnav_serverUrl',
    token: 'cnav_token',
    lastCategoryId: 'cnav_lastCategoryId',
  },

  /** 读取服务器地址（去掉尾部斜杠） */
  async getServerUrl() {
    const { [this.STORAGE_KEYS.serverUrl]: url } = await chrome.storage.local.get(this.STORAGE_KEYS.serverUrl);
    return (url || '').trim().replace(/\/+$/, '');
  },

  /** 保存服务器地址 */
  async saveServerUrl(url) {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.serverUrl]: url.trim().replace(/\/+$/, '') });
  },

  /** 读取登录 Token */
  async getToken() {
    const { [this.STORAGE_KEYS.token]: t } = await chrome.storage.local.get(this.STORAGE_KEYS.token);
    return t || '';
  },

  /** 保存登录 Token */
  async saveToken(token) {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.token]: token });
  },

  /** 清除登录 Token（退出登录） */
  async clearToken() {
    await chrome.storage.local.remove(this.STORAGE_KEYS.token);
  },

  /** 读取最近使用的分类 ID */
  async getLastCategoryId() {
    const { [this.STORAGE_KEYS.lastCategoryId]: id } = await chrome.storage.local.get(this.STORAGE_KEYS.lastCategoryId);
    return id || null;
  },

  /** 记录最近使用的分类 ID */
  async saveLastCategoryId(id) {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.lastCategoryId]: id });
  },

  /**
   * 统一 API 请求
   * @param {string} path - 接口路径（如 /api/links）
   * @param {object} [opts] - { method, body, auth }
   * @returns {Promise<{ ok: boolean, code: number, message: string, data: any }>}
   */
  async api(path, { method = 'GET', body = null, auth = true } = {}) {
    const serverUrl = await this.getServerUrl();
    if (!serverUrl) {
      return { ok: false, code: 0, message: '请先在设置中填写服务器地址', data: null };
    }
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = await this.getToken();
      if (!token) {
        return { ok: false, code: 401, message: '尚未登录，请先登录', data: null };
      }
      headers['Authorization'] = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetch(serverUrl + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { ok: false, code: 0, message: '无法连接服务器，请检查地址', data: null };
    }
    let json = null;
    try { json = await res.json(); } catch { /* 非 JSON 响应 */ }
    if (!json) {
      return { ok: false, code: res.status, message: `服务器返回异常（HTTP ${res.status}）`, data: null };
    }
    return { ok: json.code === 200, code: json.code, message: json.message || '', data: json.data };
  },
};
