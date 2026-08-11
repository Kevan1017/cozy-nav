import { ref } from 'vue';

/**
 * 列表分页组合式函数
 * 分类管理 / 书签管理共用：统一分页状态与切换逻辑（页大小切换时页码重置为 1）
 * @param {Object} options - 配置项
 * @param {number} [options.pageSize=10] - 默认每页条数
 * @param {number[]} [options.pageSizes=[10,20,50,100]] - 可选每页条数
 * @returns 分页响应式对象与操作方法
 */
export function usePagination({ pageSize = 10, pageSizes = [10, 20, 50, 100] } = {}) {
  const pagination = ref({
    page: 1,
    pageSize,
    showSizePicker: true,
    pageSizes,
    itemCount: 0,
    prefix: (p) => `共 ${p.itemCount} 条 · 第 ${p.page} / ${p.pageCount} 页`,
  });

  /** 数据加载后同步总条数（供 watch 列表长度时调用） */
  function syncItemCount(len) {
    pagination.value.itemCount = len;
  }

  /** 切换每页条数：重置页码为 1 */
  function onPageSizeChange(size) {
    pagination.value.pageSize = size;
    pagination.value.page = 1;
  }

  /** 切换页码 */
  function onPageChange(page) {
    pagination.value.page = page;
  }

  return { pagination, syncItemCount, onPageSizeChange, onPageChange };
}
