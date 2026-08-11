<script setup>
/**
 * 设置页 - 站点设置卡片（合并 SettingsBasic + SettingsFrontDisplay）
 * 单卡片内分段切换两个子项：
 * - 基本配置（网站标题 / Logo / 关键词 / 描述）
 * - 前台显示（字体切换 / 节日彩蛋 / 倒计时 / 闲置标记 / 标语）
 */
import { ref, computed, watch, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSwitch,
  NDivider,
  NSpace,
  NTabs,
  NTabPane,
  NRadioGroup,
  NRadio,
  useMessage,
} from 'naive-ui';
import { usePrefsStore } from '../../../stores/prefs.js';
import { prefsApi } from '../../../api/prefs.js';
import CollapsibleCard from './CollapsibleCard.vue';

const prefsStore = usePrefsStore();
const message = useMessage();

/** 站点设置分段切换：basic=基本配置 / display=前台显示 */
const siteSection = ref('basic');

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

/* ---------- 前台显示开关 ---------- */
/** 字体切换开关 */
async function handleToggleFontSwitch(val) {
  try {
    await prefsStore.updateFontSwitchEnabled(val);
    message.success(val ? '字体切换功能已开启' : '字体切换功能已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 节日彩蛋开关 */
async function handleToggleFestival(val) {
  try {
    await prefsStore.updateFestivalEnabled(val);
    message.success(val ? '节日彩蛋已开启' : '节日彩蛋已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 节日倒计时开关 */
async function handleToggleFestivalCountdown(val) {
  try {
    await prefsStore.updateFestivalCountdownEnabled(val);
    message.success(val ? '节日倒计时已开启' : '节日倒计时已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 闲置书签标记开关 */
async function handleToggleIdleMark(val) {
  try {
    await prefsStore.updateIdleMarkEnabled(val);
    message.success(val ? '闲置书签标记已开启' : '闲置书签标记已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/* ---------- 视图布局 ---------- */
/** 视图布局功能开关 */
async function handleToggleViewLayout(val) {
  try {
    await prefsStore.updateViewLayoutEnabled(val);
    message.success(val ? '视图布局功能已开启' : '视图布局功能已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 前台排序开关 */
async function handleToggleSort(val) {
  try {
    await prefsStore.updateSortEnabled(val);
    message.success(val ? '前台排序功能已开启' : '前台排序功能已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 选择默认布局（写入后端，清除浏览器数据后访客回落此布局） */
async function handleSelectDefaultViewMode(val) {
  try {
    await prefsStore.updateDefaultViewMode(val);
    message.success('默认布局已保存');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/* ---------- 标语视觉宽度（中文每字计 2，英文每字符计 1，总宽不超过 50） ---------- */
const TAGLINE_MAX_WIDTH = 50;

/** 计算标语视觉宽度：全角（中文等）每字计 2，半角（英文/数字）每字符计 1 */
function taglineWidth(str) {
  let w = 0;
  for (const ch of String(str || '')) w += ch.codePointAt(0) > 0xff ? 2 : 1;
  return w;
}

/** 将标语截断到不超过最大视觉宽度 */
function fitTaglineWidth(str) {
  let w = 0;
  let out = '';
  for (const ch of String(str || '')) {
    const cw = ch.codePointAt(0) > 0xff ? 2 : 1;
    if (w + cw > TAGLINE_MAX_WIDTH) break;
    w += cw;
    out += ch;
  }
  return out;
}

/** 输入框右下角计数文本：宽度 X/50 */
function taglineCountText(v) {
  return `宽度 ${taglineWidth(v)}/${TAGLINE_MAX_WIDTH}`;
}

/* ---------- 统计卡标语 ---------- */
const statTaglineInput = ref('');
const statTaglineSaving = ref(false);

/** 输入超过视觉宽度时自动截断 */
watch(statTaglineInput, (v) => {
  if (taglineWidth(v) > TAGLINE_MAX_WIDTH) statTaglineInput.value = fitTaglineWidth(v);
});

/** 保存统计卡标语 */
async function handleSaveStatTagline() {
  const val = (statTaglineInput.value || '').trim();
  if (taglineWidth(val) > TAGLINE_MAX_WIDTH) {
    message.warning('标语宽度超限（中文每字计 2、英文每字符计 1，总宽不超过 50）');
    return;
  }
  statTaglineSaving.value = true;
  try {
    await prefsStore.updateStatTagline(val);
    statTaglineInput.value = val;
    message.success('统计卡标语已保存');
  } catch (err) {
    message.warning(err.message || '保存失败');
  } finally {
    statTaglineSaving.value = false;
  }
}

/** 清空统计卡标语（恢复默认） */
async function handleClearStatTagline() {
  statTaglineSaving.value = true;
  try {
    await prefsStore.updateStatTagline('');
    statTaglineInput.value = '';
    message.success('已恢复默认标语');
  } catch (err) {
    message.warning(err.message || '清空失败');
  } finally {
    statTaglineSaving.value = false;
  }
}

/* ---------- 自定义 Hero 标语 ---------- */
const heroTaglineInput = ref('');
const heroTaglineSaving = ref(false);

/** 输入超过视觉宽度时自动截断 */
watch(heroTaglineInput, (v) => {
  if (taglineWidth(v) > TAGLINE_MAX_WIDTH) heroTaglineInput.value = fitTaglineWidth(v);
});

/** 保存 Hero 标语 */
async function handleSaveHeroTagline() {
  const val = (heroTaglineInput.value || '').trim();
  if (taglineWidth(val) > TAGLINE_MAX_WIDTH) {
    message.warning('标语宽度超限（中文每字计 2、英文每字符计 1，总宽不超过 50）');
    return;
  }
  heroTaglineSaving.value = true;
  try {
    await prefsStore.updateHeroTagline(val);
    heroTaglineInput.value = val;
    message.success('Hero 标语已保存');
  } catch (err) {
    message.warning(err.message || '保存失败');
  } finally {
    heroTaglineSaving.value = false;
  }
}

/** 清空 Hero 标语（恢复默认） */
async function handleClearHeroTagline() {
  heroTaglineSaving.value = true;
  try {
    await prefsStore.updateHeroTagline('');
    heroTaglineInput.value = '';
    message.success('已恢复默认标语');
  } catch (err) {
    message.warning(err.message || '清空失败');
  } finally {
    heroTaglineSaving.value = false;
  }
}

// 初始化本地输入框值与基本配置表单（避免每次输入都触发 API）
onMounted(() => {
  resetSiteForm();
  heroTaglineInput.value = prefsStore.heroTagline || '';
  statTaglineInput.value = prefsStore.statTagline || '';
});
</script>

<template>
  <!-- 站点设置卡片：分段切换 基本配置 / 前台显示 -->
  <collapsible-card title="🌐 站点设置">
    <n-tabs v-model:value="siteSection" type="segment" size="small" style="margin-bottom: 14px;">
      <n-tab-pane name="basic" tab="基本配置" />
      <n-tab-pane name="display" tab="前台显示" />
    </n-tabs>

    <!-- 基本配置：标题 / Logo / 关键词 / 描述 -->
    <div v-if="siteSection === 'basic'" class="site-section">
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
    </div>

    <!-- 前台显示：开关 + 标语 -->
    <div v-if="siteSection === 'display'" class="display-section">
      <!-- 开关类功能：两列网格布局 -->
      <div class="display-grid">
        <!-- 字体切换开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">字体切换功能</div>
            <div class="display-desc">开启后前台顶部栏显示 Aa 字体切换按钮，可在黑体/楷体/宋体间循环切换</div>
          </div>
          <n-switch
            :value="prefsStore.fontSwitchEnabled"
            @update:value="handleToggleFontSwitch"
          />
        </div>

        <!-- 节日彩蛋开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">节日彩蛋</div>
            <div class="display-desc">春节灯笼、圣诞雪花、中秋月亮等节日装饰自动出现</div>
          </div>
          <n-switch
            :value="prefsStore.festivalEnabled"
            @update:value="handleToggleFestival"
          />
        </div>

        <!-- 节日倒计时开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">节日倒计时</div>
            <div class="display-desc">前台统计卡显示距离最近节日（七夕、中秋、春节等）还有多少天</div>
          </div>
          <n-switch
            :value="prefsStore.festivalCountdownEnabled"
            @update:value="handleToggleFestivalCountdown"
          />
        </div>

        <!-- 闲置书签标记开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">闲置书签标记</div>
            <div class="display-desc">前台书签超过 30 天未访问时，右上角显示红色时钟角标，悬浮提示天数</div>
          </div>
          <n-switch
            :value="prefsStore.idleMarkEnabled"
            @update:value="handleToggleIdleMark"
          />
        </div>

        <!-- 视图布局开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">视图布局</div>
            <div class="display-desc">开启后前台顶栏显示布局切换按钮；手动切换只对当前浏览器生效，刷新不变，清除浏览器数据后恢复下方设置的默认布局</div>
          </div>
          <n-switch
            :value="prefsStore.viewLayoutEnabled"
            @update:value="handleToggleViewLayout"
          />
        </div>

        <!-- 前台排序开关 -->
        <div class="display-row">
          <div class="display-info">
            <div class="display-title">前台排序</div>
            <div class="display-desc">开启后前台顶栏显示排序下拉（分类/书签可切换自定义顺序、添加时间、名称排序）；关闭后隐藏按钮并统一使用自定义顺序</div>
          </div>
          <n-switch
            :value="prefsStore.sortEnabled"
            @update:value="handleToggleSort"
          />
        </div>
      </div>

      <n-divider />

      <!-- 默认布局（视图布局开启时显示） -->
      <div v-if="prefsStore.viewLayoutEnabled" class="view-layout-section">
        <div class="display-info" style="margin-bottom: 10px;">
          <div class="display-title">默认布局</div>
          <div class="display-desc">未手动切换布局的访客，以及清除浏览器数据后，默认使用该布局</div>
        </div>
        <n-radio-group
          :value="prefsStore.defaultViewMode"
          @update:value="handleSelectDefaultViewMode"
          size="small"
        >
          <n-radio value="card" label="标准视图" />
          <n-radio value="list" label="列表视图" />
          <n-radio value="compact" label="紧凑视图" />
        </n-radio-group>
      </div>

      <n-divider />

      <!-- 统计卡标语 -->
      <div class="stat-tagline-section">
        <div class="display-info" style="margin-bottom: 10px;">
          <div class="display-title">统计卡标语</div>
          <div class="display-desc">显示在统计卡底部。留空则使用默认「— everything in its place —」；宽度上限 50（中文每字计 2、英文每字符计 1）</div>
        </div>
        <n-input
          v-model:value="statTaglineInput"
          type="text"
          placeholder="— everything in its place —"
          show-count
          :count="taglineCountText"
          clearable
          @keyup.enter="handleSaveStatTagline"
        />
        <n-space style="margin-top: 10px;">
          <n-button
            type="primary"
            :loading="statTaglineSaving"
            @click="handleSaveStatTagline"
          >
            保存标语
          </n-button>
          <n-button
            :loading="statTaglineSaving"
            :disabled="!statTaglineInput"
            @click="handleClearStatTagline"
          >
            恢复默认
          </n-button>
        </n-space>
      </div>

      <n-divider />

      <!-- 自定义 Hero 标语 -->
      <div class="hero-tagline-section">
        <div class="display-info" style="margin-bottom: 10px;">
          <div class="display-title">自定义 Hero 标语</div>
          <div class="display-desc">显示在前台 Hero 区手写体位置，留空则使用默认标语「— 你的小角落，随时出发 ♡」；宽度上限 50（中文每字计 2、英文每字符计 1）</div>
        </div>
        <n-input
          v-model:value="heroTaglineInput"
          type="text"
          placeholder="— 你的小角落，随时出发 ♡"
          show-count
          :count="taglineCountText"
          clearable
          @keyup.enter="handleSaveHeroTagline"
        />
        <n-space style="margin-top: 10px;">
          <n-button
            type="primary"
            :loading="heroTaglineSaving"
            @click="handleSaveHeroTagline"
          >
            保存标语
          </n-button>
          <n-button
            :loading="heroTaglineSaving"
            :disabled="!heroTaglineInput"
            @click="handleClearHeroTagline"
          >
            恢复默认
          </n-button>
        </n-space>
      </div>
    </div>
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

/* ========== 前台显示设置 ========== */
/* 开关类功能两列布局 */
.display-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px 28px;
}

@media (max-width: 680px) {
  .display-grid {
    grid-template-columns: 1fr;
  }
}

.display-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.display-info {
  flex: 1;
  min-width: 0;
}

.display-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--admin-text, #3d3929);
  margin-bottom: 4px;
}

.display-desc {
  font-size: 12px;
  color: var(--admin-muted, #8a8270);
  line-height: 1.5;
}

.hero-tagline-section {
  padding-top: 4px;
}
</style>
