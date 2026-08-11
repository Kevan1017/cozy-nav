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
  useMessage,
} from 'naive-ui';
import { exportJSON, exportBookmarks, importJSON, importBookmarks } from '../../../api/importExport.js';
import { useDataStore } from '../../../stores/data.js';

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

const strategyOptions = [
  { label: '跳过重复', value: 'skip' },
  { label: '覆盖现有', value: 'overwrite' },
];

function handleImportSelect({ file }) {
  // Naive UI 的 file 是 UploadFileInfo，原生 File 在 file.file 中
  importFile.value = file.file || null;
  importFileName.value = file.name || '';
}

async function handleImport() {
  if (!importFile.value) {
    message.warning('请先选择文件');
    return;
  }

  importing.value = true;
  try {
    const content = await importFile.value.text();

    if (importTab.value === 'json') {
      const data = JSON.parse(content);
      await importJSON(data, importStrategy.value);
    } else {
      await importBookmarks(content, importStrategy.value);
    }

    // 刷新分类数据，让分类管理/书签管理页立即显示导入的新数据
    await dataStore.fetchCategories();

    message.success('导入成功');
    showImportModal.value = false;
    importFile.value = null;
  } catch (err) {
    message.error(err.message || '导入失败');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <n-card class="setting-card" title="📦 导出 / 导入" hoverable>
    <p class="hint" style="margin-bottom: 16px;">
      导出/导入分类和书签数据，支持 JSON 和浏览器书签格式。
    </p>

    <div class="action-group">
      <div class="action-section">
        <div class="section-label">导出数据</div>
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
  >
    <div class="import-content">
      <n-tabs v-model:value="importTab" type="line">
        <n-tab-pane name="json" tab="📄 JSON 格式">
          <p class="hint" style="margin-bottom: 12px;">
            导入 JSON 格式的数据文件（从本系统导出的 .json 文件）
          </p>
        </n-tab-pane>
        <n-tab-pane name="bookmarks" tab="🔖 浏览器书签">
          <p class="hint" style="margin-bottom: 12px;">
            导入浏览器导出的书签 HTML 文件（Chrome/Firefox/Edge）
          </p>
        </n-tab-pane>
      </n-tabs>

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
          @change="handleImportSelect"
        >
          <n-button>📁 选择文件</n-button>
        </n-upload>
        <p v-if="importFileName" class="file-hint">
          已选择：{{ importFileName }}
        </p>
      </div>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showImportModal = false">取消</n-button>
        <n-button
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
