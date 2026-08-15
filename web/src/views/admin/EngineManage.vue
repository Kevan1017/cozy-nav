<script setup>
/**
 * 搜索引擎管理页
 * - 列表展示所有引擎（含排序、启用状态）
 * - 新增 / 编辑引擎
 * - 启用 / 禁用
 * - 删除（至少保留一个）
 * - 拖拽排序
 * - 设置前台展示数量
 */
import { ref, computed, onMounted, h } from 'vue';
import {
  NPageHeader,
  NDataTable,
  NButton,
  NTag,
  NSwitch,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NSelect,
  NInputNumber,
  NSpace,
  NPopconfirm,
  NText,
  useMessage,
  useDialog,
} from 'naive-ui';
import { enginesApi } from '../../api/engines.js';
import { prefsApi } from '../../api/prefs.js';

const message = useMessage();
const dialog = useDialog();

const engines = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editingId = ref(null);
const formRef = ref(null);

const colorOptions = [
  { label: '天空蓝', value: 'sky' },
  { label: '薄荷绿', value: 'mint' },
  { label: '薰衣草', value: 'lav' },
  { label: '蜜桃橙', value: 'peach' },
  { label: '玫瑰粉', value: 'rose' },
  { label: '柠檬黄', value: 'butter' },
  { label: '珊瑚红', value: 'coral' },
  { label: '松石青', value: 'aqua' },
  { label: '橄榄绿', value: 'sage' },
  { label: '丁香紫', value: 'lilac' },
];

const defaultForm = () => ({
  name: '',
  label: '',
  key: '',
  url_template: '',
  color: 'sky',
  sort_order: 0,
  is_active: 1,
});

const formData = ref(defaultForm());

/** 启用状态（布尔值，用于 n-switch 双向绑定） */
const formActive = computed({
  get: () => formData.value.is_active === 1,
  set: (val) => { formData.value.is_active = val ? 1 : 0; },
});

const formRules = {
  name: { required: true, message: '请输入引擎名称', trigger: '' },
  label: { required: true, message: '请输入短标签（如 G/B/AI）', trigger: '' },
  key: { required: true, message: '请输入唯一标识（如 google）', trigger: '' },
  url_template: [
    {
      required: true,
      message: '请输入 URL 模板，使用 {q} 作为搜索词占位符',
      trigger: '',
    },
    {
      validator: (_r, value) => {
        if (!value) return true;
        if (!value.includes('{q}')) {
          return new Error('URL 模板必须包含 {q} 占位符');
        }
        return true;
      },
      trigger: 'blur',
    },
  ],
};

/** 前台展示数量 */
const displayCount = ref(3);
const savingCount = ref(false);

async function saveDisplayCount() {
  savingCount.value = true;
  try {
    await prefsApi.update({ engine_display_count: displayCount.value });
    message.success('展示数量已更新');
  } catch (err) {
    message.error(err.message || '保存失败');
  } finally {
    savingCount.value = false;
  }
}

/** 加载数据 */
async function loadData() {
  loading.value = true;
  try {
    const [engRes, prefsRes] = await Promise.all([
      enginesApi.listAll(),
      prefsApi.get(),
    ]);
    engines.value = engRes?.data || [];
    displayCount.value = prefsRes?.data?.engine_display_count || 3;
  } catch (err) {
    message.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

/** 打开新增/编辑弹窗 */
function openModal(row) {
  if (row) {
    editingId.value = row.id;
    formData.value = { ...row };
  } else {
    editingId.value = null;
    formData.value = defaultForm();
  }
  showModal.value = true;
}

/** 保存 */
async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  try {
    if (editingId.value) {
      await enginesApi.update(editingId.value, formData.value);
      message.success('更新成功');
    } else {
      await enginesApi.create(formData.value);
      message.success('创建成功');
    }
    showModal.value = false;
    await loadData();
  } catch (err) {
    message.error(err.message || '保存失败');
  }
}

/** 删除 */
async function handleDelete(row) {
  try {
    await enginesApi.remove(row.id);
    message.success('删除成功');
    await loadData();
  } catch (err) {
    message.error(err.message || '删除失败');
  }
}

/** 切换启用 */
async function toggleActive(row, val) {
  try {
    await enginesApi.update(row.id, { is_active: val ? 1 : 0 });
    row.is_active = val ? 1 : 0;
    message.success(val ? '已启用' : '已禁用');
  } catch (err) {
    message.error(err.message || '操作失败');
    row.is_active = row.is_active === 1 ? 0 : 1; // 回滚
  }
}

/** 上移 */
async function moveUp(row) {
  const idx = engines.value.findIndex((e) => e.id === row.id);
  if (idx <= 0) return;
  const prev = engines.value[idx - 1];
  const curOrder = row.sort_order;
  const prevOrder = prev.sort_order;
  try {
    await enginesApi.sort([
      { id: prev.id, sort_order: curOrder },
      { id: row.id, sort_order: prevOrder },
    ]);
    [engines.value[idx - 1], engines.value[idx]] = [engines.value[idx], engines.value[idx - 1]];
    message.success('已上移');
  } catch (err) {
    message.error(err.message || '操作失败');
  }
}

/** 下移 */
async function moveDown(row) {
  const idx = engines.value.findIndex((e) => e.id === row.id);
  if (idx >= engines.value.length - 1) return;
  const next = engines.value[idx + 1];
  const curOrder = row.sort_order;
  const nextOrder = next.sort_order;
  try {
    await enginesApi.sort([
      { id: row.id, sort_order: nextOrder },
      { id: next.id, sort_order: curOrder },
    ]);
    [engines.value[idx], engines.value[idx + 1]] = [engines.value[idx + 1], engines.value[idx]];
    message.success('已下移');
  } catch (err) {
    message.error(err.message || '操作失败');
  }
}

/** 表格列 */
const columns = computed(() => [
  {
    title: '排序',
    key: 'sort_order',
    width: 90,
    align: 'center',
    render(row) {
      return h(NSpace, { size: 4 }, () => [
        h(NButton, {
          size: 'tiny',
          disabled: engines.value.indexOf(row) === 0,
          onClick: () => moveUp(row),
        }, () => '↑'),
        h(NButton, {
          size: 'tiny',
          disabled: engines.value.indexOf(row) === engines.value.length - 1,
          onClick: () => moveDown(row),
        }, () => '↓'),
      ]);
    },
  },
  { title: '名称', key: 'name', width: 160 },
  {
    title: '标签',
    key: 'label',
    width: 80,
    render(row) {
      return h(NTag, { size: 'small', round: true }, () => row.label);
    },
  },
  { title: '标识', key: 'key', width: 140 },
  {
    title: 'URL 模板',
    key: 'url_template',
    ellipsis: { tooltip: true },
  },
  {
    title: '颜色',
    key: 'color',
    width: 90,
    render(row) {
      return h(NTag, { size: 'small', type: 'info' }, () => row.color);
    },
  },
  {
    title: '启用',
    key: 'is_active',
    width: 80,
    align: 'center',
    render(row) {
      return h(NSwitch, {
        value: row.is_active === 1,
        'onUpdate:value': (val) => toggleActive(row, val),
      });
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 4 }, () => [
        h(NButton, { size: 'small', onClick: () => openModal(row) }, () => '编辑'),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
            default: () => '确定删除吗？',
          }
        ),
      ]);
    },
  },
]);

onMounted(loadData);
</script>

<template>
  <div class="page">
    <n-page-header
      title="🔎 搜索引擎管理"
      subtitle="添加、编辑前台可用的搜索引擎"
      class="page-header"
    />

    <!-- 展示数量设置 -->
    <div class="display-count">
      <span class="count-label">前台展示数量：</span>
      <n-input-number v-model:value="displayCount" :min="1" :max="10" size="small" />
      <n-button
        size="small"
        type="primary"
        :loading="savingCount"
        @click="saveDisplayCount"
      >保存</n-button>
      <span class="count-hint">（前台搜索框只显示前 N 个启用的引擎）</span>
    </div>

    <!-- 引擎列表 -->
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">引擎列表</span>
        <n-button type="primary" @click="openModal()">+ 新增引擎</n-button>
      </div>

      <n-data-table
        :columns="columns"
        :data="engines"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        :scroll-x="1180"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <n-modal
      v-model:show="showModal"
      :title="editingId ? '编辑引擎' : '新增引擎'"
      preset="card"
      :style="{ maxWidth: '560px' }"
      mask-closable
    >
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        :validate-on-rule-change="false"
        label-placement="left"
        label-align="right"
        :label-width="120"
      >
        <n-form-item label="引擎名称" path="name">
          <n-input v-model:value="formData.name" placeholder="如：Google" />
        </n-form-item>
        <n-form-item label="短标签" path="label">
          <n-input v-model:value="formData.label" placeholder="如：G / B / AI" maxlength="10" />
        </n-form-item>
        <n-form-item label="唯一标识" path="key">
          <n-input v-model:value="formData.key" placeholder="如：google" />
        </n-form-item>
        <n-form-item label="URL 模板" path="url_template">
          <n-input
            v-model:value="formData.url_template"
            placeholder="如：https://www.google.com/search?q={q}"
          />
        </n-form-item>
        <n-form-item label="主题颜色">
          <n-select
            v-model:value="formData.color"
            :options="colorOptions"
            placeholder="选择颜色"
          />
        </n-form-item>
        <n-form-item label="启用状态">
          <n-switch v-model:value="formActive" />
          <span class="status-label">{{ formActive ? '启用' : '禁用' }}</span>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="handleSave">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 16px;
}
:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
}

.display-count {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: var(--admin-card-solid);
  border-radius: 14px;
  margin-bottom: 16px;
  border: 1px solid var(--admin-border);
}
.count-label {
  font-weight: 600;
  color: var(--admin-text-2);
  font-size: 14px;
}
.count-hint {
  font-size: 12px;
  color: var(--admin-muted);
  margin-left: 8px;
}

/* 小屏：标签/输入框/按钮一行，提示文本独占一行，避免错位 */
@media (max-width: 768px) {
  .display-count {
    flex-wrap: wrap;
    row-gap: 10px;
  }
  .count-label {
    flex-shrink: 0;
  }
  .display-count :deep(.n-input-number) {
    width: 100px;
    flex-shrink: 0;
  }
  .count-hint {
    flex-basis: 100%;
    margin-left: 0;
    padding-left: 2px;
  }
}

.table-wrap {
  background: var(--admin-card-solid);
  border-radius: 14px;
  padding: 16px;
  border: 1px solid var(--admin-border);
}
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.table-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--admin-text);
}

.status-label {
  margin-left: 10px;
  font-size: 13px;
  color: var(--admin-muted);
}
</style>
