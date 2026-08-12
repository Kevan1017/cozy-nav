<script setup>
/**
 * 设置页 - 外观设置卡片（从 Settings.vue 拆出）
 * 单卡片内分段切换三个子项：
 * - 外观主题（themeMode 亮暗切换）
 * - 默认主题（themePreset 配色预设选择）
 * - 自定义配色（customTheme 覆盖层，逐项微调）
 */
import { ref, computed, inject, watch } from 'vue';
import {
  NRadioGroup,
  NRadio,
  NButton,
  NTabs,
  NTabPane,
  NCollapse,
  NCollapseItem,
} from 'naive-ui';
import { usePrefsStore } from '../../../stores/prefs.js';
import { THEME_GROUPS, getPresetByKey } from '../../../theme/themePresets.js';
import CollapsibleCard from './CollapsibleCard.vue';

const prefsStore = usePrefsStore();

/** 外观设置分段切换：theme=外观主题 / preset=默认主题 / custom=自定义配色 */
const appearanceSection = ref('theme');

const isDark = inject('isDark', ref(false));
const themeMode = inject('themeMode', computed(() => 'auto'));
const setThemeMode = inject('setThemeMode', () => {});
const setThemePreset = inject('setThemePreset', () => {});

/** 配色主题列表（每组含亮/暗变体，切换模式时自动使用对应变体） */
const currentPresets = computed(() => THEME_GROUPS);

/** 当前选中的主题 key */
const activePresetKey = computed(() => {
  return prefsStore.themePreset;
});

/** 获取主题在当前模式下的色板 */
function getSwatches(group) {
  const variant = group[isDark.value ? 'dark' : 'light'];
  return variant.swatches;
}

/** 选择预设 */
function handleSelectPreset(presetKey) {
  setThemePreset(presetKey);
}

/* ---------- 自定义配色（预设覆盖层） ---------- */

const CUSTOM_GROUPS = [
  {
    name: 'bg', title: '🖼️ 页面背景',
    items: [
      { key: '--bg', label: '大背景色', desc: '页面主背景底色' },
      { key: '--blob-1', label: '光斑 1', desc: '背景装饰光斑（渐变用）' },
      { key: '--blob-2', label: '光斑 2', desc: '背景装饰光斑' },
      { key: '--blob-3', label: '光斑 3', desc: '背景装饰光斑' },
      { key: '--blob-4', label: '光斑 4', desc: '背景装饰光斑' },
    ],
  },
  {
    name: 'topbar', title: '🏷️ 顶栏区域',
    items: [
      { key: '--topbar-logo', label: 'Logo 底色', desc: '顶栏 Logo 方块渐变主色（上传图片 Logo 后自动隐藏）', hideWhenLogo: true },
      { key: '--topbar-logo2', label: 'Logo 渐变副色', desc: '顶栏 Logo 方块渐变副色（上传图片 Logo 后自动隐藏）', hideWhenLogo: true },
      { key: '--topbar-logo-ink', label: 'Logo 文字色', desc: 'Logo 方块上「悦」字颜色（上传图片 Logo 后自动隐藏）', hideWhenLogo: true },
      { key: '--topbar-name', label: '站点名称', desc: '顶栏站点名称文字' },
      { key: '--topbar-sub', label: '副标题', desc: '顶栏副标语（你的小角落）' },
      { key: '--topbar-pill-border', label: '胶囊边框', desc: '日期胶囊与图标按钮描边' },
      { key: '--topbar-icon', label: '图标/日期文字', desc: '图标按钮图标与日期文字颜色' },
    ],
  },
  {
    name: 'hero', title: '📝 Hero 区域',
    items: [
      { key: '--hero-greet', label: '时段问候', desc: '「👋 下午好」问候文字' },
      { key: '--hero-title', label: '大标题', desc: 'Hero 大标题主文字' },
      { key: '--hero-title-pop', label: '标题强调词', desc: '大标题中高亮的强调词（如「哪里」）' },
      { key: '--hero-handwrite', label: '手写标语', desc: '手写风格标语（— 你的小角落，随时出发 ♡）' },
      { key: '--hero-desc', label: '描述文字', desc: '描述段落文字' },
      { key: '--hero-desc-strong', label: '描述强调', desc: '描述中加粗的数字/关键词' },
    ],
  },
  {
    name: 'search', title: '📊 统计卡片 + 搜索框',
    items: [
      { key: '--stat-card', label: '统计卡底', desc: 'Hero 右侧统计卡片底色' },
      { key: '--stat-card2', label: '统计卡渐变', desc: '统计卡片渐变副色' },
      { key: '--stat-peach', label: '站点块', desc: '统计卡「128 站点」数字块' },
      { key: '--stat-mint', label: '分类块', desc: '统计卡「06 分类」数字块' },
      { key: '--stat-festival', label: '倒计时块', desc: '统计卡节日倒计时格底色', showWhen: 'festivalCountdownEnabled' },
      { key: '--stat-ink', label: '站点数字', desc: '站点数字块上的大数字颜色' },
      { key: '--stat-site-text', label: '站点文字', desc: '站点数字下方的「站点」小标签颜色' },
      { key: '--stat-cat-ink', label: '分类数字', desc: '分类数字块上的大数字颜色' },
      { key: '--stat-cat-text', label: '分类文字', desc: '分类数字下方的「分类」小标签颜色' },
      { key: '--stat-fest-ink', label: '倒计时数字', desc: '节日倒计时格上的大数字颜色', showWhen: 'festivalCountdownEnabled' },
      { key: '--stat-fest-text', label: '倒计时文字', desc: '节日倒计时格下方「距 七夕」小标签颜色', showWhen: 'festivalCountdownEnabled' },
      { key: '--stat-label', label: '底部标语', desc: '统计卡底部「— everything in its place —」标语颜色' },
      { key: '--search-bg', label: '输入框底', desc: '搜索框与结果下拉背景' },
      { key: '--search-border', label: '输入框边框', desc: '搜索框描边' },
      { key: '--search-ink', label: '输入文字', desc: '输入文字与结果项名称' },
      { key: '--search-placeholder', label: '占位/域名', desc: '占位文字、结果域名、未选引擎标签' },
      { key: '--search-btn', label: '出发按钮', desc: '出发按钮渐变主色' },
      { key: '--search-btn2', label: '按钮渐变副色', desc: '出发按钮渐变副色' },
      { key: '--search-btn-ink', label: '按钮文字', desc: '出发按钮文字颜色' },
    ],
  },
  {
    name: 'pin', title: '📌 置顶栏',
    items: [
      { key: '--pin-title', label: '标题文字', desc: '「置顶 · 最常访问」标题' },
      { key: '--pin-sub', label: '副标题', desc: '「— 你最离不开的几个」副标语' },
      { key: '--pin-line', label: '分割线', desc: '标题右侧的分割线' },
      { key: '--pin-card', label: '卡片底', desc: '置顶卡片背景与空状态占位' },
      { key: '--pin-name', label: '卡片名称', desc: '置顶卡片内站点名称' },
      { key: '--pin-rank', label: '序号', desc: '置顶卡片右上角序号' },
      { key: '--pin-shadow', label: '卡片阴影', desc: '置顶卡片悬浮阴影' },
    ],
  },
  {
    name: 'cat', title: '🗂️ 分类卡',
    items: [
      { key: '--cat-card', label: '卡片底', desc: '分类卡片背景' },
      { key: '--cat-title', label: '分类名', desc: '分类卡片标题文字' },
      { key: '--cat-sub', label: '副标题', desc: '分类副标题（含锁定提示文字）' },
      { key: '--cat-count', label: '计数文字', desc: '右上角数量胶囊文字' },
      { key: '--cat-count-bg', label: '计数胶囊底', desc: '数量胶囊、展开按钮与锁定占位底色' },
      { key: '--cat-lock-border', label: '锁定边框', desc: '分类锁定占位与加密提示虚线边框' },
    ],
  },
  {
    name: 'link', title: '🔗 书签条目',
    items: [
      { key: '--link-bg', label: '条目底', desc: '分类内书签条目浅底色' },
      { key: '--link-hover', label: '悬停底', desc: '书签条目悬停底色' },
      { key: '--link-name', label: '名称文字', desc: '书签名称' },
      { key: '--link-domain', label: '域名文字', desc: '书签域名' },
      { key: '--link-accent', label: '锁定悬停强调', desc: '加密条目悬停时的边框强调色' },
      { key: '--link-lock-bg', label: '锁定条目底', desc: '加密书签条目底色' },
      { key: '--link-lock-border', label: '锁定条目边框', desc: '加密书签条目虚线边框' },
      { key: '--link-lock-text', label: '锁定文字', desc: '加密条目「已加密」文字' },
      { key: '--link-idle', label: '闲置时钟', desc: '超 30 天未访问的红色时钟角标' },
    ],
  },
  {
    name: 'foot', title: '🦶 页脚',
    items: [
      { key: '--foot-text', label: '版权文字', desc: '页脚版权文字' },
      { key: '--foot-line', label: '分割线', desc: '页脚顶部虚线' },
      { key: '--foot-sig', label: '手写签名', desc: '页脚手写签名文字' },
      { key: '--foot-accent', label: '强调词', desc: '签名中的强调词（软乎乎）' },
    ],
  },
];

/** 编辑亮/暗哪一套（默认跟随当前模式） */
const ccMode = ref(isDark.value ? 'dark' : 'light');

/**
 * 外观主题为 light/dark 时锁定自定义配色的编辑目标（只能编辑对应那套）；
 * 外观主题为 auto 时两套都会生效，返回 null 表示保留亮/暗手动切换。
 */
const ccLockedMode = computed(() => (themeMode.value === 'auto' ? null : themeMode.value));

// 锁定模式变化时同步 ccMode，确保只编辑外观主题对应的那套
watch(ccLockedMode, (m) => {
  if (m) ccMode.value = m;
});

/** 自定义配色编辑目标提示文案 */
const ccLockHint = computed(() => {
  if (ccLockedMode.value === 'dark') return '当前外观主题为暗色模式，自定义项只作用于暗色配色。';
  if (ccLockedMode.value === 'light') return '当前外观主题为亮色模式，自定义项只作用于亮色配色。';
  return '亮色/暗色模式各配一套，可分别调整。';
});

/** 当前所选预设变体（提供各项默认色，用于取色器回显和还原基线） */
const activePresetVariant = computed(() => getPresetByKey(activePresetKey.value, ccMode.value));

/** 当前模式的自定义变量表 */
const ccVars = computed(() => prefsStore.customTheme?.[ccMode.value] || {});

/** 任意颜色 → 可用作 input[type=color] 的 hex，无法解析时回退灰色 */
function toHex(color) {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  const m = typeof color === 'string' && color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
  }
  return '#808080';
}

/** 顶栏独立变量 → 未自定义时的全局回退变量（用于取色器回显和还原基线） */
const TOPBAR_FALLBACK = {
  '--topbar-logo': '--pop',
  '--topbar-logo2': '--pop2',
  '--topbar-logo-ink': '--on-pop',
  '--topbar-name': '--ink',
  '--topbar-sub': '--soft',
  '--topbar-pill-border': '--rule',
  '--topbar-icon': '--ink2',
};

/** Hero 区域独立变量 → 全局回退变量 */
const HERO_FALLBACK = {
  '--hero-greet': '--pop2',
  '--hero-title': '--ink',
  '--hero-title-pop': '--pop',
  '--hero-handwrite': '--pop2',
  '--hero-desc': '--ink2',
  '--hero-desc-strong': '--ink',
};

/** 统计卡片 + 搜索框独立变量 → 全局回退变量 */
const STATSEARCH_FALLBACK = {
  '--stat-card': '--card-solid',
  '--stat-card2': '--cream',
  '--stat-peach': '--peach',
  '--stat-mint': '--mint',
  '--stat-festival': '--pop',
  '--stat-ink': '--on-pop',
  '--stat-site-text': '--ink2',
  '--stat-cat-ink': '--on-pop',
  '--stat-cat-text': '--ink2',
  '--stat-fest-ink': '--on-pop',
  '--stat-fest-text': '--ink2',
  '--stat-label': '--soft',
  '--search-bg': '--card-solid',
  '--search-border': '--rule',
  '--search-ink': '--ink',
  '--search-placeholder': '--soft',
  '--search-btn': '--pop',
  '--search-btn2': '--pop2',
  '--search-btn-ink': '--on-pop',
};

/** 置顶栏独立变量 → 全局回退变量 */
const PIN_FALLBACK = {
  '--pin-title': '--ink',
  '--pin-sub': '--soft',
  '--pin-line': '--rule',
  '--pin-card': '--card',
  '--pin-name': '--ink',
  '--pin-rank': '--soft',
  '--pin-shadow': '--shadow',
};

/** 分类卡独立变量 → 全局回退变量 */
const CAT_FALLBACK = {
  '--cat-card': '--card',
  '--cat-title': '--ink',
  '--cat-sub': '--soft',
  '--cat-count': '--soft',
  '--cat-count-bg': '--card-solid',
  '--cat-lock-border': '--peach',
};

/** 书签条目独立变量 → 全局回退变量 */
const LINK_FALLBACK = {
  '--link-bg': '--card-solid',
  '--link-hover': '--card-solid',
  '--link-name': '--ink',
  '--link-domain': '--soft',
  '--link-accent': '--pop',
  '--link-lock-bg': '--card-solid',
  '--link-lock-border': '--peach',
  '--link-lock-text': '--soft',
  '--link-idle': '--rose',
};

/** 页脚独立变量 → 全局回退变量 */
const FOOT_FALLBACK = {
  '--foot-text': '--soft',
  '--foot-line': '--rule',
  '--foot-sig': '--ink',
  '--foot-accent': '--pop',
};

/** 某项当前显示色：自定义优先，否则取预设值（独立变量回退到全局对应色） */
function ccValue(key) {
  const preset = activePresetVariant.value.cssVars || {};
  const fb = TOPBAR_FALLBACK[key] || HERO_FALLBACK[key] || STATSEARCH_FALLBACK[key]
    || PIN_FALLBACK[key] || CAT_FALLBACK[key] || LINK_FALLBACK[key] || FOOT_FALLBACK[key];
  // 自定义值优先
  if (ccVars.value[key]) return toHex(ccVars.value[key]);
  // 预设 cssVars 中直接定义
  if (preset[key]) return toHex(preset[key]);
  // 回退到全局变量：预设已覆盖则用预设值，否则读取运行时计算值（tokens.css 默认，保证与真实渲染一致）
  if (fb) {
    if (preset[fb]) return toHex(preset[fb]);
    const computed = getComputedStyle(document.documentElement).getPropertyValue(fb).trim();
    if (computed) return toHex(computed);
  }
  return '#808080';
}

/** 是否为自定义项 */
function isCcCustom(key) {
  return !!ccVars.value[key];
}

/** 取色 HEX 输入框显示值（统一 #rrggbb 6 位） */
function ccHexDisplay(key) {
  return toHex(ccValue(key)).slice(0, 7);
}

/** HEX 输入提交：校验并规范化后保存，非法则恢复显示原色 */
function onCcHexChange(key, el) {
  const raw = (el.value || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    onCcChange(key, '#' + raw.toLowerCase());
  } else if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    onCcChange(key, '#' + raw.split('').map((c) => c + c).join('').toLowerCase());
  } else {
    el.value = ccHexDisplay(key);
  }
}

/** 修改单项颜色：写入自定义覆盖层并保存 */
function onCcChange(key, val) {
  const next = JSON.parse(JSON.stringify(prefsStore.customTheme || { light: {}, dark: {} }));
  next[ccMode.value] = { ...(next[ccMode.value] || {}), [key]: val };
  prefsStore.updateCustomTheme(next).catch(() => {});
}

/** 还原单项：删除该自定义，恢复预设值 */
function onCcReset(key) {
  const next = JSON.parse(JSON.stringify(prefsStore.customTheme || { light: {}, dark: {} }));
  const vars = { ...(next[ccMode.value] || {}) };
  delete vars[key];
  next[ccMode.value] = vars;
  prefsStore.updateCustomTheme(next).catch(() => {});
}

/** 重置当前模式全部自定义 */
function onCcResetAll() {
  const next = JSON.parse(JSON.stringify(prefsStore.customTheme || { light: {}, dark: {} }));
  next[ccMode.value] = {};
  prefsStore.updateCustomTheme(next).catch(() => {});
}

/** 当前模式自定义项数量 */
const ccCount = computed(() => Object.keys(ccVars.value).length);

/** 当前主题名展示 */
const themeLabel = computed(() => {
  const m = themeMode.value;
  if (m === 'dark') return '当前：🌙 暗色模式';
  if (m === 'auto') return `当前：⏰ 跟随时间（${isDark.value ? '暗色' : '亮色'}）`;
  return '当前：☀️ 亮色模式';
});

/** 主题选项 */
const themeOptions = [
  { label: '☀️ 亮色', value: 'light' },
  { label: '🌙 暗色', value: 'dark' },
  { label: '⏰ 自动', value: 'auto' },
];
</script>

<template>
  <!-- 外观设置卡片：分段切换 外观主题 / 默认主题 / 自定义配色 -->
  <collapsible-card title="🎨 外观设置">
    <template #header-extra>
      <span class="theme-label">{{ themeLabel }}</span>
    </template>
    <n-tabs v-model:value="appearanceSection" type="segment" size="small" style="margin-bottom: 14px;">
      <n-tab-pane name="theme" tab="外观主题" />
      <n-tab-pane name="preset" tab="默认主题" />
      <n-tab-pane name="custom" tab="自定义配色" />
    </n-tabs>

    <!-- 外观主题：亮暗切换 -->
    <div v-if="appearanceSection === 'theme'" class="theme-section">
      <n-radio-group
        :value="themeMode"
        @update:value="(v) => setThemeMode(v)"
        size="large"
      >
        <n-radio
          v-for="opt in themeOptions"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </n-radio-group>
      <p class="hint">
        自动模式：19:00-07:00 自动切换为暗色，其余时间亮色。
      </p>
    </div>

    <!-- 默认主题：配色预设选择 -->
    <div v-if="appearanceSection === 'preset'" class="preset-section">
      <div class="preset-grid">
        <div
          v-for="preset in currentPresets"
          :key="preset.key"
          class="preset-card"
          :class="{ active: preset.key === activePresetKey }"
          @click="handleSelectPreset(preset.key)"
        >
          <div class="preset-swatches">
            <span
              v-for="(color, idx) in getSwatches(preset)"
              :key="idx"
              class="swatch"
              :style="{ background: color }"
            />
          </div>
          <div class="preset-info">
            <div class="preset-name">{{ preset.name }}</div>
            <div class="preset-desc">{{ preset.desc }}</div>
          </div>
          <div v-if="preset.key === activePresetKey" class="preset-check">✓</div>
        </div>
      </div>
      <p class="hint" style="margin-top: 12px;">
        选择配色主题将同时应用到前台和管理后台。切换亮暗模式时，自动使用该主题对应的亮/暗变体，保持色系一致。
      </p>
    </div>

    <!-- 自定义配色：预设覆盖层 -->
    <div v-if="appearanceSection === 'custom'" class="custom-section">
      <p class="hint" style="margin-bottom: 12px;">
        在预设基础上逐项微调：改过的项覆盖当前预设，未改的继承预设；切换预设后自定义项仍保留。{{ ccLockHint }}
      </p>
      <!-- 外观主题为 auto 时保留亮/暗切换，两套都可编辑 -->
      <n-tabs v-if="!ccLockedMode" v-model:value="ccMode" type="segment" size="small" style="margin-bottom: 14px;">
        <n-tab-pane name="light" tab="☀️ 亮色模式" />
        <n-tab-pane name="dark" tab="🌙 暗色模式" />
      </n-tabs>
      <!-- 外观主题为 light/dark 时锁定编辑目标，提示当前正在编辑哪一套 -->
      <div v-else class="cc-lock-tip">
        {{ ccLockedMode === 'dark' ? '🌙 正在自定义暗色配色' : '☀️ 正在自定义亮色配色' }}
      </div>

      <n-collapse>
        <n-collapse-item v-for="grp in CUSTOM_GROUPS" :key="grp.name" :name="grp.name" :title="grp.title">
          <div class="cc-grid">
            <template v-for="item in grp.items" :key="item.key">
              <div
                v-if="(!item.showWhen || prefsStore[item.showWhen]) && (!item.hideWhenLogo || !prefsStore.siteLogo)"
                class="cc-row"
                :title="`${item.label}：${item.desc}`"
              >
                <span class="cc-label">{{ item.label }}</span>
                <input
                  type="color"
                  class="cc-input"
                  :value="ccValue(item.key)"
                  @input="onCcChange(item.key, $event.target.value)"
                />
                <input
                  type="text"
                  class="cc-hex"
                  :value="ccHexDisplay(item.key)"
                  spellcheck="false"
                  @keydown.enter="onCcHexChange(item.key, $event.target)"
                  @blur="onCcHexChange(item.key, $event.target)"
                />
                <n-button size="tiny" quaternary :disabled="!isCcCustom(item.key)" @click="onCcReset(item.key)">
                  还原
                </n-button>
              </div>
            </template>
          </div>
        </n-collapse-item>
      </n-collapse>
      <div class="cc-footer">
        <span>当前自定义项：{{ ccCount }} 项（{{ ccMode === 'dark' ? '暗色' : '亮色' }}）</span>
        <n-button size="small" secondary :disabled="ccCount === 0" @click="onCcResetAll">
          重置当前模式全部自定义
        </n-button>
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

/* 主题切换 */
.theme-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text-2);
}
.theme-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.theme-section :deep(.n-radio) {
  margin-right: 24px;
}

/* 配色预设 */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  background: var(--admin-card);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all .2s ease;
}
.preset-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, .2);
}
.preset-card.active {
  border-color: var(--admin-accent);
  background: var(--admin-card-solid);
  box-shadow: 0 4px 16px -4px rgba(0, 0, 0, .18);
}
.preset-swatches {
  display: flex;
  gap: 4px;
  border-radius: 10px;
  overflow: hidden;
  height: 32px;
}
.swatch {
  flex: 1;
  border-radius: 0;
  transition: flex .3s ease;
}
.preset-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.preset-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
}
.preset-desc {
  font-size: 12px;
  color: var(--admin-muted);
}
.preset-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--admin-accent);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* 自定义配色 */
/* 外观主题 light/dark 时锁定编辑目标的提示条 */
.cc-lock-tip {
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--admin-card-solid, rgba(0, 0, 0, .03));
  border: 1px dashed var(--admin-border, rgba(0, 0, 0, .12));
  font-size: 13px;
  color: var(--admin-text-2, inherit);
}
.cc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px 16px;
}
.cc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cc-label {
  flex: 0 0 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--admin-text2, inherit);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-input {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--admin-border, rgba(0, 0, 0, .12));
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  flex: none;
}
.cc-input::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.cc-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
.cc-hex {
  width: 64px;
  flex: none;
  padding: 3px 6px;
  font-size: 12px;
  font-family: ui-monospace, 'Consolas', monospace;
  color: var(--admin-text, inherit);
  background: var(--admin-input, transparent);
  border: 1px solid var(--admin-input-border, var(--admin-border, rgba(0, 0, 0, .12)));
  border-radius: 6px;
  outline: none;
  transition: border-color .2s ease;
}
.cc-hex:focus {
  border-color: var(--admin-accent, inherit);
}
.cc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--admin-border, rgba(0, 0, 0, .12));
  font-size: 12px;
  color: var(--admin-muted, inherit);
}
</style>
