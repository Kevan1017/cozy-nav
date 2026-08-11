<script setup>
/**
 * 分类管理页（Naive UI 版本）
 * - PC 端：n-data-table（组件内部分格对齐，永不跑偏）
 * - 移动端：n-list 列表 + n-card 装饰
 * - 弹窗：n-modal + n-form（自带层级、ESC、遮罩）
 * - Emoji 选择面板：n-popover（自带定位、点击外部自动关闭）
 * - 表单校验、删除确认均走 Naive 的组件 API
 * - 回收站 已拆分为独立子组件：CategoryTrashTable（恢复/彻底删除/批量操作）
 */
import { ref, onMounted, h, computed, nextTick, watch } from 'vue';
import { useDataStore } from '../../stores/data.js';
import { useResponsive } from '../../composables/useResponsive.js';
import { usePagination } from '../../composables/usePagination.js';
import { useBatchOps } from '../../composables/useBatchOps.js';
import { BG_COLORS, pickRandom, resolveColor, displayHex } from '../../composables/useColor.js';
import { renderEmoji } from '../../composables/useRenderCell.js';
import { vaultApi } from '../../api/vault.js';
import { categoryApi } from '../../api/category.js';
import {
  NPageHeader,
  NButton,
  NDataTable,
  NCard,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPopover,
  NTag,
  NSpace,
  NEmpty,
  NCheckbox,
  useDialog,
  useMessage,
} from 'naive-ui';
import CategoryTrashTable from '../../components/admin/categorymanage/CategoryTrashTable.vue';

const dataStore = useDataStore();
const { isMobileView } = useResponsive();
const dialog = useDialog();
const message = useMessage();

/* ---------- 常量：Emoji 与 tokens.css 对齐 ---------- */

const EMOJI_LIST = [
  '🧭', '🔥', '⚡', '💡', '🎨', '🎯', '💎', '🌙',
  '⭐', '🍀', '🌿', '🌸', '🌊', '🌵', '🍓', '🍰',
  '☕', '🍵', '🎸', '🎮', '📚', '💻', '📱', '🎬',
  '🎧', '🎁', '🚀', '✈️', '🏠', '🏖️', '⚽', '🏀',
  '🧩', '🎲', '🖌️', '🧪', '🧬', '🔬', '🌱', '🍁',
  '🦋', '🐱', '🐶', '🐼', '🐸', '🍎', '🍉', '🍇',
  '🍕', '🍔', '🧁', '🍩', '🍪', '🍫', '🎂', '🧃',
  '🧸', '🎈', '🎠', '🎪', '🎡', '🎢', '🚲', '🏔️',
  '🌍', '🌎', '🌏', '☂️', '🌞', '🌈', '❄️', '⚓',
  '🚂', '🚗', '🛸', '🛰️', '🪐', '🌠', '🌌', '🔮',
  '🖼️', '📝', '📌', '💬', '🔔', '🔑', '🗝️', '💼',
  '🛠️', '🧰', '⚙️', '🧱', '🏗️', '🏛️', '🗽', '🗺️',
  '🧵', '🪡', '🧶', '🖍️', '✏️', '🖋️', '🔒', '🔓'
];

/* ---------- 弹窗 & 表单 ---------- */

const modalShow = ref(false);
const modalMode = ref('create'); // 'create' | 'edit'
const submitting = ref(false);
const formRef = ref(null);
const { pagination, syncItemCount, onPageSizeChange, onPageChange } = usePagination();

watch(
  () => dataStore.categories.length,
  (len) => syncItemCount(len),
  { immediate: true }
);
const form = ref({
  id: null,
  name: '',
  subtitle: '',
  emoji: '🧭',
  bg_color: 'peach',
  sort_order: 0,
});

const rules = {
  name: { required: true, message: '请输入分类名称', trigger: ['input', 'submit'] },
  // 排序权重允许留空（留空 = 后端自动排末尾），仅输入数字时校验 ≥ 0
  sort_order: {
    validator: (_rule, value) => value === null || value === undefined || value === '' || (typeof value === 'number' && value >= 0),
    message: '排序权重需 ≥ 0',
    trigger: ['input', 'submit'],
  },
};

function resetFormFixed() {
  form.value = { id: null, name: '', subtitle: '', emoji: '🧭', bg_color: 'peach', sort_order: null };
}

function openCreate() {
  resetFormFixed();
  modalMode.value = 'create';
  modalShow.value = true;
  nextTick(() => formRef.value?.restoreValidation());
}

function openEdit(cat) {
  form.value = { ...cat };
  modalMode.value = 'edit';
  modalShow.value = true;
  nextTick(() => formRef.value?.restoreValidation());
}

function randomEmoji() { form.value.emoji = pickRandom(EMOJI_LIST); }
function randomBg() { form.value.bg_color = pickRandom(BG_COLORS); }

async function saveCategory() {
  try {
    await formRef.value?.validate();
  } catch {
    message.warning('请检查表单填写是否正确');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      name: (form.value.name || '').trim(),
      subtitle: (form.value.subtitle || '').trim() || null,
      emoji: form.value.emoji || '🧭',
      bg_color: form.value.bg_color,
      sort_order: form.value.sort_order ?? null,
    };
    if (modalMode.value === 'create') {
      await dataStore.createCategory(payload);
      message.success('分类已创建');
    } else {
      await dataStore.updateCategory(form.value.id, payload);
      message.success('分类已更新');
    }
    modalShow.value = false;
  } catch (e) {
    // axios 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

/* ---------- 删除（n-dialog.confirm） ---------- */

function askDelete(cat) {
  dialog.warning({
    title: '确认删除分类',
    content: `将删除分类「${cat.name}」及所有下属书签，操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await dataStore.deleteCategory(cat.id);
        message.success('已删除');
      } catch { /* noop */ }
    },
  });
}

/* ---------- 上移/下移（按显示顺序全量重新编号 sort_order） ---------- */

/**
 * 将分类上移/下移一格并全量重排 sort_order
 * 说明：仅互换相邻两条的 sort_order 在值重复时（如导入数据全部为 0）无效，
 * 因此改为按新显示顺序统一重新编号（1..N），保证每个分类的 sort_order 唯一且与显示顺序一致。
 * @param {Object} cat - 目标分类
 * @param {number} delta - -1=上移，1=下移
 */
async function moveCategory(cat, delta) {
  const list = dataStore.categories;
  const idx = list.findIndex((c) => c.id === cat.id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= list.length) return;
  // 交换相邻两条得到新显示顺序
  const arr = [...list];
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  // 全量重新编号，保证 sort_order 唯一
  const orders = arr.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
  try {
    await categoryApi.sort(orders);
    // 通过 store action 同步本地：新顺序 + 新 sort_order 值，界面即时更新
    dataStore.updateCategoriesOrder(orders);
    message.success(delta < 0 ? '已上移' : '已下移');
  } catch (err) {
    message.error(err.message || '操作失败');
  }
}

/** 上移一格 */
async function moveUp(cat) {
  await moveCategory(cat, -1);
}

/** 下移一格 */
async function moveDown(cat) {
  await moveCategory(cat, 1);
}

/* ---------- 加密/解密 ---------- */
const vaultIsEnabled = ref(false);
const vaultIsSet = ref(false);

async function handleToggleLock(cat) {
  if (!vaultIsEnabled.value) {
    message.warning('请先在网站设置中开启保险库功能');
    return;
  }
  if (!vaultIsSet.value) {
    message.warning('请先在网站设置中设置保险库密码');
    return;
  }
  const willLock = !cat.is_locked;
  try {
    await dataStore.toggleCategoryLock(cat.id, willLock);
    message.success(willLock ? '已加密' : '已解密');
  } catch (e) {
    message.warning(e.message || '操作失败');
  }
}

/* ---------- 批量删除 ---------- */
const checkedRowKeys = ref([]);
const batchDeleting = ref(false);

function askBatchDelete() {
  if (!checkedRowKeys.value.length) {
    message.warning('请先勾选要删除的分类');
    return;
  }
  const count = checkedRowKeys.value.length;
  dialog.warning({
    title: '确认批量删除',
    content: `将删除选中的 ${count} 个分类及其所有下属书签，操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      batchDeleting.value = true;
      try {
        for (const id of checkedRowKeys.value) {
          await dataStore.deleteCategory(id);
        }
        message.success(`已删除 ${count} 个分类`);
        checkedRowKeys.value = [];
      } catch { /* noop */ }
      finally { batchDeleting.value = false; }
    },
  });
}

/* ---------- 回收站（逻辑已拆分到 CategoryTrashTable） ---------- */
const trashMode = ref(false);

function openTrash() {
  trashMode.value = true;
}
function closeTrash() {
  trashMode.value = false;
}

/* ---------- 表格列（PC 端） ---------- */

/* Emoji 小色块渲染复用 useRenderCell.js 的 renderEmoji */

/** 渲染颜色名圆点 */
function renderColorDot(cat) {
  return h('span', { class: 'color-inline' }, [
    h('span', {
      class: 'dot',
      style: { background: resolveColor(cat.bg_color) },
    }),
    ' ',
    displayHex(cat.bg_color) || '—',
  ]);
}

const tableColumns = computed(() => {
  const cols = [
    { type: 'selection' },
    { title: 'ID', key: 'id', width: 64, align: 'center', sorter: (a, b) => a.id - b.id },
    {
      title: '排序', key: 'sort_order', width: 128, align: 'center',
      sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      render: (row) => h('div', { class: 'sort-cell' }, [
        h('span', { class: 'sort-val' }, row.sort_order ?? 0),
        h(NButton, { size: 'tiny', quaternary: true, title: '上移', onClick: () => moveUp(row) }, () => '↑'),
        h(NButton, { size: 'tiny', quaternary: true, title: '下移', onClick: () => moveDown(row) }, () => '↓'),
      ]),
    },
    {
      title: 'Emoji', key: 'emoji', width: 96, align: 'center',
      render: (row) => renderEmoji(row),
    },
    {
      title: '名称', key: 'name', ellipsis: { tooltip: true },
      sorter: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'),
      render: (row) => h('strong', { style: 'color: var(--admin-text); font-weight:600' }, row.name),
    },
    {
      title: '副标题', key: 'subtitle', ellipsis: { tooltip: true },
      render: (row) => h('span', { style: 'color: var(--admin-muted)' }, row.subtitle || '—'),
    },
    {
      title: '背景色', key: 'bg_color', width: 140,
      render: (row) => renderColorDot(row),
    },
    {
      title: '书签数', key: 'linkCount', width: 100, align: 'center',
      render: (row) => h(NTag, { round: true, type: 'info', size: 'small' },
        () => row.links?.length ?? 0
      ),
    },
  ];

  // 保险库开启时才显示加密列和加密按钮
  if (vaultIsEnabled.value) {
    cols.push({
      title: '加密', key: 'is_locked', width: 90, align: 'center',
      render: (row) => h(NTag, {
        round: true, size: 'small',
        type: row.is_locked ? 'warning' : 'default',
      }, () => row.is_locked ? '🔒 已加密' : '—'),
    });
  }

  cols.push({
    title: '操作', key: 'ops', width: vaultIsEnabled.value ? 230 : 170, align: 'right',
    render: (row) => h(NSpace, { size: 6, align: 'center' }, () => {
      const btns = [];
      if (vaultIsEnabled.value) {
        btns.push(h(NButton, {
          size: 'small', quaternary: true,
          type: row.is_locked ? 'warning' : 'info',
          onClick: () => handleToggleLock(row),
        }, () => row.is_locked ? '🔓 解密' : '🔒 加密'));
      }
      btns.push(h(NButton, {
        size: 'small', type: 'primary', quaternary: true,
        onClick: () => openEdit(row),
      }, () => '编辑'));
      btns.push(h(NButton, {
        size: 'small', type: 'error', tertiary: true,
        onClick: () => askDelete(row),
      }, () => '删除'));
      return btns;
    }),
  });

  return cols;
});

/* ---------- 生命周期 ---------- */

onMounted(() => {
  if (!dataStore.categories.length) dataStore.fetchCategories();
  // 查询保险库是否已设置密码
  vaultApi.getStatus().then(res => {
    vaultIsEnabled.value = res.data.isEnabled;
    vaultIsSet.value = res.data.isSet;
  }).catch(() => {});
});
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <n-page-header
      title="分类管理"
      class="page-header"
    >
      <template #extra>
        <n-space align="center">
          <n-button v-if="trashMode" secondary @click="closeTrash">← 返回列表</n-button>
          <template v-else>
            <n-button
              v-if="!isMobileView && checkedRowKeys.length"
              type="error"
              tertiary
              :loading="batchDeleting"
              @click="askBatchDelete"
            >批量删除 ({{ checkedRowKeys.length }})</n-button>
            <n-button secondary @click="openTrash">🗑 回收站</n-button>
            <n-button type="primary" size="medium" @click="openCreate">
              <template #icon>＋</template>
              新建分类
            </n-button>
          </template>
        </n-space>
      </template>
    </n-page-header>

    <!-- ============ PC：n-data-table ============ -->
    <n-card v-if="!trashMode && !isMobileView" class="table-card" content-style="padding:0" :bordered="false">
      <n-data-table
        :columns="tableColumns"
        :data="dataStore.categories"
        :row-key="(row) => row.id"
        :checked-row-keys="checkedRowKeys"
        @update:checked-row-keys="(keys) => checkedRowKeys = keys"
        @update:page-size="onPageSizeChange"
        @update:page="onPageChange"
        :bordered="false"
        striped
        size="medium"
        :max-height="640"
        :pagination="pagination"
        :remote="false"
      >
        <template #empty>
          <n-empty description="还没有分类，点右上角「新建分类」创建一个～" />
        </template>
      </n-data-table>
    </n-card>

    <!-- ============ 移动端：n-list ============ -->
    <div v-else-if="!trashMode" class="mobile-list">
      <!-- 移动端批量操作栏 -->
      <div v-if="dataStore.categories.length" class="mob-batch-bar">
        <n-checkbox
          :checked="checkedRowKeys.length === dataStore.categories.length && dataStore.categories.length > 0"
          @update:checked="(val) => {
            checkedRowKeys = val ? dataStore.categories.map(c => c.id) : [];
          }"
        >全选</n-checkbox>
        <n-button
          v-if="checkedRowKeys.length"
          size="small"
          type="error"
          tertiary
          :loading="batchDeleting"
          @click="askBatchDelete"
        >删除选中 ({{ checkedRowKeys.length }})</n-button>
      </div>
      <template v-if="dataStore.categories.length">
        <n-card
          v-for="cat in dataStore.categories"
          :key="cat.id"
          hoverable
          class="mob-card"
        >
          <div class="mob-head">
            <span
              class="cat-emoji big"
              :style="{ '--bgc': resolveColor(cat.bg_color) }"
            >{{ cat.emoji }}</span>
            <div class="mob-titles">
              <div class="mob-name">{{ cat.name }}</div>
              <div class="mob-sub">{{ cat.subtitle || '—' }}</div>
            </div>
            <n-tag round type="info" size="small">
              {{ cat.links?.length || 0 }}
            </n-tag>
          </div>
          <div class="mob-meta">
            <span class="color-inline">
              <span class="dot" :style="{ background: resolveColor(cat.bg_color) }" />
              {{ displayHex(cat.bg_color) }}
            </span>
            <span class="mob-sort">排序 {{ cat.sort_order }}</span>
            <n-tag v-if="vaultIsEnabled && cat.is_locked" round size="small" type="warning">🔒</n-tag>
          </div>
          <div class="mob-ops">
            <n-checkbox
              :checked="checkedRowKeys.includes(cat.id)"
              @update:checked="(val) => {
                if (val) {
                  checkedRowKeys = [...checkedRowKeys, cat.id];
                } else {
                  checkedRowKeys = checkedRowKeys.filter(id => id !== cat.id);
                }
              }"
            />
            <n-button
              size="small"
              quaternary
              title="上移"
              @click="moveUp(cat)"
            >↑</n-button>
            <n-button
              size="small"
              quaternary
              title="下移"
              @click="moveDown(cat)"
            >↓</n-button>
            <n-button
              v-if="vaultIsEnabled"
              size="small"
              quaternary
              :type="cat.is_locked ? 'warning' : 'info'"
              @click="handleToggleLock(cat)"
            >{{ cat.is_locked ? '🔓' : '🔒' }}</n-button>
            <n-button size="small" type="primary" quaternary @click="openEdit(cat)">编辑</n-button>
            <n-button size="small" type="error" tertiary @click="askDelete(cat)">删除</n-button>
          </div>
        </n-card>
      </template>
      <n-empty v-else description="还没有分类～" />
    </div>

    <!-- ============ 回收站（子组件） ============ -->
    <CategoryTrashTable v-if="trashMode" @close="closeTrash" />

    <!-- ============ 新建/编辑 Modal ============ -->
    <n-modal
      v-model:show="modalShow"
      :mask-closable="true"
      preset="card"
      :title="modalMode === 'create' ? '新建分类' : '编辑分类'"
      class="cat-modal"
      style="width: clamp(320px, 92vw, 520px);"
      :segmented="{ content: true, action: true }"
      :bordered="false"
    >
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        size="medium"
        label-align="left"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="名称" path="name">
          <n-input
            v-model:value="form.name"
            placeholder="如：常用直达"
            clearable
          />
        </n-form-item>

        <n-form-item label="副标题（可选）">
          <n-input
            v-model:value="form.subtitle"
            placeholder="如：最常访问的几个"
            clearable
          />
        </n-form-item>

        <n-form-item label="Emoji">
          <div class="inline-field-row">
            <n-popover
              trigger="click"
              placement="bottom-start"
              :show-arrow="false"
              overlay-style="padding: 0"
            >
              <template #trigger>
                <n-button class="emoji-trigger">
                  <span class="cur-emoji">{{ form.emoji }}</span>
                  <span class="trig-text">点击选择 Emoji</span>
                </n-button>
              </template>
              <div class="emoji-popover">
                <div class="emoji-grid">
                  <button
                    v-for="e in EMOJI_LIST"
                    :key="e"
                    type="button"
                    class="emoji-cell"
                    :class="{ on: form.emoji === e }"
                    @click="form.emoji = e"
                  >{{ e }}</button>
                </div>
              </div>
            </n-popover>
            <n-button size="small" quaternary class="random-btn" @click="randomEmoji">🎲 随机</n-button>
          </div>
        </n-form-item>

        <n-form-item label="背景色">
          <div class="color-field">
            <div class="color-row">
              <button
                v-for="c in BG_COLORS"
                :key="c"
                type="button"
                class="color-dot"
                :class="{ on: form.bg_color === c }"
                :style="{ background: `var(--${c})` }"
                :title="c"
                @click="form.bg_color = c"
              />
            </div>
            <div class="hex-row">
              <span class="color-preview" :style="{ background: resolveColor(form.bg_color) }" />
              <n-input
                :value="displayHex(form.bg_color)"
                placeholder="或输入 HEX 值，如 #FF5500"
                size="small"
                class="hex-input"
                @update:value="form.bg_color = $event"
              />
              <n-button size="small" quaternary @click="randomBg">🎲 随机</n-button>
            </div>
          </div>
        </n-form-item>

        <n-form-item label="排序权重" path="sort_order">
          <n-input-number
            v-model:value="form.sort_order"
            :min="0"
            placeholder="留空自动排末尾"
            style="width: 100%"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="modal-footer">
          <n-button quaternary @click="modalShow = false">取消</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            @click="saveCategory"
            class="save-btn"
          >
            {{ submitting ? '保存中...' : '保存' }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
  white-space: nowrap;
}
:deep(.n-page-header__sub-title) {
  color: var(--admin-muted);
  font-size: 13px;
  white-space: nowrap;
}

/* 颜色点（inline 圆点 + 名） */
:deep(.color-inline) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-text-2);
}
:deep(.color-inline .dot) {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
}

/* ---------- 移动端卡片（其余样式由全局 styles/admin-common.css 提供） ---------- */
/* 分类卡片 meta 行保持右端对齐（与分类页原布局一致，共享表默认左对齐） */
.mob-meta {
  justify-content: space-between;
}

/* ---------- Modal 内 ---------- */
.cat-modal :deep(.n-card-header__main) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
}

.inline-field-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.random-btn {
  flex-shrink: 0;
}

/* Emoji 触发器按钮 */
.emoji-trigger {
  justify-content: flex-start !important;
  padding: 6px 12px !important;
  gap: 12px !important;
  height: auto !important;
  border-radius: 10px !important;
  flex: 1;
}
.cur-emoji {
  font-size: 20px;
  line-height: 1;
}
.trig-text {
  color: var(--admin-muted);
  font-size: 13px;
}

/* Emoji 面板（Popover 内） */
.emoji-popover {
  padding: 10px;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}
.emoji-cell {
  width: 100%;
  aspect-ratio: 1 / 1;
  border: 0;
  background: transparent;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all .15s;
  overflow: hidden;
}
.emoji-cell:hover { background: var(--admin-peach); transform: scale(1.1); }
.emoji-cell.on {
  background: var(--admin-accent);
  box-shadow: 0 0 0 2px rgba(63, 185, 143, .25);
}

/* 颜色点矩阵 */
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
  padding: 0;
  flex-shrink: 0;
}
.color-dot:hover { transform: scale(1.12); }
.color-dot.on {
  border-color: var(--admin-text);
  transform: scale(1.08);
}
/* HEX 输入区 */
.color-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-preview {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--admin-shadow);
}
.hex-input {
  flex: 1;
  max-width: 220px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.save-btn {
  background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-2)) !important;
  border: 0 !important;
  color: var(--admin-on-accent) !important;
}
</style>
