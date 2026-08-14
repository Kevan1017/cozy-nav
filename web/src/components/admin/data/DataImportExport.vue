<script setup>
/**
 * 数据管理页 - 导出 / 导入卡片（由原设置页 SettingsDataManage.vue 迁出，逻辑不变）
 * - 导出数据（JSON / 浏览器书签 HTML）
 * - 导入数据（JSON / 浏览器书签，skip/overwrite 策略，≤2MB）
 */
import { ref } from 'vue';
import {
  NCard,
  NButton,
  NModal,
  NTabs,
  NTabPane,
  NRadioGroup,
  NRadio,
  NUpload,
  NSpace,
  NDropdown,
  NAlert,
  NTag,
  useMessage,
} from 'naive-ui';
import { exportJSON, exportBookmarks, importJSON, importBookmarks } from '../../../api/importExport.js';
import { useDataStore } from '../../../stores/data.js';
import { MAX_IMPORT_SIZE, validateImportFile } from '../../../composables/importFileValidation.js';

const message = useMessage();
const dataStore = useDataStore();

/* ---------- 导出功能 ---------- */
const exporting = ref(false);

async function handleExportJSON() {
  exporting.value = true;
  try {
    await exportJSON();
    message.success('导出成功');
  } catch (err) {
    message.error(err.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

async function handleExportBookmarks() {
  exporting.value = true;
  try {
    await exportBookmarks();
    message.success('导出成功');
  } catch (err) {
    message.error(err.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

/* ---------- 导入功能 ---------- */
const showImportModal = ref(false);
const importTab = ref('json');
const importStrategy = ref('skip');
const importFile = ref(null);
const importFileName = ref('');
const importing = ref(false);
const importResult = ref(null); // 导入结果统计 { categoriesCreated, categoriesReused, linksCreated, linksUpdated, linksSkipped, skippedDetails }

const strategyOptions = [
  { label: '跳过重复', value: 'skip' },
  { label: '覆盖现有', value: 'overwrite' },
];

function handleImportSelect({ file }) {
  // Naive UI 的 file 是 UploadFileInfo，原生 File 在 file.file 中
  const raw = file.file || null;
  // 选择文件时即校验大小，避免传到后端才被 413 拦截
  const err = validateImportFile(raw);
  if (err) {
    message.error(err);
    importFile.value = null;
    importFileName.value = '';
    return;
  }
  importFile.value = raw;
  importFileName.value = file.name || '';
}

/** NUpload max-size 超限文件触发的错误回调 */
function handleUploadError({ file }) {
  if (file.status === 'error') {
    message.error('文件大小不能超过 2MB');
  }
}

async function handleImport() {
  if (!importFile.value) {
    message.warning('请先选择文件');
    return;
  }

  importing.value = true;
  try {
    const content = await importFile.value.text();

    let res;
    if (importTab.value === 'json') {
      res = await importJSON(JSON.parse(content), importStrategy.value);
    } else {
      res = await importBookmarks(content, importStrategy.value);
    }

    // 刷新分类数据，让分类管理/书签管理页立即显示导入的新数据
    await dataStore.fetchCategories();

    // 保存统计并展示导入结果报告
    importResult.value = res.data;
    message.success('导入完成');
    importFile.value = null;
    importFileName.value = '';
  } catch (err) {
    message.error(err.message || '导入失败');
  } finally {
    importing.value = false;
  }
}

/** 关闭弹窗并清空导入状态（含上一次的结果报告） */
function closeImportModal() {
  showImportModal.value = false;
  importResult.value = null;
  importFile.value = null;
  importFileName.value = '';
}
</script>

<template>
  <n-card class="setting-card" title="📦 导出 / 导入" hoverable>
    <p class="hint" style="margin-bottom: 16px;">
      导出/导入分类和书签数据，支持 JSON 和浏览器书签格式。
    </p>

    <div class="action-group">
      <div class="action-section">
        <n-space wrap>
          <n-dropdown
            :options="[
              { label: '📄 JSON 格式（备份/迁移）', key: 'json' },
              { label: '🔖 浏览器书签 HTML', key: 'bookmarks' },
            ]"
            @select="(key) => {
              if (key === 'json') handleExportJSON();
              else handleExportBookmarks();
            }"
          >
            <n-button type="primary" :loading="exporting">⬆️导出数据</n-button>
          </n-dropdown>
          <n-button @click="showImportModal = true"> ⬇️导入数据</n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <!-- 导入弹窗 -->
  <n-modal
    v-model:show="showImportModal"
    title="导入数据"
    preset="card"
    :style="{ maxWidth: '480px' }"
    mask-closable
    @update:show="(v) => { if (!v) closeImportModal(); }"
  >
    <div class="import-content">
      <n-tabs v-model:value="importTab" type="line">
        <n-tab-pane name="json" tab="📄 JSON 格式">
          <p class="hint" style="margin-bottom: 12px;">
            导入 JSON 格式的数据文件（从本系统导出的 .json 文件，或符合下方格式的自定义文件）
          </p>
          <div class="format-tip">
            <div class="format-tip-title">JSON 格式要求</div>
            <ul>
              <li>顶层为对象，必须包含 <code>categories</code> 数组（非空）</li>
              <li>每个分类必须有 <code>name</code>，其余字段（emoji、subtitle 等）可省略</li>
              <li>每条链接必须有 <code>name</code> 和 <code>url</code>，其余字段导入时自动补全</li>
            </ul>
            <pre>{
  "categories": [
    {
      "name": "工具",
      "links": [
        { "name": "GitHub", "url": "https://github.com/" }
      ]
    }
  ]
}</pre>
          </div>
        </n-tab-pane>
        <n-tab-pane name="bookmarks" tab="🔖 浏览器书签">
          <p class="hint" style="margin-bottom: 12px;">
            导入浏览器导出的书签 HTML 文件（Chrome/Firefox/Edge）
          </p>
        </n-tab-pane>
      </n-tabs>

      <!-- 导入结果报告 -->
      <n-alert v-if="importResult" type="success" :show-icon="true" class="import-result">
        <div class="result-title">导入完成</div>
        <div class="result-stats">
          <n-tag size="small" type="info" :bordered="false">分类 · 新建 {{ importResult.categoriesCreated }} · 复用 {{ importResult.categoriesReused }}</n-tag>
          <n-tag size="small" type="success" :bordered="false">链接 · 新增 {{ importResult.linksCreated }} · 更新 {{ importResult.linksUpdated }}</n-tag>
          <n-tag v-if="importResult.linksSkipped" size="small" type="warning" :bordered="false">跳过 {{ importResult.linksSkipped }}</n-tag>
        </div>
        <ul v-if="importResult.skippedDetails?.length" class="skip-list">
          <li v-for="(s, i) in importResult.skippedDetails" :key="i">{{ s.name || s.url }} — {{ s.reason }}</li>
          <li v-if="importResult.linksSkipped > importResult.skippedDetails.length">… 其余 {{ importResult.linksSkipped - importResult.skippedDetails.length }} 条已省略</li>
        </ul>
      </n-alert>

      <template v-if="!importResult">
        <div class="import-section">
          <div class="section-label">导入策略</div>
          <n-radio-group v-model:value="importStrategy">
            <n-radio
              v-for="opt in strategyOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </n-radio>
          </n-radio-group>
        </div>

        <div class="import-section">
          <div class="section-label">选择文件</div>
          <n-upload
            :accept="importTab === 'json' ? '.json' : '.html,.htm'"
            :max="1"
            :max-size="MAX_IMPORT_SIZE"
            @change="handleImportSelect"
            @error="handleUploadError"
          >
            <n-button>📁 选择文件</n-button>
          </n-upload>
          <p v-if="importFileName" class="file-hint">
            已选择：{{ importFileName }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="closeImportModal">{{ importResult ? '完成' : '取消' }}</n-button>
        <n-button
          v-if="!importResult"
          type="primary"
          :loading="importing"
          @click="handleImport"
        >
          确认导入
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

/* 数据管理 */
.action-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.action-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text-2);
}

/* 导入弹窗 */
.import-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}
.import-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.import-section :deep(.n-radio) {
  margin-right: 20px;
}
.file-hint {
  font-size: 12px;
  color: var(--admin-accent);
  margin-top: 8px;
}
:deep(.n-tab-pane) {
  padding: 12px 0;
}

/* JSON 格式说明 */
.format-tip {
  border: 1px solid var(--admin-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: color-mix(in oklab, var(--admin-card) 55%, transparent);
  font-size: 12px;
  color: var(--admin-muted);
  line-height: 1.8;
}
.format-tip-title {
  font-weight: 600;
  color: var(--admin-text-2);
  margin-bottom: 4px;
}
.format-tip ul {
  margin: 0;
  padding-left: 18px;
}
.format-tip code {
  background: var(--admin-card);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: Consolas, Monaco, monospace;
  color: var(--admin-accent);
}
.format-tip pre {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--admin-card);
  overflow-x: auto;
  font-size: 11px;
  font-family: Consolas, Monaco, monospace;
  color: var(--admin-text-2);
  white-space: pre;
}

/* 导入结果报告 */
.import-result {
  margin-bottom: 4px;
}
.result-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.result-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.skip-list {
  margin: 8px 0 0;
  padding-left: 20px;
  max-height: 140px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.8;
  color: var(--admin-muted);
}
.skip-list li:first-child {
  margin-top: 4px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .action-group {
    gap: 12px;
  }
  :deep(.n-space) {
    flex-wrap: wrap;
  }
}
</style>
