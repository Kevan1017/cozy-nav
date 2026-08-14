<script setup>
/**
 * 批量添加书签弹窗
 * - 多行粘贴（支持纯 URL / 标题 URL / Markdown 链接 / 竖线分隔）
 * - 实时解析预览；重复 URL 由后端跳过并返回原因
 */
import { ref, computed, watch } from 'vue';
import { useMessage, NModal, NInput, NSelect, NButton, NSpace, NText, NTag, NAlert } from 'naive-ui';
import { linkApi } from '../../../api/link.js';
import { parseBulkInput } from '../../../composables/parseBulkInput.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  catOptions: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:show', 'success']);

const message = useMessage();

const inputText = ref('');
const categoryId = ref(null);
const submitting = ref(false);
const result = ref(null); // 提交后的结果 { created, skipped }

/** 分类下拉选项（过滤「全部分类」占位项） */
const selectOptions = computed(() => props.catOptions.filter(o => o.value !== 0));

/** 实时解析结果 */
const parsed = computed(() => parseBulkInput(inputText.value));

/** 无法识别的行数 */
const invalidCount = computed(() => {
  const lines = String(inputText.value || '').split('\n').filter(l => l.trim());
  return Math.max(0, lines.length - parsed.value.length);
});

// 打开时重置结果并默认选中第一个分类；关闭时清空输入
watch(
  () => props.show,
  (v) => {
    if (v) {
      result.value = null;
      if (!categoryId.value && selectOptions.value.length) {
        categoryId.value = selectOptions.value[0].value;
      }
    } else {
      inputText.value = '';
      categoryId.value = null;
    }
  }
);

/** 提交批量创建 */
async function handleSubmit() {
  if (!categoryId.value) { message.warning('请先选择目标分类'); return; }
  if (!parsed.value.length) { message.warning('未识别到有效书签，请检查输入格式'); return; }
  submitting.value = true;
  try {
    const res = await linkApi.batchCreate(categoryId.value, parsed.value);
    result.value = res.data; // { created, skipped }
    message.success(`已添加 ${res.data.created} 个书签`);
    emit('success');
  } catch (err) {
    message.error(err?.message || '批量添加失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="批量添加书签"
    style="width: min(600px, 92vw)"
    :mask-closable="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="batch-modal">
      <!-- 目标分类 -->
      <div class="field-label">目标分类</div>
      <n-select
        v-model:value="categoryId"
        :options="selectOptions"
        placeholder="选择书签要放入的分类"
        filterable
        size="large"
      />

      <!-- 文本输入 -->
      <div class="field-label">批量粘贴</div>
      <n-input
        v-model:value="inputText"
        type="textarea"
        :rows="8"
        placeholder="每行一个书签，支持格式示例：
https://github.com
GitHub https://github.com
[GitHub](https://github.com)
GitHub|https://github.com"
      />

      <!-- 解析预览 -->
      <div class="parse-hint">
        <n-text v-if="parsed.length" type="success">已识别 <b>{{ parsed.length }}</b> 条</n-text>
        <n-text v-if="invalidCount" type="warning"> · 未识别 {{ invalidCount }} 行</n-text>
        <n-text v-if="!parsed.length && !invalidCount" depth="3">输入后将自动识别书签</n-text>
      </div>

      <!-- 提交结果 -->
      <n-alert v-if="result" type="success" :show-icon="true" class="result-box">
        成功添加 {{ result.created }} 个
        <template v-if="result.skipped?.length">，跳过 {{ result.skipped.length }} 个（已存在或无效）</template>
        <ul v-if="result.skipped?.length" class="skip-list">
          <li v-for="s in result.skipped" :key="s.index">{{ s.index }}. {{ s.name }} — {{ s.reason }}</li>
        </ul>
      </n-alert>

      <!-- 按钮区 -->
      <n-space justify="end" class="modal-actions">
        <n-button @click="emit('update:show', false)">关闭</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          :disabled="!parsed.length"
          @click="handleSubmit"
        >批量添加 ({{ parsed.length }})</n-button>
      </n-space>
    </div>
  </n-modal>
</template>

<style scoped>
/* 字段标签（与批量移动弹窗风格一致） */
.field-label { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
/* 字段间距 */
.batch-modal .n-select { margin-bottom: 16px; }
.batch-modal .n-input { margin-bottom: 8px; }
/* 解析提示 */
.parse-hint { margin-bottom: 12px; font-size: 13px; }
/* 结果区 */
.result-box { margin-bottom: 12px; }
/* 跳过明细列表 */
.skip-list { margin: 8px 0 0; padding-left: 20px; max-height: 160px; overflow: auto; }
/* 按钮区 */
.modal-actions { margin-top: 4px; }
</style>
