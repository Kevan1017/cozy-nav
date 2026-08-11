<script setup>
/**
 * 保险库解锁弹窗（全局）
 * 由 vault store 的 showPasswordModal 控制
 * 支持两种场景：
 * 1. 前台点击锁卡 → 手动弹出
 * 2. axios 拦截器 token 过期 → 自动弹出，输入后重试原请求
 */
import { ref, watch } from 'vue';
import { NModal, NInput, NButton } from 'naive-ui';
import { useVaultStore } from '../../stores/vault.js';

const vaultStore = useVaultStore();

const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

// 弹窗显示状态，双向绑定 store
const visible = ref(false);
watch(() => vaultStore.showPasswordModal, (val) => {
  visible.value = val;
  if (!val) {
    password.value = '';
    errorMsg.value = '';
  }
}, { immediate: true });

async function handleUnlock() {
  if (!password.value) {
    errorMsg.value = '请输入保险库密码';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    await vaultStore.submitPassword(password.value);
    password.value = '';
  } catch (err) {
    errorMsg.value = err.message || '解锁失败，请检查密码';
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  vaultStore.cancelPassword();
  password.value = '';
  errorMsg.value = '';
}
</script>

<template>
  <n-modal
    :show="visible"
    @update:show="(val) => { if (!val) handleClose(); }"
    preset="dialog"
    :show-icon="false"
    class="vault-modal"
    :mask-closable="false"
  >
    <div class="vault-modal-body">
      <div class="vault-icon">🔒</div>
      <h2 class="vault-title">保险库已锁定</h2>
      <p class="vault-hint">输入密码以查看加密分类和书签</p>
      <div class="vault-form">
        <n-input
          v-model:value="password"
          type="password"
          show-password-on="click"
          placeholder="保险库密码"
          :autofocus="true"
          @keyup.enter="handleUnlock"
        />
        <p v-if="errorMsg" class="vault-error">{{ errorMsg }}</p>
        <n-button
          type="primary"
          block
          :loading="loading"
          @click="handleUnlock"
        >
          解锁
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.vault-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
}

.vault-icon {
  font-size: clamp(32px, 7vw, 40px);
  line-height: 1;
}

.vault-title {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: clamp(16px, 3.5vw, 20px);
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.vault-hint {
  font-size: clamp(12px, 2.6vw, 13px);
  color: var(--soft);
  margin: 0 0 8px;
}

.vault-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vault-error {
  font-size: 12px;
  color: #e88080;
  margin: 0;
}
</style>
