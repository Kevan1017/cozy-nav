import { ref, computed } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { useDataStore } from '../stores/data.js';

/**
 * 回收站组合式函数（书签管理 / 分类管理共用）
 * 封装回收站分页加载 + 恢复 / 彻底删除 / 批量操作（服务端分页，避免大体积数据全量加载）
 * @param {Object} options - 配置项
 * @param {Object} options.api - 回收站接口 { getTrash(page, size), restore(id), purge(id) }
 * @param {string} [options.itemName='数据'] - 数据项名称（用于提示文案，如 书签/分类）
 * @param {string} [options.emptyRestoreTip] - 未勾选恢复时的提示（默认用 itemName 拼接）
 * @param {string} [options.purgeExtraContent=''] - 彻底删除文案补充（如分类需说明"及其下所有书签"）
 * @returns 回收站响应式状态与操作方法
 */
export function useTrashTable({
  api,
  itemName = '数据',
  emptyRestoreTip,
  purgeExtraContent = '',
}) {
  const dataStore = useDataStore();
  const message = useMessage();
  const dialog = useDialog();

  const trashList = ref([]);
  const loadingTrash = ref(false);
  const checkedTrashKeys = ref([]);
  const trashBusy = ref(false);
  const trashPage = ref(1);
  const trashPageSize = ref(20);
  const trashTotal = ref(0);

  /** 回收站分页配置（Naive 表格分页） */
  const trashPagination = computed(() => ({
    page: trashPage.value,
    pageSize: trashPageSize.value,
    itemCount: trashTotal.value,
    showSizePicker: true,
    pageSizes: [10, 20, 50, 100],
    prefix: (p) => `共 ${p.itemCount} 条 · 第 ${p.page} / ${p.pageCount} 页`,
  }));

  /** 回收站总页数（移动端简易分页用） */
  const trashPageCount = computed(() => Math.max(1, Math.ceil(trashTotal.value / trashPageSize.value)));

  /** 格式化删除时间（ISO → 本地字符串） */
  function formatTime(str) {
    if (!str) return '—';
    try {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) return str;
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch {
      return str;
    }
  }

  /** 加载回收站数据（分页） */
  async function loadTrash() {
    loadingTrash.value = true;
    try {
      const res = await api.getTrash(trashPage.value, trashPageSize.value);
      const data = res.data || {};
      trashList.value = data.list || [];
      trashTotal.value = data.total ?? 0;
    } catch (e) {
      message.warning(e?.message || '加载回收站失败');
    } finally {
      loadingTrash.value = false;
    }
  }

  /** 切换回收站页码 */
  function onTrashPageChange(page) {
    trashPage.value = page;
    loadTrash();
  }

  /** 切换回收站每页条数：重置到第 1 页并重载 */
  function onTrashPageSizeChange(size) {
    trashPageSize.value = size;
    trashPage.value = 1;
    loadTrash();
  }

  /**
   * 从本地回收站列表移除指定 id（避免每次操作后整表重载）
   * 若当前页被删空且还有上一页，回退一页重载
   */
  function removeLocalTrash(ids) {
    const idSet = new Set(ids);
    trashList.value = trashList.value.filter(item => !idSet.has(item.id));
    trashTotal.value = Math.max(0, trashTotal.value - idSet.size);
    if (!trashList.value.length && trashPage.value > 1) {
      trashPage.value--;
      loadTrash();
    }
  }

  /** 批量恢复选中数据 */
  async function restoreSelected() {
    if (!checkedTrashKeys.value.length) {
      message.warning(emptyRestoreTip || `请先勾选要恢复的${itemName}`);
      return;
    }
    trashBusy.value = true;
    let ok = 0;
    const okIds = [];
    try {
      for (const id of [...checkedTrashKeys.value]) {
        try {
          await api.restore(id);
          ok++;
          okIds.push(id);
        } catch { /* 单个失败跳过 */ }
      }
      message.success(`已恢复 ${ok} 个${itemName}`);
      checkedTrashKeys.value = [];
      removeLocalTrash(okIds);
      await dataStore.fetchCategories();
    } finally {
      trashBusy.value = false;
    }
  }

  /** 批量彻底删除选中数据（确认弹窗） */
  function askPurgeSelected() {
    if (!checkedTrashKeys.value.length) {
      message.warning(`请先勾选要彻底删除的${itemName}`);
      return;
    }
    const n = checkedTrashKeys.value.length;
    dialog.warning({
      title: '批量彻底删除',
      content: `将彻底删除选中的 ${n} 个${itemName}${purgeExtraContent}，此操作不可恢复。`,
      positiveText: '彻底删除',
      negativeText: '取消',
      positiveButtonProps: { type: 'error' },
      onPositiveClick: async () => {
        trashBusy.value = true;
        let ok = 0;
        const okIds = [];
        try {
          for (const id of [...checkedTrashKeys.value]) {
            try {
              await api.purge(id);
              ok++;
              okIds.push(id);
            } catch { /* 单个失败跳过 */ }
          }
          message.success(`已彻底删除 ${ok} 个${itemName}`);
          checkedTrashKeys.value = [];
          removeLocalTrash(okIds);
          await dataStore.fetchCategories();
        } finally {
          trashBusy.value = false;
        }
      },
    });
  }

  return {
    trashList,
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
  };
}
