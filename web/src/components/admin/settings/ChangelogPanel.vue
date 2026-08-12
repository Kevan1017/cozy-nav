<script setup>
/**
 * 更新记录面板（「关于悦行」卡片内）：展示 + 维护每次版本修复记录
 * 支持新增 / 删除，数据存数据库 changelog 表，后台与前台版本信息同源
 */
import { ref, onMounted } from 'vue';
import {
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NEmpty,
  useMessage,
} from 'naive-ui';
import { changelogApi } from '../../../api/changelog.js';

const message = useMessage();

/** 更新记录列表 */
const list = ref([]);
const loading = ref(false);

/** 新增弹窗状态 */
const showModal = ref(false);
const saving = ref(false);
const form = ref({ version: '', description: '' });

/** 加载更新记录列表 */
async function loadList() {
  loading.value = true;
  try {
    const res = await changelogApi.list();
    list.value = res.data || [];
  } catch (err) {
    message.warning(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

/** 打开新增弹窗（清空表单） */
function openAdd() {
  form.value = { version: '', description: '' };
  showModal.value = true;
}

/** 提交新增记录 */
async function handleSubmit() {
  const version = form.value.version.trim();
  const description = form.value.description.trim();
  if (!version) { message.warning('请填写版本号'); return; }
  if (!description) { message.warning('请填写更新说明'); return; }
  saving.value = true;
  try {
    await changelogApi.create({ version, description });
    message.success('已添加');
    showModal.value = false;
    loadList();
  } catch (err) {
    message.warning(err.message || '添加失败');
  } finally {
    saving.value = false;
  }
}

/** 删除记录 */
async function handleRemove(item) {
  try {
    await changelogApi.remove(item.id);
    message.success('已删除');
    loadList();
  } catch (err) {
    message.warning(err.message || '删除失败');
  }
}

onMounted(loadList);
</script>

<template>
  <div class="changelog-panel">
    <div class="changelog-head">
      <span class="changelog-title">📝 更新记录</span>
      <n-button size="small" type="primary" ghost @click="openAdd">添加记录</n-button>
    </div>

    <n-empty v-if="!loading && !list.length" description="暂无更新记录" size="small" />
    <div v-else class="changelog-list">
      <div v-for="item in list" :key="item.id" class="changelog-item">
        <span class="changelog-ver">v{{ item.version }}</span>
        <span class="changelog-desc">{{ item.description }}</span>
        <span class="changelog-date">{{ (item.created_at || '').slice(0, 10) }}</span>
        <n-popconfirm @positive-click="handleRemove(item)">
          <template #trigger>
            <n-button size="tiny" quaternary type="error" class="changelog-del">删除</n-button>
          </template>
          确定删除这条记录？
        </n-popconfirm>
      </div>
    </div>

    <!-- 新增更新记录弹窗 -->
    <n-modal
      v-model:show="showModal"
      preset="card"
      title="添加更新记录"
      style="width: 460px; max-width: 92vw;"
    >
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item label="版本号" path="version">
          <n-input v-model:value="form.version" placeholder="如 1.0.1" maxlength="20" clearable />
        </n-form-item>
        <n-form-item label="更新说明" path="description">
          <n-input
            v-model:value="form.description"
            type="textarea"
            :rows="3"
            placeholder="本次改了什么（修复 / 新增 / 优化）"
            maxlength="500"
            show-count
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSubmit">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.changelog-panel {
  margin-top: 14px;
  border-top: 1px dashed var(--admin-border, rgba(0, 0, 0, .08));
  padding-top: 12px;
}
.changelog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.changelog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
}
.changelog-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.changelog-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--admin-bg-soft, rgba(0, 0, 0, .03));
  border-radius: 8px;
}
.changelog-ver {
  flex: none;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-accent);
  background: var(--admin-accent-soft, rgba(255, 138, 91, .15));
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.changelog-desc {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--admin-text);
  line-height: 1.5;
  word-break: break-all;
}
.changelog-date {
  flex: none;
  font-size: 12px;
  color: var(--admin-muted);
  white-space: nowrap;
}
.changelog-del {
  flex: none;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
