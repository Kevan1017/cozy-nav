<script setup>
/**
 * 外观设置页 - 前台显示卡片（从 SettingsSite.vue 抽离）
 * 开关类：字体切换 / 节日彩蛋 / 节日倒计时 / 闲置书签标记 / 置顶板块 / 常用书签标记 / 无图模式 / 视图布局 / 前台排序
 * 子设置：默认布局 / 统计卡标语 / 自定义 Hero 标语
 */
import { ref, watch, onMounted } from 'vue';
import {
  NSwitch,
  NDivider,
  NSpace,
  NRadioGroup,
  NRadio,
  NInput,
  NButton,
  useMessage,
} from 'naive-ui';
import { usePrefsStore } from '../../../stores/prefs.js';
import CollapsibleCard from './CollapsibleCard.vue';

const prefsStore = usePrefsStore();
const message = useMessage();

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

/** 前台置顶板块开关 */
async function handleTogglePinStrip(val) {
  try {
    await prefsStore.updatePinStripEnabled(val);
    message.success(val ? '置顶板块已开启' : '置顶板块已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 前台常用书签标记开关 */
async function handleToggleFavoriteMark(val) {
  try {
    await prefsStore.updateFavoriteMarkEnabled(val);
    message.success(val ? '常用书签标记已开启' : '常用书签标记已关闭');
  } catch (err) {
    message.warning(err.message || '保存失败');
  }
}

/** 无图模式开关 */
async function handleToggleNoImage(val) {
  try {
    await prefsStore.updateNoImage(val);
    message.success(val ? '无图模式已开启' : '无图模式已关闭');
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

// 初始化本地输入框值（避免每次输入都触发 API）
onMounted(() => {
  heroTaglineInput.value = prefsStore.heroTagline || '';
  statTaglineInput.value = prefsStore.statTagline || '';
});
</script>

<template>
  <!-- 前台显示卡片：开关 + 默认布局 + 标语 -->
  <collapsible-card title="🧩 前台显示">
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
          <div class="display-desc">前台书签超过 30 天未访问时，名称右侧显示红色时钟图标，悬浮提示天数</div>
        </div>
        <n-switch
          :value="prefsStore.idleMarkEnabled"
          @update:value="handleToggleIdleMark"
        />
      </div>

      <!-- 置顶板块开关 -->
      <div class="display-row">
        <div class="display-info">
          <div class="display-title">置顶板块</div>
          <div class="display-desc">开启后前台显示置顶书签快捷栏；关闭后隐藏该板块（不影响书签的置顶标记，重新开启即恢复显示）</div>
        </div>
        <n-switch
          :value="prefsStore.pinStripEnabled"
          @update:value="handleTogglePinStrip"
        />
      </div>

      <!-- 常用书签标记开关 -->
      <div class="display-row">
        <div class="display-info">
          <div class="display-title">常用书签标记</div>
          <div class="display-desc">前台被标记为「常用」的书签条目左侧显示金色竖条；关闭后竖条隐藏（标记保留，重新开启即恢复显示）</div>
        </div>
        <n-switch
          :value="prefsStore.favoriteMarkEnabled"
          @update:value="handleToggleFavoriteMark"
        />
      </div>

      <!-- 无图模式开关 -->
      <div class="display-row">
        <div class="display-info">
          <div class="display-title">无图模式</div>
          <div class="display-desc">前台隐藏书签的网站图标与字母头像，卡片只显示文字，视觉更简洁且节省流量</div>
        </div>
        <n-switch
          :value="prefsStore.noImage"
          @update:value="handleToggleNoImage"
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
        <n-radio value="dial" label="图标平铺" />
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
  </collapsible-card>
</template>

<style scoped>
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
