/**
 * 保险库状态管理
 * - 管理 accessToken / refreshToken 的存储与刷新
 * - 静默刷新：access_token 过期时自动用 refresh_token 换新
 * - 弹窗解锁：refresh_token 也过期时弹出密码框
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { vaultApi } from '../api/vault.js';

export const useVaultStore = defineStore('vault', () => {
  // 从 localStorage 恢复 token（前台用 localStorage 保持刷新后不丢失）
  const accessToken = ref(localStorage.getItem('vaultAccessToken') || '');
  const refreshToken = ref(localStorage.getItem('vaultRefreshToken') || '');

  // 是否已解锁
  const isUnlocked = computed(() => !!accessToken.value);

  // 是否正在刷新（防止并发）
  const isRefreshing = ref(false);
  // 等待刷新完成的请求队列
  const pendingRequests = ref([]);
  // 是否显示密码弹窗
  const showPasswordModal = ref(false);
  // 弹窗中等待密码输入的 resolve 队列（支持多个并发请求同时等待）
  const pendingPasswordResolvers = [];

  /**
   * 设置 Token 并持久化
   */
  function setTokens(access, refresh) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('vaultAccessToken', access);
    localStorage.setItem('vaultRefreshToken', refresh);
  }

  /**
   * 解锁保险库
   */
  async function unlock(password) {
    const res = await vaultApi.unlock(password);
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res;
  }

  /**
   * 锁定保险库（清除本地 token）
   */
  function lock() {
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('vaultAccessToken');
    localStorage.removeItem('vaultRefreshToken');
  }

  /**
   * 静默刷新 access_token
   * 如果已有刷新在进行中，返回同一个 Promise（防止并发）
   */
  async function refresh() {
    if (isRefreshing.value) {
      // 排队等待
      return new Promise((resolve, reject) => {
        pendingRequests.value.push({ resolve, reject });
      });
    }

    isRefreshing.value = true;
    try {
      const res = await vaultApi.refresh(refreshToken.value);
      setTokens(res.data.accessToken, res.data.refreshToken);
      // 释放所有等待中的请求
      pendingRequests.value.forEach(p => p.resolve(accessToken.value));
      pendingRequests.value = [];
      return accessToken.value;
    } catch (err) {
      // refresh_token 也过期了，清空状态，弹密码框
      lock();
      pendingRequests.value.forEach(p => p.reject(err));
      pendingRequests.value = [];
      showPasswordModal.value = true;
      throw err;
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * 等待用户输入密码并解锁
   * 由 axios 拦截器在 refresh 失败时调用，或由前台点击锁卡时调用
   * 支持多个并发请求同时等待同一个密码弹窗
   * 返回 Promise，在用户输入密码成功后 resolve 新 token
   */
  function waitForPassword() {
    showPasswordModal.value = true;
    return new Promise((resolve, reject) => {
      pendingPasswordResolvers.push({ resolve, reject });
    });
  }

  /**
   * 用户在弹窗中输入密码后调用
   * 解锁成功后释放所有等待中的请求
   */
  async function submitPassword(password) {
    await unlock(password);
    showPasswordModal.value = false;
    const token = accessToken.value;
    pendingPasswordResolvers.forEach(p => p.resolve(token));
    pendingPasswordResolvers.length = 0;
  }

  /**
   * 用户取消密码弹窗
   * 拒绝所有等待中的请求
   */
  function cancelPassword() {
    showPasswordModal.value = false;
    const err = new Error('用户取消解锁');
    pendingPasswordResolvers.forEach(p => p.reject(err));
    pendingPasswordResolvers.length = 0;
  }

  return {
    accessToken,
    refreshToken,
    isUnlocked,
    isRefreshing,
    showPasswordModal,
    setTokens,
    unlock,
    lock,
    refresh,
    waitForPassword,
    submitPassword,
    cancelPassword,
  };
});
