import { ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

/**
 * 列表批量删除组合式函数
 * 分类管理 / 书签管理共用：勾选状态 + 批量删除确认弹窗 + 逐个删除
 * @param {Object} options - 配置项
 * @param {(id: number) => Promise} options.deleteItem - 单项删除接口调用（如 store.deleteLink）
 * @param {string} [options.emptyTip='请先勾选要删除的数据'] - 未勾选时提示
 * @param {string} [options.confirmTitle='确认批量删除'] - 确认弹窗标题
 * @param {(count: number) => string} options.confirmContent - 确认弹窗内容（count 为选中数量）
 * @param {(count: number) => string} options.successTip - 删除成功提示（count 为删除数量）
 * @returns 勾选状态与批量删除操作方法
 */
export function useBatchOps({
  deleteItem,
  emptyTip = '请先勾选要删除的数据',
  confirmTitle = '确认批量删除',
  confirmContent,
  successTip,
}) {
  const message = useMessage();
  const dialog = useDialog();
  const checkedRowKeys = ref([]);
  const batchDeleting = ref(false);

  function askBatchDelete() {
    if (!checkedRowKeys.value.length) {
      message.warning(emptyTip);
      return;
    }
    const count = checkedRowKeys.value.length;
    dialog.warning({
      title: confirmTitle,
      content: confirmContent(count),
      positiveText: '确定删除',
      negativeText: '取消',
      positiveButtonProps: { type: 'error' },
      onPositiveClick: async () => {
        batchDeleting.value = true;
        try {
          for (const id of checkedRowKeys.value) {
            await deleteItem(id);
          }
          message.success(successTip(count));
          checkedRowKeys.value = [];
        } catch { /* noop：axios 拦截器已提示 */ }
        finally { batchDeleting.value = false; }
      },
    });
  }

  return { checkedRowKeys, batchDeleting, askBatchDelete };
}
