<script setup>
/**
 * 设置页 - 安全设置卡片（合并 SettingsPassword + SettingsVault）
 * 单卡片内分段切换两个子项：
 * - 登录密码（修改管理员登录密码，成功后自动退出重新登录）
 * - 保险库（功能开关 / 设置密码 / 解锁 / 锁定 / 修改密码 / 忘记密码重置）
 */
import { ref, computed, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSwitch,
  NTag,
  NSpace,
  NCollapse,
  NCollapseItem,
  NModal,
  NTabs,
  NTabPane,
  useMessage,
  useDialog,
} from 'naive-ui';
import { authApi } from '../../../api/auth.js';
import { useAuthStore } from '../../../stores/auth.js';
import { vaultApi } from '../../../api/vault.js';
import { useVaultStore } from '../../../stores/vault.js';
import CollapsibleCard from './CollapsibleCard.vue';

const authStore = useAuthStore();
const vaultStore = useVaultStore();
const message = useMessage();
const dialog = useDialog();

/** 安全设置分段切换：password=登录密码 / vault=保险库 */
const securitySection = ref('password');

/* ---------- 登录密码（修改管理员登录密码） ---------- */
const pwdFormRef = ref(null);
const pwdSubmitting = ref(false);
const pwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const pwdRules = {
  oldPassword: { required: true, message: '请输入原密码', trigger: '' },
  newPassword: [
    { required: true, message: '请输入新密码', trigger: '' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: '' },
    {
      validator: (_r, value) => {
        if (!value) return true;
        if (value !== pwdForm.value.newPassword) return new Error('两次输入的密码不一致');
        return true;
      },
      trigger: '',
    },
  ],
};

async function handleChangePassword() {
  try {
    await pwdFormRef.value?.validate();
  } catch {
    return;
  }
  pwdSubmitting.value = true;
  try {
    await authApi.changePassword(pwdForm.value.oldPassword, pwdForm.value.newPassword);
    dialog.warning({
      title: '密码修改成功',
      content: '密码已更新，即将退出登录，请重新使用新密码登录。',
      closable: false,
      positiveText: '重新登录',
      onPositiveClick: () => {
        authStore.logout();
        window.location.href = '/';
      },
    });
  } catch (err) {
    message.warning(err.message || '修改密码失败');
  } finally {
    pwdSubmitting.value = false;
  }
}

/* ---------- 保险库 ---------- */
const vaultIsEnabled = ref(false);
const vaultIsSet = ref(false);
const vaultLoading = ref(false);
const vaultToggling = ref(false);
// 解锁状态从 vault store 获取（双 token 模式）
const vaultUnlocked = computed(() => vaultStore.isUnlocked);

/** 设置保险库密码表单 */
const setVaultFormRef = ref(null);
const setVaultSubmitting = ref(false);
const setVaultForm = ref({ password: '', confirmPassword: '' });
const setVaultRules = {
  password: [
    { required: true, message: '请输入保险库密码', trigger: '' },
    { min: 8, message: '保险库密码至少 8 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: '' },
    {
      validator: (_r, value) => {
        if (!value) return true;
        if (value !== setVaultForm.value.password) return new Error('两次输入的密码不一致');
        return true;
      },
      trigger: '',
    },
  ],
};

/** 解锁表单 */
const unlockFormRef = ref(null);
const unlockSubmitting = ref(false);
const unlockForm = ref({ password: '' });
const unlockRules = {
  password: { required: true, message: '请输入保险库密码', trigger: '' },
};

/** 修改保险库密码表单 */
const changeVaultFormRef = ref(null);
const changeVaultSubmitting = ref(false);
const changeVaultForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const changeVaultRules = {
  oldPassword: { required: true, message: '请输入原密码', trigger: '' },
  newPassword: [
    { required: true, message: '请输入新密码', trigger: '' },
    { min: 8, message: '保险库密码至少 8 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: '' },
    {
      validator: (_r, value) => {
        if (!value) return true;
        if (value !== changeVaultForm.value.newPassword) return new Error('两次输入的密码不一致');
        return true;
      },
      trigger: '',
    },
  ],
};

/** 查询保险库状态（是否已开启、是否已设置密码） */
async function fetchVaultStatus() {
  vaultLoading.value = true;
  try {
    const res = await vaultApi.getStatus();
    vaultIsEnabled.value = res.data.isEnabled;
    vaultIsSet.value = res.data.isSet;
  } catch (err) {
    // 静默处理，未登录时不必报错
  } finally {
    vaultLoading.value = false;
  }
}

/** 开启/关闭保险库功能 */
async function handleToggleVault(enabled) {
  if (!enabled) {
    // 关闭前确认
    const confirmed = await new Promise((resolve) => {
      dialog.warning({
        title: '关闭保险库',
        content: '关闭后将清除所有分类和书签的加密状态，确定要关闭吗？',
        positiveText: '确认关闭',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
      });
    });
    if (!confirmed) {
      // 用户取消，恢复开关状态
      vaultIsEnabled.value = true;
      return;
    }
  }

  vaultToggling.value = true;
  try {
    const res = await vaultApi.toggle(enabled);
    vaultIsEnabled.value = res.data.enabled;
    if (!enabled) {
      // 关闭后清除本地 token 和所有锁定状态
      vaultStore.lock();
      message.success('保险库已关闭，所有加密状态已清除');
    } else {
      message.success('保险库已开启');
    }
  } catch (err) {
    // 恢复原状态
    vaultIsEnabled.value = !enabled;
    message.warning(err.message || '操作失败');
  } finally {
    vaultToggling.value = false;
  }
}

/** 设置保险库密码（首次），设置成功后自动开启保险库并解锁 */
async function handleSetVaultPassword() {
  try {
    await setVaultFormRef.value?.validate();
  } catch {
    return;
  }
  setVaultSubmitting.value = true;
  try {
    const pwd = setVaultForm.value.password;
    await vaultApi.setPassword(pwd);
    // 自动开启保险库功能
    await vaultApi.toggle(true);
    vaultIsEnabled.value = true;
    vaultIsSet.value = true;
    setVaultForm.value = { password: '', confirmPassword: '' };
    // 设置成功后自动解锁（通过 vault store 管理 token）
    await vaultStore.unlock(pwd);
    message.success('保险库密码设置成功，功能已开启');
  } catch (err) {
    message.warning(err.message || '设置失败');
  } finally {
    setVaultSubmitting.value = false;
  }
}

/** 解锁保险库 */
async function handleUnlock() {
  try {
    await unlockFormRef.value?.validate();
  } catch {
    return;
  }
  unlockSubmitting.value = true;
  try {
    await vaultStore.unlock(unlockForm.value.password);
    unlockForm.value.password = '';
    message.success('保险库已解锁');
  } catch (err) {
    message.warning(err.message || '解锁失败');
  } finally {
    unlockSubmitting.value = false;
  }
}

/** 锁定保险库（清除本地 token） */
async function handleLock() {
  try {
    await vaultApi.lock();
    vaultStore.lock();
    message.success('保险库已锁定');
  } catch (err) {
    message.warning(err.message || '操作失败');
  }
}

/** 修改保险库密码（修改后旧 Token 失效，需重新解锁） */
async function handleChangeVaultPassword() {
  try {
    await changeVaultFormRef.value?.validate();
  } catch {
    return;
  }
  changeVaultSubmitting.value = true;
  try {
    await vaultApi.changePassword(
      changeVaultForm.value.oldPassword,
      changeVaultForm.value.newPassword
    );
    message.success('保险库密码修改成功，请重新解锁');
    changeVaultForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    // 后端已递增 lock_version 使旧 Token 失效，前端清除本地 token
    vaultStore.lock();
  } catch (err) {
    message.warning(err.message || '修改失败');
  } finally {
    changeVaultSubmitting.value = false;
  }
}

/* ---------- 忘记保险库密码重置 ---------- */
const showResetVaultModal = ref(false);
const resetVaultSubmitting = ref(false);
const resetVaultFormRef = ref(null);
const resetVaultForm = ref({ adminPassword: '', newPassword: '', confirmPassword: '' });
const resetVaultRules = {
  adminPassword: { required: true, message: '请输入管理员登录密码', trigger: '' },
  newPassword: [
    { required: true, message: '请输入新保险库密码', trigger: '' },
    { min: 8, message: '保险库密码至少 8 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: '' },
    {
      validator: (_r, value) => {
        if (!value) return true;
        if (value !== resetVaultForm.value.newPassword) return new Error('两次输入的密码不一致');
        return true;
      },
      trigger: '',
    },
  ],
};

/** 打开忘记密码弹窗 */
function openResetVaultModal() {
  resetVaultForm.value = { adminPassword: '', newPassword: '', confirmPassword: '' };
  showResetVaultModal.value = true;
}

/** 重置保险库密码 */
async function handleResetVaultPassword() {
  try {
    await resetVaultFormRef.value?.validate();
  } catch {
    return;
  }
  resetVaultSubmitting.value = true;
  try {
    await vaultApi.resetPassword(
      resetVaultForm.value.adminPassword,
      resetVaultForm.value.newPassword
    );
    showResetVaultModal.value = false;
    vaultIsSet.value = true;
    vaultIsEnabled.value = false;
    vaultStore.lock();
    message.success('保险库密码已重置，请重新开启保险库');
  } catch (err) {
    message.warning(err.message || '重置失败');
  } finally {
    resetVaultSubmitting.value = false;
  }
}

onMounted(() => {
  fetchVaultStatus();
});
</script>

<template>
  <!-- 安全设置卡片：分段切换 登录密码 / 保险库 -->
  <collapsible-card title="🔐 安全设置">
    <n-tabs v-model:value="securitySection" type="segment" size="small" style="margin-bottom: 14px;">
      <n-tab-pane name="password" tab="登录密码" />
      <n-tab-pane name="vault" tab="保险库" />
    </n-tabs>

    <!-- 登录密码：修改管理员登录密码 -->
    <div v-if="securitySection === 'password'" class="pwd-section">
      <p class="hint" style="margin-bottom: 14px;">
        密码至少 8 位，建议包含字母和数字。修改后将自动退出登录，需用新密码重新登录。
      </p>
      <n-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        label-placement="left"
        label-align="right"
        size="medium"
        class="pwd-form"
      >
        <n-form-item label="原密码" path="oldPassword">
          <n-input
            v-model:value="pwdForm.oldPassword"
            type="password"
            show-password-on="click"
            placeholder="请输入原密码"
          />
        </n-form-item>
        <n-form-item label="新密码" path="newPassword">
          <n-input
            v-model:value="pwdForm.newPassword"
            type="password"
            show-password-on="click"
            placeholder="至少 8 位，建议字母+数字"
          />
        </n-form-item>
        <n-form-item label="确认密码" path="confirmPassword">
          <n-input
            v-model:value="pwdForm.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="再次输入新密码"
          />
        </n-form-item>
        <n-form-item>
          <n-button
            type="primary"
            :loading="pwdSubmitting"
            @click="handleChangePassword"
          >
            确认修改
          </n-button>
        </n-form-item>
      </n-form>
    </div>

    <!-- 保险库：私密内容加密 -->
    <div v-if="securitySection === 'vault'" class="vault-section">
      <!-- 功能开关 -->
      <div class="vault-toggle-bar">
        <span class="vault-toggle-label">保险库功能</span>
        <n-switch
          :value="vaultIsEnabled"
          :loading="vaultToggling"
          @update:value="handleToggleVault"
        />
      </div>

      <!-- 未开启时 -->
      <template v-if="!vaultIsEnabled">
        <!-- 未设置密码：显示设置密码表单 -->
        <template v-if="!vaultIsSet">
          <p class="hint" style="margin: 12px 0 14px;">
            首次使用需设置保险库密码，设置后可开启加密功能。
          </p>
          <n-form
            ref="setVaultFormRef"
            :model="setVaultForm"
            :rules="setVaultRules"
            label-placement="left"
            label-align="right"
            size="medium"
            class="pwd-form"
          >
            <n-form-item label="密码" path="password">
              <n-input
                v-model:value="setVaultForm.password"
                type="password"
                show-password-on="click"
                placeholder="至少 8 位，建议字母+数字"
              />
            </n-form-item>
            <n-form-item label="确认密码" path="confirmPassword">
              <n-input
                v-model:value="setVaultForm.confirmPassword"
                type="password"
                show-password-on="click"
                placeholder="再次输入密码"
              />
            </n-form-item>
            <n-form-item>
              <n-button
                type="primary"
                :loading="setVaultSubmitting"
                @click="handleSetVaultPassword"
              >
                设置密码
              </n-button>
            </n-form-item>
          </n-form>
        </template>
        <!-- 已设置密码但未开启：提示开启 -->
        <p v-else class="hint" style="margin: 12px 0 0;">
          密码已设置，点击上方开关开启保险库功能。
        </p>
      </template>

      <!-- 已开启时显示完整功能 -->
      <template v-else>
        <!-- 状态指示器 -->
        <div class="vault-status-bar">
          <n-space align="center" :size="10">
            <n-tag
              :type="vaultIsSet ? (vaultUnlocked ? 'success' : 'warning') : 'default'"
              round
              size="small"
            >
              {{ vaultIsSet ? (vaultUnlocked ? '🔓 已解锁' : '🔒 已锁定') : '⚪ 未设置' }}
            </n-tag>
            <span class="hint">保护私密分类和书签，解锁后才能查看</span>
          </n-space>
        </div>

        <!-- 未设置密码：设置密码表单 -->
        <template v-if="!vaultIsSet">
          <p class="hint" style="margin: 12px 0 14px;">
            首次使用需设置保险库密码，至少 8 位，建议包含字母和数字。设置后可将分类或书签标记为加密。
          </p>
          <n-form
            ref="setVaultFormRef"
            :model="setVaultForm"
            :rules="setVaultRules"
            label-placement="left"
            label-align="right"
            size="medium"
            class="pwd-form"
          >
            <n-form-item label="密码" path="password">
              <n-input
                v-model:value="setVaultForm.password"
                type="password"
                show-password-on="click"
                placeholder="至少 8 位，建议字母+数字"
              />
            </n-form-item>
            <n-form-item label="确认密码" path="confirmPassword">
              <n-input
                v-model:value="setVaultForm.confirmPassword"
                type="password"
                show-password-on="click"
                placeholder="再次输入密码"
              />
            </n-form-item>
            <n-form-item>
              <n-button
                type="primary"
                :loading="setVaultSubmitting"
                @click="handleSetVaultPassword"
              >
                设置密码
              </n-button>
            </n-form-item>
          </n-form>
        </template>

        <!-- 已设置密码但未解锁：解锁表单 -->
        <template v-else-if="!vaultUnlocked">
          <p class="hint" style="margin: 12px 0 14px;">
            输入保险库密码以解锁查看加密内容。
          </p>
          <n-form
            ref="unlockFormRef"
            :model="unlockForm"
            :rules="unlockRules"
            label-placement="left"
            label-align="right"
            size="medium"
            class="pwd-form"
          >
            <n-form-item label="密码" path="password">
              <n-input
                v-model:value="unlockForm.password"
                type="password"
                show-password-on="click"
                placeholder="请输入保险库密码"
                @keyup.enter="handleUnlock"
              />
            </n-form-item>
            <n-form-item>
              <n-button
                type="primary"
                :loading="unlockSubmitting"
                @click="handleUnlock"
              >
                解锁
              </n-button>
            </n-form-item>
          </n-form>

          <!-- 修改密码（可折叠） -->
          <n-collapse class="vault-collapse">
            <n-collapse-item title="修改保险库密码" name="change">
              <n-form
                ref="changeVaultFormRef"
                :model="changeVaultForm"
                :rules="changeVaultRules"
                label-placement="left"
                label-align="right"
                size="medium"
                class="pwd-form"
              >
                <n-form-item label="原密码" path="oldPassword">
                  <n-input
                    v-model:value="changeVaultForm.oldPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入原密码"
                  />
                </n-form-item>
                <n-form-item label="新密码" path="newPassword">
                  <n-input
                    v-model:value="changeVaultForm.newPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="至少 8 位，建议字母+数字"
                  />
                </n-form-item>
                <n-form-item label="确认密码" path="confirmPassword">
                  <n-input
                    v-model:value="changeVaultForm.confirmPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="再次输入新密码"
                  />
                </n-form-item>
                <n-form-item>
                  <n-button
                    type="primary"
                    :loading="changeVaultSubmitting"
                    @click="handleChangeVaultPassword"
                  >
                    确认修改
                  </n-button>
                </n-form-item>
              </n-form>
            </n-collapse-item>
          </n-collapse>
        </template>

        <!-- 已解锁：锁定按钮 + 修改密码 -->
        <template v-else>
          <p class="hint" style="margin: 12px 0 14px;">
            保险库已解锁，加密内容可正常查看。修改密码后旧 Token 立即失效，需重新解锁。访问令牌 30 分钟有效，过期后自动静默刷新；7 天后需重新输入密码。
          </p>
          <n-space>
            <n-button type="warning" @click="handleLock">
              🔒 锁定保险库
            </n-button>
          </n-space>

          <!-- 修改密码（可折叠） -->
          <n-collapse class="vault-collapse">
            <n-collapse-item title="修改保险库密码" name="change">
              <n-form
                ref="changeVaultFormRef"
                :model="changeVaultForm"
                :rules="changeVaultRules"
                label-placement="left"
                label-align="right"
                size="medium"
                class="pwd-form"
              >
                <n-form-item label="原密码" path="oldPassword">
                  <n-input
                    v-model:value="changeVaultForm.oldPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入原密码"
                  />
                </n-form-item>
                <n-form-item label="新密码" path="newPassword">
                  <n-input
                    v-model:value="changeVaultForm.newPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="至少 8 位，建议字母+数字"
                  />
                </n-form-item>
                <n-form-item label="确认密码" path="confirmPassword">
                  <n-input
                    v-model:value="changeVaultForm.confirmPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="再次输入新密码"
                  />
                </n-form-item>
                <n-form-item>
                  <n-button
                    type="primary"
                    :loading="changeVaultSubmitting"
                    @click="handleChangeVaultPassword"
                  >
                    确认修改
                  </n-button>
                </n-form-item>
              </n-form>
            </n-collapse-item>
          </n-collapse>
        </template>
      </template>

      <!-- 忘记密码入口（已设置密码时显示） -->
      <div v-if="vaultIsSet" class="vault-forgot">
        <n-button
          text
          size="small"
          type="warning"
          @click="openResetVaultModal"
        >
          忘记保险库密码？
        </n-button>
      </div>
    </div>
  </collapsible-card>

  <!-- 重置保险库密码弹窗 -->
  <n-modal
    v-model:show="showResetVaultModal"
    title="重置保险库密码"
    preset="card"
    class="reset-vault-modal"
    style="width: 420px"
    :mask-closable="false"
  >
    <p class="hint" style="margin-bottom: 16px;">
      请输入<strong>管理员登录密码</strong>以验证身份，然后重新设置保险库密码。重置后保险库将自动关闭，需重新开启。
    </p>
    <n-form
      ref="resetVaultFormRef"
      :model="resetVaultForm"
      :rules="resetVaultRules"
      label-placement="left"
      label-align="right"
      size="medium"
    >
      <n-form-item label="管理员密码" path="adminPassword">
        <n-input
          v-model:value="resetVaultForm.adminPassword"
          type="password"
          show-password-on="click"
          placeholder="请输入登录密码"
        />
      </n-form-item>
      <n-form-item label="新保险库密码" path="newPassword">
        <n-input
          v-model:value="resetVaultForm.newPassword"
          type="password"
          show-password-on="click"
          placeholder="至少 8 位，建议字母+数字"
        />
      </n-form-item>
      <n-form-item label="确认密码" path="confirmPassword">
        <n-input
          v-model:value="resetVaultForm.confirmPassword"
          type="password"
          show-password-on="click"
          placeholder="再次输入新密码"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showResetVaultModal = false">取消</n-button>
        <n-button
          type="primary"
          :loading="resetVaultSubmitting"
          @click="handleResetVaultPassword"
        >
          确认重置
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.setting-card {
  border-radius: 18px !important;
  margin-bottom: 16px;
}
:deep(.n-card-header__main) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 16px;
  color: var(--admin-text);
}
.hint {
  font-size: 13px;
  color: var(--admin-muted);
  line-height: 1.6;
}

/* 密码表单 */
.pwd-form {
  max-width: 420px;
}

/* 右对齐表单：所有标签统一宽度，右边缘对齐 */
.pwd-form :deep(.n-form-item-label) {
  width: 64px !important;
  min-width: 64px !important;
  padding: 0 !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  text-align: right !important;
}

.pwd-form :deep(.n-form-item-blank) {
  padding: 0 !important;
  margin-left: 0 !important;
}

.pwd-form :deep(.n-form-item) {
  gap: 4px !important;
}

/* 保险库 */
.vault-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-peach, #f0e6d9);
  margin-bottom: 4px;
}

.vault-toggle-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--admin-text, #3d3929);
}

.vault-status-bar {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-peach, #f0e6d9);
  margin-bottom: 4px;
}

.vault-collapse {
  margin-top: 16px;
  border-top: 1px dashed var(--admin-peach, #f0e6d9);
  padding-top: 8px;
}

.vault-forgot {
  margin-top: 12px;
  text-align: center;
  padding-top: 10px;
  border-top: 1px dashed var(--admin-peach, #f0e6d9);
}

.reset-vault-modal :deep(.n-card) {
  border-radius: 16px;
}

:deep(.n-collapse-item__header-main) {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text2, #555);
}

:deep(.n-collapse-item__content-inner) {
  padding-top: 16px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .pwd-form {
    max-width: 100%;
  }
  .pwd-form :deep(.n-form-item-label) {
    font-size: 13px;
  }
  :deep(.n-space) {
    flex-wrap: wrap;
  }

  /* 保险库状态栏移动端换行 */
  .vault-status-bar :deep(.n-space) {
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .vault-status-bar .hint {
    font-size: 12px;
  }

  /* 折叠面板移动端间距优化 */
  .vault-collapse {
    margin-top: 12px;
  }
  :deep(.n-form-item) {
    margin-bottom: 18px;
  }
}
</style>
