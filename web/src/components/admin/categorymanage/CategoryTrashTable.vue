<script setup>
/**
 * 分类管理 - 回收站（从 CategoryManage.vue 拆出）
 * - 分页加载回收站分类（服务端分页，避免大体积数据全量加载）
 * - 恢复 / 彻底删除 / 批量操作（分页与批量逻辑复用 useTrashTable）
 * - PC：表格；移动端：卡片列表
 */
import { computed, h, onMounted } from 'vue';
import {
  NCard,
  NDataTable,
  NButton,
  NCheckbox,
  NEmpty,
  NTag,
  NSpace,
  useMessage,
  useDialog,
} from 'naive-ui';
import { useDataStore } from '../../../stores/data.js';
import { useResponsive } from '../../../composables/useResponsive.js';
import { useTrashTable } from '../../../composables/useTrashTable.js';
import { renderEmoji } from '../../../composables/useRenderCell.js';
import { resolveColor } from '../../../composables/useColor.js';
import { categoryApi } from '../../../api/category.js';

const emit = defineEmits(['close']);

const dataStore = useDataStore();
const { isMobileView } = useResponsive();
const dialog = useDialog();
const message = useMessage();

/* ---------- 回收站（分页/恢复/批量操作 复用组合式函数） ---------- */
const {
  trashList: trashCategories,
  loadingTrash,
  checkedTrashKeys,
  trashBusy,
  trashPage,
  trashPageSize,
  trashTotal,
  trashPagination,
  trashPageCount,
  formatTime,
  loadTrash,
  onTrashPageChange,
  onTrashPageSizeChange,
  removeLocalTrash,
  restoreSelected,
  askPurgeSelected,
} = useTrashTable({
  api: categoryApi,
  itemName: '分类',
  purgeExtraContent: '及其下所有书签',
});

/** 恢复单个分类（其下书签仍在书签回收站，可前往书签管理单独恢复） */
async function restoreOne(cat) {
  try {
    await categoryApi.restore(cat.id);
    message.success(`已恢复分类「${cat.name}」`);
    checkedTrashKeys.value = checkedTrashKeys.value.filter(id => id !== cat.id);
    removeLocalTrash([cat.id]);
    await dataStore.fetchCategories();
  } catch (e) {
    message.error(e?.message || '恢复失败');
  }
}

/** 彻底删除单个分类（确认弹窗） */
function askPurge(cat) {
  dialog.warning({
    title: '彻底删除',
    content: `将彻底删除分类「${cat.name}」及其下所有书签（含 ${cat.trash_link_count || 0} 个回收站书签），此操作不可恢复。`,
    positiveText: '彻底删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await categoryApi.purge(cat.id);
        message.success('已彻底删除');
        removeLocalTrash([cat.id]);
        await dataStore.fetchCategories();
      } catch (e) {
        message.error(e?.message || '删除失败');
      }
    },
  });
}

/* ---------- 回收站表格列（PC 端） ---------- */
const trashColumns = computed(() => {
  return [
    { type: 'selection', width: 28 },
    { title: 'ID', key: 'id', width: 48, align: 'center', ellipsis: { tooltip: true } },
    {
      title: '名称', key: 'name', width: 200, ellipsis: { tooltip: true },
      render: (row) => h('strong', { style: 'color: var(--admin-text); font-weight:600' }, row.name),
    },
    {
      title: 'Emoji', key: 'emoji', width: 72, align: 'center',
      render: (row) => renderEmoji(row),
    },
    {
      title: '回收站书签', key: 'trash_link_count', width: 110, align: 'center',
      render: (row) => h(NTag, { round: true, type: 'info', size: 'small' },
        () => row.trash_link_count ?? 0
      ),
    },
    {
      title: '删除时间', key: 'deleted_at', width: 150, align: 'center',
      render: (row) => h('span', { style: 'color: var(--admin-muted); font-size: 13px' }, formatTime(row.deleted_at)),
    },
    {
      title: '操作', key: 'ops', width: 160, align: 'left',
      render: (row) => h(NSpace, { size: 6, align: 'center' }, () => [
        h(NButton, {
          size: 'small', type: 'primary', quaternary: true,
          onClick: () => restoreOne(row),
        }, () => '恢复'),
        h(NButton, {
          size: 'small', type: 'error', tertiary: true,
          onClick: () => askPurge(row),
        }, () => '彻底删除'),
      ]),
    },
  ];
});

onMounted(loadTrash);
</script>

<template>
  <!-- PC 回收站表格 -->
  <n-card v-if="!isMobileView" class="table-card" content-style="padding:0" :bordered="false">
    <n-data-table
      :columns="trashColumns"
      :data="trashCategories"
      :row-key="(r) => r.id"
      :checked-row-keys="checkedTrashKeys"
      :scroll-x="820"
      :loading="loadingTrash"
      :remote="true"
      :pagination="trashPagination"
      @update:checked-row-keys="(keys) => checkedTrashKeys = keys"
      @update:page="onTrashPageChange"
      @update:page-size="onTrashPageSizeChange"
      :bordered="false"
      striped
      :max-height="640"
    >
      <template #empty>
        <n-empty description="回收站是空的，删除的分类会出现在这里" />
      </template>
    </n-data-table>
    <div v-if="trashCategories.length" class="trash-batch-bar">
      <n-button
        size="small"
        type="primary"
        secondary
        :loading="trashBusy"
        :disabled="!checkedTrashKeys.length"
        @click="restoreSelected"
      >恢复选中 ({{ checkedTrashKeys.length }})</n-button>
      <n-button
        size="small"
        type="error"
        tertiary
        :loading="trashBusy"
        :disabled="!checkedTrashKeys.length"
        @click="askPurgeSelected"
      >彻底删除选中 ({{ checkedTrashKeys.length }})</n-button>
    </div>
  </n-card>

  <!-- 移动端回收站卡片 -->
  <div v-else class="mobile-list">
    <div v-if="trashCategories.length" class="mob-batch-bar">
      <n-checkbox
        :checked="checkedTrashKeys.length === trashCategories.length && trashCategories.length > 0"
        @update:checked="(val) => {
          checkedTrashKeys = val ? trashCategories.map(c => c.id) : [];
        }"
      >全选</n-checkbox>
      <n-button
        v-if="checkedTrashKeys.length"
        size="small"
        type="primary"
        secondary
        :loading="trashBusy"
        @click="restoreSelected"
      >恢复 ({{ checkedTrashKeys.length }})</n-button>
      <n-button
        v-if="checkedTrashKeys.length"
        size="small"
        type="error"
        tertiary
        :loading="trashBusy"
        @click="askPurgeSelected"
      >彻底删除 ({{ checkedTrashKeys.length }})</n-button>
    </div>
    <template v-if="trashCategories.length">
      <n-card
        v-for="cat in trashCategories"
        :key="cat.id"
        class="mob-card"
        hoverable
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
            {{ cat.trash_link_count || 0 }}
          </n-tag>
        </div>
        <div class="mob-meta">
          <span class="mob-sort">删除于 {{ formatTime(cat.deleted_at) }}</span>
        </div>
        <div class="mob-ops">
          <n-checkbox
            :checked="checkedTrashKeys.includes(cat.id)"
            @update:checked="(val) => {
              if (val) {
                checkedTrashKeys = [...checkedTrashKeys, cat.id];
              } else {
                checkedTrashKeys = checkedTrashKeys.filter(id => id !== cat.id);
              }
            }"
          />
          <n-button size="small" type="primary" quaternary @click="restoreOne(cat)">恢复</n-button>
          <n-button size="small" type="error" tertiary @click="askPurge(cat)">彻底删除</n-button>
        </div>
      </n-card>
    </template>
    <n-empty v-else description="回收站是空的，删除的分类会出现在这里" />
    <!-- 移动端回收站分页 -->
    <div v-if="trashTotal > trashPageSize" class="trash-page-bar">
      <n-button
        size="small"
        quaternary
        :disabled="trashPage <= 1"
        @click="onTrashPageChange(trashPage - 1)"
      >←</n-button>
      <span class="trash-page-info">第 {{ trashPage }} / {{ trashPageCount }} 页 · 共 {{ trashTotal }} 条</span>
      <n-button
        size="small"
        quaternary
        :disabled="trashPage >= trashPageCount"
        @click="onTrashPageChange(trashPage + 1)"
      >→</n-button>
    </div>
  </div>
</template>

<style scoped>
/* 分类卡移动端 meta 右对齐（覆盖 admin-common.css 的默认左对齐，与分类主列表保持一致） */
.mob-meta {
  justify-content: space-between;
}
</style>
