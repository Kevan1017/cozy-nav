/**
 * 主题预设应用 composable
 * 根据当前亮/暗模式和预设 key，将 CSS 变量注入到 :root，
 * 同时生成 Naive UI 的 themeOverrides 供 n-config-provider 使用
 */
import { computed } from 'vue';
import {
  LIGHT_PRESETS,
  DARK_PRESETS,
  DEFAULT_PRESET_KEYS,
  getPresetByKey,
  findPreset,
} from '../theme/themePresets.js';

/**
 * 应用主题预设到 documentElement（CSS 变量）
 * 在预设基础上叠加自定义配色覆盖层（customTheme[mode]），改过的项覆盖预设
 * @param {string} presetKey - 预设 key
 * @param {'light'|'dark'} mode - 当前模式
 * @param {{light?:Object, dark?:Object}} customTheme - 自定义配色覆盖层（可选）
 */
export function applyPresetCssVars(presetKey, mode, customTheme = {}) {
  const preset = getPresetByKey(presetKey, mode);
  const root = document.documentElement;
  const body = document.body;

  // 收集需要清除的变量名（通过 --tp- 前缀识别预设注入的变量）
  const toRemove = [];
  for (let i = 0; i < root.style.length; i++) {
    const name = root.style[i];
    if (name.startsWith('--tp-')) {
      toRemove.push(name);
      toRemove.push(`--${name.slice(4)}`);
    }
  }
  // 从 html 和 body 上都清除（预设变量会同时设置在两者上）
  toRemove.forEach((name) => {
    root.style.removeProperty(name);
    if (body) body.style.removeProperty(name);
  });

  // 注入预设的 CSS 变量
  // 注意：必须设置在 body 上，因为 tokens.css 的 body:has(#dm:checked)
  // 选择器会在 body 上覆盖暗色变量，body 的 inline style 优先级高于选择器
  if (preset.cssVars) {
    for (const [key, value] of Object.entries(preset.cssVars)) {
      root.style.setProperty(key, value);
      root.style.setProperty(`--tp-${key.slice(2)}`, value);
      if (body) {
        body.style.setProperty(key, value);
        body.style.setProperty(`--tp-${key.slice(2)}`, value);
      }
    }
  }

  // 叠加自定义配色：用户改过的变量覆盖预设值
  const customVars = customTheme?.[mode] || {};
  for (const [key, value] of Object.entries(customVars)) {
    root.style.setProperty(key, value);
    root.style.setProperty(`--tp-${key.slice(2)}`, value);
    if (body) {
      body.style.setProperty(key, value);
      body.style.setProperty(`--tp-${key.slice(2)}`, value);
    }
  }
}

/** 后台 admin CSS 变量 → Naive UI override 的映射（后台组件颜色由 naive 渲染，需同步覆盖） */
const ADMIN_NAIVE_MAP = {
  '--admin-sidebar': ['Layout', 'siderColor'],
  '--admin-header': ['Layout', 'headerColor'],
  '--admin-surface': ['common', 'bodyColor'],
  '--admin-input': ['Input', 'color'],
  '--admin-input-border': ['Input', 'border'],
  '--admin-table-head': ['DataTable', 'thColor'],
  '--admin-accent': ['common', 'primaryColor'],
  '--admin-accent-2': ['common', 'primaryColorHover'],
  '--admin-text': ['common', 'textColor1'],
  '--admin-text-2': ['common', 'textColor2'],
  '--admin-muted': ['common', 'textColor3'],
  '--admin-card': ['common', 'cardColor'],
  '--admin-border': ['common', 'borderColor'],
};

/**
 * 将自定义的 --admin-* 变量同步合并进 Naive UI overrides
 * @param {Object} customTheme - 自定义配色覆盖层
 * @param {'light'|'dark'} mode - 当前模式
 * @param {Object} baseOverrides - 预设的 naiveOverrides
 * @returns {Object} 合并后的 overrides
 */
export function mergeAdminCustomOverrides(customTheme, mode, baseOverrides) {
  const merged = JSON.parse(JSON.stringify(baseOverrides || {}));
  const customVars = customTheme?.[mode] || {};
  for (const [varName, [section, prop]] of Object.entries(ADMIN_NAIVE_MAP)) {
    if (!customVars[varName]) continue;
    if (!merged[section]) merged[section] = {};
    if (typeof merged[section] === 'object' && !Array.isArray(merged[section])) {
      merged[section][prop] = customVars[varName];
    }
  }
  return merged;
}

/**
 * 获取预设的 Naive UI 主题覆盖
 * @param {string} presetKey - 预设 key
 * @param {'light'|'dark'} mode - 当前模式
 * @returns {Object|null} naiveOverrides 或 null
 */
export function getPresetNaiveOverrides(presetKey, mode) {
  const preset = getPresetByKey(presetKey, mode);
  return preset?.naiveOverrides || null;
}

/**
 * 切换预设（CSS 变量 + Naive UI）
 * @param {string} presetKey - 预设 key
 * @param {'light'|'dark'} mode - 目标模式
 * @param {import('vue').Ref} naiveThemeOverridesRef - naiveThemeOverrides 的 ref
 */
export function switchPreset(presetKey, mode, naiveThemeOverridesRef) {
  applyPresetCssVars(presetKey, mode);
  const overrides = getPresetNaiveOverrides(presetKey, mode);
  if (overrides && naiveThemeOverridesRef) {
    naiveThemeOverridesRef.value = overrides;
  }
}

/**
 * 使用主题预设的 composable
 * @param {import('vue').Ref} isDarkRef - 当前暗色状态 ref
 * @param {import('vue').Ref} naiveOverridesRef - Naive UI overrides ref
 */
export function useThemePreset(isDarkRef, naiveOverridesRef) {
  const lightPresets = LIGHT_PRESETS;
  const darkPresets = DARK_PRESETS;

  /** 当前模式的预设列表 */
  const currentPresets = computed(() =>
    isDarkRef.value ? darkPresets : lightPresets
  );

  /** 根据 key 应用预设（自动判断模式） */
  function applyPreset(presetKey) {
    const mode = isDarkRef.value ? 'dark' : 'light';
    switchPreset(presetKey, mode, naiveOverridesRef);
  }

  /** 初始化：根据预设 key 和当前模式应用一次 */
  function initPreset(presetKey) {
    const mode = isDarkRef.value ? 'dark' : 'light';
    const preset = findPreset(presetKey) || getPresetByKey(null, mode);
    switchPreset(preset.key, mode, naiveOverridesRef);
    return preset.key;
  }

  return {
    lightPresets,
    darkPresets,
    currentPresets,
    applyPreset,
    initPreset,
    switchPreset,
    getPresetByKey,
    DEFAULT_PRESET_KEYS,
  };
}
