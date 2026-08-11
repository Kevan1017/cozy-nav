<script setup>
/**
 * 书签管理 - 回收站（从 LinkManage.vue 拆出）
 * - 分页加载回收站书签（服务端分页，避免大体积数据全量加载）
 * - 恢复 / 彻底删除 / 批量操作（分页与批量逻辑复用 useTrashTable）
 * - 所属分类已删除时，可一键先恢复分类
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
import { renderAvatar } from '../../../composables/useRenderCell.js';
import { linkApi } from '../../../api/link.js';
import { categoryApi } from '../../../api/category.js';
import FaviconAvatar from '../../ui/FaviconAvatar.vue';

const emit = defineEmits(['close']);

const dataStore = useDataStore();
const { isMobileView } = useResponsive();
const dialog = useDialog();
const message = useMessage();

/* ---------- 回收站（分页/恢复/批量操作 复用组合式函数） ---------- */
const {
  trashList: trashLinks,
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
} = useTrashTable({ api: linkApi, itemName: '书签' });

/** 恢复单个书签 */
async function restoreOne(link) {
  try {
    await linkApi.restore(link.id);
    message.success(`已恢复「${link.name}」`);
    checkedTrashKeys.value = checkedTrashKeys.value.filter(id => id !== link.id);
    removeLocalTrash([link.id]);
    await dataStore.fetchCategories();
  } catch (e) {
    message.error(e?.message || '恢复失败');
  }
}

/** 书签所属分类已删除时，一键先恢复该分类（分类名可能为 null，用占位提示） */
async function restoreCategoryForLink(link) {
  try {
    await categoryApi.restore(link.category_id);
    message.success(`已恢复分类「${link.category_name || '该分类'}」，可继续恢复书签`);
    // 本地将同分类书签的"分类已删除"标记清除，无需整表重载
    trashLinks.value = trashLinks.value.map(l =>
      l.category_id === link.category_id ? { ...l, category_deleted: null } : l
    );
    await dataStore.fetchCategories();
  } catch (e) {
    message.error(e?.message || '恢复分类失败');
  }
}

/** 彻底删除单个书签（确认弹窗） */
function askPurge(link) {
  dialog.warning({
    title: '彻底删除',
    content: `将彻底删除「${link.name}」，此操作不可恢复。`,
    positiveText: '彻底删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await linkApi.purge(link.id);
        message.success('已彻底删除');
        removeLocalTrash([link.id]);
      } catch (e) {
        message.error(e?.message || '删除失败');
      }
    },
  });
}

/* ---------- 回收站表格列（PC 端） ---------- */
const trashColumns = computed(() => {
  const cols = [
    { type: 'selection', width: 28 },
    { title: 'ID', key: 'id', width: 48, align: 'center', ellipsis: { tooltip: true } },
    {
      title: '名称', key: 'name', width: 240, ellipsis: { tooltip: true },
      render: (row) => renderAvatar(row),
    },
    {
      title: '分类', key: 'categoryName', width: 130,
      render: (row) => h(NTag, {
        size: 'small', round: true,
        type: row.category_deleted ? 'error' : 'info',
        bordered: false,
      }, () => h('span', {
        style: 'display: inline-block; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;',
      }, row.category_deleted ? `${row.category_name || '分类'}（已删除）` : (row.category_name || '分类已删除'))),
    },
    {
      title: '备注', key: 'note', width: 160, ellipsis: { tooltip: true },
      render: (row) => h('span', {
        style: row.note
          ? 'color: var(--admin-text); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          : 'color: var(--admin-muted); font-size: 13px;',
      }, row.note || '—'),
    },
    {
      title: '删除时间', key: 'deleted_at', width: 150, align: 'center',
      render: (row) => h('span', { style: 'color: var(--admin-muted); font-size: 13px' }, formatTime(row.deleted_at)),
    },
    {
      title: '操作', key: 'ops', width: 210, align: 'left',
      render: (row) => h(NSpace, { size: 6, align: 'center' }, () => {
        const btns = [];
        // 所属分类已被删除时，须先恢复分类才能恢复书签
        if (row.category_deleted) {
          btns.push(h(NButton, {
            size: 'small', type: 'warning', quaternary: true,
            onClick: () => restoreCategoryForLink(row),
          }, () => '恢复分类'));
        }
        btns.push(h(NButton, {
          size: 'small', type: 'primary', quaternary: true,
          onClick: () => restoreOne(row),
        }, () => '恢复'));
        btns.push(h(NButton, {
          size: 'small', type: 'error', tertiary: true,
          onClick: () => askPurge(row),
        }, () => '彻底删除'));
        return btns;
      }),
    },
  ];
  return cols;
});

onMounted(loadTrash);
</script>

<template>
  <!-- PC 回收站表格 -->
  <n-card v-if="!isMobileView" class="table-card" content-style="padding:0" :bordered="false">
    <n-data-table
      :columns="trashColumns"
      :data="trashLinks"
      :row-key="(r) => r.id"
      :checked-row-keys="checkedTrashKeys"
      :scroll-x="966"
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
        <n-empty description="回收站是空的，删除的书签会出现在这里" />
      </template>
    </n-data-table>
    <div v-if="trashLinks.length" class="trash-batch-bar">
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
    <div v-if="trashLinks.length" class="mob-batch-bar">
      <n-checkbox
        :checked="checkedTrashKeys.length === trashLinks.length && trashLinks.length > 0"
        @update:checked="(val) => {
          checkedTrashKeys = val ? trashLinks.map(l => l.id) : [];
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
    <template v-if="trashLinks.length">
      <n-card
        v-for="link in trashLinks"
        :key="link.id"
        class="mob-card"
        hoverable
      >
        <div class="mob-head">
          <FaviconAvatar
            :favicon-path="link.favicon_path || ''"
            :avatar-text="link.avatar_text || ''"
            :avatar-color="link.avatar_color || ''"
          />
          <div class="mob-titles">
            <div class="mob-name">{{ link.name }}</div>
            <div class="mob-domain">
              <n-tag
                v-if="link.category_deleted"
                size="tiny"
                round
                type="error"
                :bordered="false"
                style="margin-right: 4px;"
              >已删除</n-tag>
              {{ link.category_name || '分类已删除' }}
            </div>
          </div>
        </div>
        <div class="mob-meta">
          <span class="mob-sort">删除于 {{ formatTime(link.deleted_at) }}</span>
        </div>
        <div v-if="link.note" class="mob-note">{{ link.note }}</div>
        <div class="mob-ops">
          <n-checkbox
            :checked="checkedTrashKeys.includes(link.id)"
            @update:checked="(val) => {
              if (val) {
                checkedTrashKeys = [...checkedTrashKeys, link.id];
              } else {
                checkedTrashKeys = checkedTrashKeys.filter(id => id !== link.id);
              }
            }"
          />
          <n-button
            v-if="link.category_deleted"
            size="small"
            type="warning"
            quaternary
            @click="restoreCategoryForLink(link)"
          >恢复分类</n-button>
          <n-button size="small" type="primary" quaternary @click="restoreOne(link)">恢复</n-button>
          <n-button size="small" type="error" tertiary @click="askPurge(link)">彻底删除</n-button>
        </div>
      </n-card>
    </template>
    <n-empty v-else description="回收站是空的，删除的书签会出现在这里" />
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

<!-- 样式全部由全局 styles/admin-common.css 提供（table-card / trash-batch-bar / mobile-list / mob-*） -->
