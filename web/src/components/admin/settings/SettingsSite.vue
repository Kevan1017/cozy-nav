<script setup>
/**
 * 设置页 - 站点设置卡片（基本配置）
 * 注：前台显示（SettingsDisplay）已抽离为外观设置页的独立卡片「🧩 前台显示」
 */
import { ref, computed, watch, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  useMessage,
} from 'naive-ui';
import { usePrefsStore } from '../../../stores/prefs.js';
import { prefsApi } from '../../../api/prefs.js';
import CollapsibleCard from './CollapsibleCard.vue';

const prefsStore = usePrefsStore();
const message = useMessage();

/* ---------- 基本配置（标题/Logo/关键词/描述） ---------- */
const siteFormRef = ref(null);
const siteForm = ref({ site_title: '悦行', site_keywords: '', site_description: '' });
const siteSaving = ref(false);
const logoInput = ref(null);
/** 新选择的 Logo 图片（dataURL，未保存） */
const pendingLogoData = ref('');
/** 标记「移除 Logo」待保存 */
const pendingRemoveLogo = ref(false);

/** 是否有待保存的 Logo 变更（选新图或标记移除） */
const hasLogoPending = computed(() => !!pendingLogoData.value || pendingRemoveLogo.value);

/** Logo 预览图：新选图优先，其次已保存图，移除标记/无图为空（显示首字） */
const logoPreviewSrc = computed(() => {
  if (pendingLogoData.value) return pendingLogoData.value;
  if (pendingRemoveLogo.value) return '';
  return prefsStore.siteLogo || '';
});

/** 重置基本配置表单为当前已保存值 */
function resetSiteForm() {
  siteForm.value = {
    site_title: prefsStore.siteTitle || '悦行',
    site_keywords: prefsStore.siteKeywords || '',
    site_description: prefsStore.siteDescription || '',
  };
}

// 后台保存后（store 更新）同步表单显示
watch(
  () => [prefsStore.siteTitle, prefsStore.siteKeywords, prefsStore.siteDescription],
  () => resetSiteForm()
);

/** 选择 Logo 图片：校验格式/大小后仅本地暂存，点「保存基本配置」才上传生效 */
function onLogoFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    message.warning('仅支持 PNG / JPG / WebP 格式的图片');
    e.target.value = '';
    return;
  }
  if (file.size > 300 * 1024) {
    message.warning('图片大小需小于 300KB');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingLogoData.value = reader.result;
    pendingRemoveLogo.value = false;
    e.target.value = '';
  };
  reader.readAsDataURL(file);
}

/** 标记移除 Logo（待保存） */
function handleRemoveLogo() {
  pendingLogoData.value = '';
  pendingRemoveLogo.value = true;
}

/** 撤销未保存的 Logo 变更 */
function cancelLogoPending() {
  pendingLogoData.value = '';
  pendingRemoveLogo.value = false;
}

/** 保存基本配置：先处理 Logo（上传/移除），再保存文本字段 */
async function handleSaveSite() {
  siteSaving.value = true;
  try {
    const payload = {
      site_title: siteForm.value.site_title.trim() || '悦行',
      site_keywords: siteForm.value.site_keywords.trim(),
      site_description: siteForm.value.site_description.trim(),
    };
    // 有新选图片：先上传（写库 site_logo），再连同文本字段一起保存
    if (pendingLogoData.value) {
      const res = await prefsApi.uploadLogo(pendingLogoData.value);
      payload.site_logo = res.data.site_logo;
    } else if (pendingRemoveLogo.value) {
      await prefsApi.removeLogo();
      payload.site_logo = '';
    }
    await prefsStore.updateSiteBasic(payload);
    // 同步本地 Logo 状态（文本字段保存不包含 site_logo，需单独更新）
    if (payload.site_logo !== undefined) {
      await prefsStore.updateSiteLogo(payload.site_logo);
    }
    pendingLogoData.value = '';
    pendingRemoveLogo.value = false;
    message.success('基本配置已保存，前台已同步更新');
  } catch (err) {
    message.warning(err.message || '保存失败');
  } finally {
    siteSaving.value = false;
  }
}

// 初始化基本配置表单（避免每次输入都触发 API）
onMounted(() => {
  resetSiteForm();
});
</script>

<template>
  <!-- 站点设置卡片：基本配置 -->
  <collapsible-card title="🌐 站点设置">
    <n-form ref="siteFormRef" :model="siteForm" label-placement="left" label-width="90">
      <n-form-item label="网站标题" path="site_title">
        <n-input
          v-model:value="siteForm.site_title"
          placeholder="显示在浏览器标签页与顶栏"
          maxlength="50"
          show-count
          clearable
        />
      </n-form-item>
      <n-form-item label="站点 Logo">
        <div class="logo-row">
          <div class="logo-preview">
            <img v-if="logoPreviewSrc" :src="logoPreviewSrc" alt="站点 Logo">
            <span v-else class="logo-fallback">{{ (prefsStore.siteTitle || '悦').slice(0, 1) }}</span>
          </div>
          <input
            ref="logoInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            @change="onLogoFileChange"
          />
          <n-button size="small" @click="logoInput?.click()">
            {{ logoPreviewSrc ? '更换 Logo' : '上传 Logo' }}
          </n-button>
          <n-button v-if="logoPreviewSrc" size="small" quaternary type="error" @click="handleRemoveLogo">
            移除
          </n-button>
          <n-button v-if="hasLogoPending" size="small" quaternary @click="cancelLogoPending">
            撤销
          </n-button>
          <span class="hint">支持 PNG / JPG / WebP，小于 300KB。选图后点击「保存基本配置」生效。</span>
        </div>
      </n-form-item>
      <n-form-item label="站点关键词" path="site_keywords">
        <n-input
          v-model:value="siteForm.site_keywords"
          placeholder="多个关键词用英文逗号分隔，如：导航,书签,收藏夹"
          maxlength="200"
          clearable
        />
      </n-form-item>
      <n-form-item label="站点描述" path="site_description">
        <n-input
          v-model:value="siteForm.site_description"
          type="textarea"
          :rows="2"
          placeholder="一句话介绍你的站点，将写入 HTML 头部 meta 标签"
          maxlength="300"
          clearable
        />
      </n-form-item>
      <n-button type="primary" :loading="siteSaving" @click="handleSaveSite">
        保存基本配置
      </n-button>
    </n-form>
    <p class="hint" style="margin-top: 12px;">
      网站标题、Logo 会同步显示在前台；关键词与描述写入 HTML 头部 meta 标签。页脚版权年份自动跟随当前年份，版权链接文本固定使用网站标题并支持跳转首页。
    </p>
  </collapsible-card>
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

/* 站点 Logo 上传行 */
.logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.logo-preview {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-2));
  color: var(--admin-on-accent);
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, .25);
}
.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.logo-fallback {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 20px;
  font-weight: 600;
}
</style>
