/**
 * 认证状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api/auth.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const username = ref(localStorage.getItem('username') || '');
  const showLoginModal = ref(false);

  const isLoggedIn = computed(() => !!token.value);

  /** 管理员登录 */
  async function login(user, password) {
    const res = await authApi.login(user, password);
    // 登录失败返回 HTTP 200 + 业务码（body.code），此处统一拦截抛出
    if (res.code !== 200) {
      throw { message: res.message || '登录失败' };
    }
    token.value = res.data.token;
    username.value = res.data.username;
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('username', res.data.username);
    return res;
  }

  /** 退出登录 */
  function logout() {
    token.value = '';
    username.value = '';
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // 清除保险库 Token（双 token 模式）
    localStorage.removeItem('vaultAccessToken');
    localStorage.removeItem('vaultRefreshToken');
  }

  /** 显示登录弹窗（401 或未登录访问后台时调用） */
  function openLoginModal() {
    showLoginModal.value = true;
  }

  /** 关闭登录弹窗 */
  function closeLoginModal() {
    showLoginModal.value = false;
  }

  return { token, username, isLoggedIn, showLoginModal, login, logout, openLoginModal, closeLoginModal };
});
