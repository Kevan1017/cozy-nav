<script setup>
/**
 * 登录弹窗（全局）
 * 由 auth store 的 showLoginModal 控制，前台 / 后台任意页面都能弹出
 * 触发场景：
 * 1. 前台点击「管理」按钮且未登录
 * 2. 路由守卫发现未登录 / token 过期
 * 3. axios 拦截器收到 401（登录 token 过期）
 */
import { ref, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const authStore = useAuthStore();
const message = useMessage();

/** 弹窗显示状态，双向绑定 store */
const loginModal = ref(false);

const formRef = ref(null);
const formModel = reactive({
  username: '',
  password: '',
});
const loading = ref(false);

// immediate 兜底：路由守卫在组件挂载前已触发 openLoginModal 时，挂载后立即显示弹窗
watch(() => authStore.showLoginModal, (val) => {
  loginModal.value = val;
  if (val) {
    formModel.username = '';
    formModel.password = '';
  }
}, { immediate: true });

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 3, message: '密码至少 3 位', trigger: 'blur' },
  ],
};

/** 关闭登录弹窗 */
function closeLogin() {
  loginModal.value = false;
  authStore.closeLoginModal();
  formModel.username = '';
  formModel.password = '';
  formRef.value?.restoreValidation();
}

/** 执行登录 */
async function doLogin() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    await authStore.login(formModel.username, formModel.password);
    message.success('登录成功');
    closeLogin();
    router.push('/admin');
  } catch {
    message.error('用户名或密码错误');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <n-modal
    v-model:show="loginModal"
    :mask-closable="true"
    preset="dialog"
    :show-icon="false"
    class="login-modal"
  >
    <div class="login-modal-body">
      <div class="login-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round" />
        </svg>
      </div>
      <h2 class="login-title">管理后台</h2>
      <p class="login-hint">请登录以管理你的书签</p>

      <n-form
        ref="formRef"
        :model="formModel"
        :rules="rules"
        label-placement="top"
        size="large"
        class="login-form"
        @submit.prevent="doLogin"
      >
        <n-form-item path="username">
          <n-input
            v-model:value="formModel.username"
            placeholder="用户名"
            clearable
            autocomplete="username"
            size="large"
          >
            <template #prefix>👤</template>
          </n-input>
        </n-form-item>
        <n-form-item path="password">
          <n-input
            v-model:value="formModel.password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            autocomplete="current-password"
            size="large"
            @keyup.enter="doLogin"
          >
            <template #prefix>🔒</template>
          </n-input>
        </n-form-item>
        <n-button
          type="primary"
          block
          size="large"
          :loading="loading"
          @click="doLogin"
          style="margin-top: 4px;"
        >
          {{ loading ? '登录中...' : '登 录' }}
        </n-button>
      </n-form>
    </div>
  </n-modal>
</template>

<style scoped>
.login-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(8px, 2vw, 16px) 0 0;
}

.login-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--pop), var(--pop2));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--on-pop);
  box-shadow: 0 10px 24px -8px var(--pop);
  margin-bottom: 12px;
}

.login-icon svg {
  width: 26px;
  height: 26px;
}

.login-title {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: clamp(18px, 3.5vw, 22px);
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 4px;
}

.login-hint {
  font-size: 13px;
  color: var(--soft);
  margin-bottom: 16px;
  text-align: center;
}

.login-form {
  width: 100%;
}

:deep(.login-modal .n-modal) {
  width: clamp(300px, 90vw, 380px);
  border-radius: 20px !important;
  backdrop-filter: blur(20px);
}
</style>
