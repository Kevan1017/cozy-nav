/**
 * 偏好设置管理（主题、搜索引擎、配色预设）
 * 主题模式：light / dark / auto（auto 跟随时间 19:00-07:00）
 * 配色预设：参考 themePresets.js 中的 key
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { prefsApi } from '../api/prefs.js';
import { DEFAULT_PRESET_KEY, findThemeGroup } from '../theme/themePresets.js';

/** 旧预设 key → 新主题 key 的迁移映射 */
const LEGACY_KEY_MAP = {
  'warm-brown': 'amber-pine',
  'deep-navy': 'mint-fresh',
  'oled-black': 'amber-pine',
  'sakura-pink': 'grape-purple',
};

/** 迁移旧预设 key 到新主题 key */
function migratePresetKey(key) {
  if (LEGACY_KEY_MAP[key]) return LEGACY_KEY_MAP[key];
  if (findThemeGroup(key)) return key;
  return DEFAULT_PRESET_KEY;
}

export const usePrefsStore = defineStore('prefs', () => {
  const theme = ref(localStorage.getItem('theme') || 'auto');
  const searchEngine = ref(localStorage.getItem('searchEngine') || 'google');
  const themePreset = ref(migratePresetKey(localStorage.getItem('themePreset')));
  /** 是否在前台显示域名（默认显示） */
  const showDomain = ref(localStorage.getItem('showDomain') !== '0');
  /** 无图模式（默认关闭）：开启后前台隐藏 favicon / 字母头像，纯文字卡片 */
  const noImage = ref(localStorage.getItem('noImage') === '1');
  /** 视图模式：card（卡片）/ list（列表）/ compact（紧凑） */
  const viewMode = ref(localStorage.getItem('viewMode') || 'card');
  /** 视图布局功能开关（默认开启）：开启后可后台设置默认布局、前台手动切换仅本地生效 */
  const viewLayoutEnabled = ref(localStorage.getItem('viewLayoutEnabled') !== '0');
  /** 后端默认视图布局（后台设置，回显与清除浏览器数据后的回落值，不受前台手动切换影响） */
  const defaultViewMode = ref('card');
  /** 字体族：system / rounded / serif */
  const fontFamily = ref(localStorage.getItem('fontFamily') || 'system');
  /** 字体切换功能是否开启（默认开启） */
  const fontSwitchEnabled = ref(localStorage.getItem('fontSwitchEnabled') !== '0');
  /** 自定义 Hero 标语（空字符串表示使用默认） */
  const heroTagline = ref(localStorage.getItem('heroTagline') || '');
  /** 节日彩蛋功能是否开启（默认开启） */
  const festivalEnabled = ref(localStorage.getItem('festivalEnabled') !== '0');
  /** 前台节日倒计时是否开启（默认开启） */
  const festivalCountdownEnabled = ref(localStorage.getItem('festivalCountdownEnabled') !== '0');
  /** 闲置书签标记是否开启（默认关闭，与后端 idle_mark_enabled 默认 0 一致） */
  const idleMarkEnabled = ref(localStorage.getItem('idleMarkEnabled') === '1');
  /** 前台置顶板块是否显示（默认开启，与后端 pin_strip_enabled 默认 1 一致） */
  const pinStripEnabled = ref(localStorage.getItem('pinStripEnabled') !== '0');
  /** 前台常用书签星标是否显示（默认开启，与后端 favorite_mark_enabled 默认 1 一致） */
  const favoriteMarkEnabled = ref(localStorage.getItem('favoriteMarkEnabled') !== '0');
  /** 统计卡底部标语（可在后台编辑，默认英文手写体） */
  const statTagline = ref(localStorage.getItem('statTagline') || '— everything in its place —');
  /** 自定义配色覆盖层：{light:{--bg:'#xxx',...}, dark:{...}}，改过的项覆盖预设 */
  const customTheme = ref(loadCustomTheme());
  /** 网站标题（后台基本配置，默认「悦行」） */
  const siteTitle = ref('悦行');
  /** 站点 Logo 路径（空表示使用文字 Logo） */
  const siteLogo = ref('');
  /** 站点关键词（写入 HTML meta） */
  const siteKeywords = ref('');
  /** 站点描述（写入 HTML meta） */
  const siteDescription = ref('');
  /** 前台分类排序模式：sort_order:asc（默认）/ created_at:asc|desc / name:asc|desc */
  const categorySortMode = ref(localStorage.getItem('categorySortMode') || 'sort_order:asc');
  /** 前台书签排序模式：sort_order:asc（默认）/ created_at:asc|desc / name:asc|desc */
  const linkSortMode = ref(localStorage.getItem('linkSortMode') || 'sort_order:asc');
  /** 前台排序功能开关（默认开启）：开启后前台顶栏显示排序下拉，可切换分类/书签排序模式 */
  const sortEnabled = ref(localStorage.getItem('sortEnabled') !== '0');

  /** 从 localStorage 读取自定义配色，损坏时回退空对象 */
  function loadCustomTheme() {
    try {
      const parsed = JSON.parse(localStorage.getItem('customTheme') || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* 解析失败回退 */ }
    return { light: {}, dark: {} };
  }

  /** 从后端加载偏好 */
  async function fetchPrefs() {
    const res = await prefsApi.get();
    // 兼容旧数据：旧版后端只存 light/dark，无 auto
    const backendTheme = res.data.theme;
    if (backendTheme === 'light' || backendTheme === 'dark' || backendTheme === 'auto') {
      theme.value = backendTheme;
    }
    searchEngine.value = res.data.search_engine;
    if (res.data.theme_preset) {
      themePreset.value = migratePresetKey(res.data.theme_preset);
    }
    // show_domain 后端存 0/1，转 boolean
    if (res.data.show_domain !== undefined && res.data.show_domain !== null) {
      showDomain.value = !!res.data.show_domain;
    }
    // no_image 后端存 0/1，转 boolean
    if (res.data.no_image !== undefined && res.data.no_image !== null) {
      noImage.value = !!res.data.no_image;
    }
    // 视图布局功能开关（站点级配置，同步到本地以便前台按钮显隐）
    if (res.data.view_layout_enabled !== undefined && res.data.view_layout_enabled !== null) {
      viewLayoutEnabled.value = !!res.data.view_layout_enabled;
    }
    // 后端默认布局（单独保存，后台回显用，不受前台手动切换影响）
    if (res.data.view_mode) {
      defaultViewMode.value = res.data.view_mode;
    }
    // 视图布局关闭时：强制使用默认布局，忽略本地手动选择（全站统一布局）
    if (!viewLayoutEnabled.value) {
      viewMode.value = defaultViewMode.value;
      localStorage.setItem('viewMode', defaultViewMode.value);
      localStorage.removeItem('viewModeManual');
    } else if (res.data.view_mode && !localStorage.getItem('viewModeManual')) {
      // 开启时：未手动切换过的访客跟随后端默认布局；手动切换过的保留本地选择（刷新不丢）
      viewMode.value = defaultViewMode.value;
    }
    // 前台排序功能开关（站点级配置，同步到本地以便前台按钮显隐）
    if (res.data.sort_enabled !== undefined && res.data.sort_enabled !== null) {
      sortEnabled.value = !!res.data.sort_enabled;
    }
    // 排序功能关闭时：强制使用默认自定义顺序，忽略本地手动选择（全站统一）
    if (!sortEnabled.value) {
      categorySortMode.value = 'sort_order:asc';
      linkSortMode.value = 'sort_order:asc';
      localStorage.setItem('categorySortMode', 'sort_order:asc');
      localStorage.setItem('linkSortMode', 'sort_order:asc');
    }
    // 字体：手动切换过字体的访客保留本地选择（localStorage 优先，避免刷新后被后端默认值覆盖），
    // 未手动切换过的访客跟随后端默认字体
    if (res.data.font_family && !localStorage.getItem('fontFamilyManual')) {
      fontFamily.value = res.data.font_family;
    }
    if (res.data.font_switch_enabled !== undefined && res.data.font_switch_enabled !== null) {
      fontSwitchEnabled.value = !!res.data.font_switch_enabled;
    }
    if (res.data.hero_tagline !== undefined && res.data.hero_tagline !== null) {
      heroTagline.value = res.data.hero_tagline;
    }
    if (res.data.festival_enabled !== undefined && res.data.festival_enabled !== null) {
      festivalEnabled.value = !!res.data.festival_enabled;
    }
    if (res.data.festival_countdown_enabled !== undefined && res.data.festival_countdown_enabled !== null) {
      festivalCountdownEnabled.value = !!res.data.festival_countdown_enabled;
    }
    if (res.data.idle_mark_enabled !== undefined && res.data.idle_mark_enabled !== null) {
      idleMarkEnabled.value = !!res.data.idle_mark_enabled;
    }
    if (res.data.pin_strip_enabled !== undefined && res.data.pin_strip_enabled !== null) {
      pinStripEnabled.value = !!res.data.pin_strip_enabled;
    }
    if (res.data.favorite_mark_enabled !== undefined && res.data.favorite_mark_enabled !== null) {
      favoriteMarkEnabled.value = !!res.data.favorite_mark_enabled;
    }
    if (res.data.stat_tagline !== undefined && res.data.stat_tagline !== null) {
      statTagline.value = res.data.stat_tagline;
    }
    if (res.data.custom_theme && typeof res.data.custom_theme === 'object') {
      customTheme.value = {
        light: res.data.custom_theme.light || {},
        dark: res.data.custom_theme.dark || {},
      };
    }
    // 站点基本配置（站点级配置，不写入 localStorage）
    if (res.data.site_title) {
      siteTitle.value = res.data.site_title;
    }
    if (res.data.site_logo !== undefined && res.data.site_logo !== null) {
      siteLogo.value = res.data.site_logo;
    }
    if (res.data.site_keywords !== undefined && res.data.site_keywords !== null) {
      siteKeywords.value = res.data.site_keywords;
    }
    if (res.data.site_description !== undefined && res.data.site_description !== null) {
      siteDescription.value = res.data.site_description;
    }
    // 排序模式：手动切换过排序的访客保留本地选择（localStorage 优先），未切换过的跟随后端默认值
    if (res.data.category_sort_mode && !localStorage.getItem('categorySortManual')) {
      categorySortMode.value = res.data.category_sort_mode;
    }
    if (res.data.link_sort_mode && !localStorage.getItem('linkSortManual')) {
      linkSortMode.value = res.data.link_sort_mode;
    }
    syncLocalStorage();
  }

  /** 更新主题模式 */
  async function updateTheme(val) {
    theme.value = val;
    localStorage.setItem('theme', val);
    if (localStorage.getItem('token')) {
      await prefsApi.update({ theme: val });
    }
  }

  /** 更新搜索引擎 */
  async function updateSearchEngine(val) {
    searchEngine.value = val;
    localStorage.setItem('searchEngine', val);
    if (localStorage.getItem('token')) {
      await prefsApi.update({ search_engine: val });
    }
  }

  /** 更新配色预设 */
  async function updateThemePreset(val) {
    themePreset.value = val;
    localStorage.setItem('themePreset', val);
    if (localStorage.getItem('token')) {
      await prefsApi.update({ theme_preset: val });
    }
  }

  /** 更新是否显示域名 */
  async function updateShowDomain(val) {
    showDomain.value = val;
    localStorage.setItem('showDomain', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ show_domain: val ? 1 : 0 });
    }
  }

  /** 更新无图模式（后台设置，全站生效） */
  async function updateNoImage(val) {
    noImage.value = val;
    localStorage.setItem('noImage', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ no_image: val ? 1 : 0 });
    }
  }

  /** 更新视图模式（前台手动切换：仅对当前浏览器生效，不再写后端默认布局） */
  async function updateViewMode(val) {
    viewMode.value = val;
    localStorage.setItem('viewMode', val);
    // 标记用户手动切换过布局：刷新后以本地选择为准，不再被后端默认值覆盖
    localStorage.setItem('viewModeManual', '1');
  }

  /** 更新视图布局功能开关（后台设置） */
  async function updateViewLayoutEnabled(val) {
    viewLayoutEnabled.value = val;
    localStorage.setItem('viewLayoutEnabled', val ? '1' : '0');
    if (!val) {
      // 关闭开关：忽略本地手动选择，立即回落到默认布局（全站统一）
      viewMode.value = defaultViewMode.value;
      localStorage.setItem('viewMode', defaultViewMode.value);
      localStorage.removeItem('viewModeManual');
    }
    if (localStorage.getItem('token')) {
      await prefsApi.update({ view_layout_enabled: val ? 1 : 0 });
    }
  }

  /** 更新默认视图布局（后台设置：清除浏览器数据后访客回落的默认布局） */
  async function updateDefaultViewMode(val) {
    defaultViewMode.value = val;
    if (localStorage.getItem('token')) {
      await prefsApi.update({ view_mode: val });
    }
  }

  /** 更新前台排序功能开关（后台设置） */
  async function updateSortEnabled(val) {
    sortEnabled.value = val;
    localStorage.setItem('sortEnabled', val ? '1' : '0');
    if (!val) {
      // 关闭开关：忽略本地手动选择，立即回落到默认自定义顺序（全站统一）
      categorySortMode.value = 'sort_order:asc';
      linkSortMode.value = 'sort_order:asc';
      localStorage.setItem('categorySortMode', 'sort_order:asc');
      localStorage.setItem('linkSortMode', 'sort_order:asc');
    }
    if (localStorage.getItem('token')) {
      await prefsApi.update({ sort_enabled: val ? 1 : 0 });
    }
  }

  /** 更新字体族 */
  async function updateFontFamily(val) {
    fontFamily.value = val;
    localStorage.setItem('fontFamily', val);
    // 标记用户手动切换过字体：刷新后以本地选择为准，不再被后端默认值覆盖
    localStorage.setItem('fontFamilyManual', '1');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ font_family: val });
    }
  }

  /** 更新字体切换开关 */
  async function updateFontSwitchEnabled(val) {
    fontSwitchEnabled.value = val;
    localStorage.setItem('fontSwitchEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ font_switch_enabled: val ? 1 : 0 });
    }
  }

  /** 更新自定义 Hero 标语 */
  async function updateHeroTagline(val) {
    heroTagline.value = val || '';
    localStorage.setItem('heroTagline', heroTagline.value);
    if (localStorage.getItem('token')) {
      await prefsApi.update({ hero_tagline: heroTagline.value });
    }
  }

  /** 更新节日彩蛋开关 */
  async function updateFestivalEnabled(val) {
    festivalEnabled.value = val;
    localStorage.setItem('festivalEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ festival_enabled: val ? 1 : 0 });
    }
  }

  /** 更新前台节日倒计时开关 */
  async function updateFestivalCountdownEnabled(val) {
    festivalCountdownEnabled.value = val;
    localStorage.setItem('festivalCountdownEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ festival_countdown_enabled: val ? 1 : 0 });
    }
  }

  /** 更新闲置书签标记开关 */
  async function updateIdleMarkEnabled(val) {
    idleMarkEnabled.value = val;
    localStorage.setItem('idleMarkEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ idle_mark_enabled: val ? 1 : 0 });
    }
  }

  /** 更新前台置顶板块显示开关（后台设置） */
  async function updatePinStripEnabled(val) {
    pinStripEnabled.value = val;
    localStorage.setItem('pinStripEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ pin_strip_enabled: val ? 1 : 0 });
    }
  }

  /** 更新前台常用书签星标显示开关（后台设置） */
  async function updateFavoriteMarkEnabled(val) {
    favoriteMarkEnabled.value = val;
    localStorage.setItem('favoriteMarkEnabled', val ? '1' : '0');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ favorite_mark_enabled: val ? 1 : 0 });
    }
  }

  /** 更新统计卡标语 */
  async function updateStatTagline(val) {
    statTagline.value = val || '— everything in its place —';
    localStorage.setItem('statTagline', statTagline.value);
    if (localStorage.getItem('token')) {
      await prefsApi.update({ stat_tagline: statTagline.value });
    }
  }

  /** 更新自定义配色覆盖层（保存完整结构 {light:{}, dark:{}}） */
  async function updateCustomTheme(next) {
    customTheme.value = {
      light: next.light || {},
      dark: next.dark || {},
    };
    localStorage.setItem('customTheme', JSON.stringify(customTheme.value));
    if (localStorage.getItem('token')) {
      await prefsApi.update({ custom_theme: customTheme.value });
    }
  }

  /** 更新站点基本配置（标题/关键词/描述），空字符串表示恢复默认 */
  async function updateSiteBasic(payload) {
    if (payload.site_title !== undefined) siteTitle.value = payload.site_title || '悦行';
    if (payload.site_keywords !== undefined) siteKeywords.value = payload.site_keywords;
    if (payload.site_description !== undefined) siteDescription.value = payload.site_description;
    // 写入 localStorage 触发跨标签页 storage 事件，其他已打开的前台标签页实时同步
    localStorage.setItem('siteTitle', siteTitle.value);
    localStorage.setItem('siteKeywords', siteKeywords.value);
    localStorage.setItem('siteDescription', siteDescription.value);
    if (localStorage.getItem('token')) {
      await prefsApi.update(payload);
    }
  }

  /** 更新站点 Logo 路径（由上传/移除接口写入） */
  async function updateSiteLogo(path) {
    siteLogo.value = path || '';
    // 写入 localStorage 触发跨标签页 storage 事件，其他已打开的前台标签页实时同步
    localStorage.setItem('siteLogo', siteLogo.value);
  }

  /** 更新分类排序模式 */
  async function updateCategorySortMode(val) {
    categorySortMode.value = val;
    localStorage.setItem('categorySortMode', val);
    // 标记用户手动切换过排序：刷新后以本地选择为准，不再被后端默认值覆盖
    localStorage.setItem('categorySortManual', '1');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ category_sort_mode: val });
    }
  }

  /** 更新书签排序模式 */
  async function updateLinkSortMode(val) {
    linkSortMode.value = val;
    localStorage.setItem('linkSortMode', val);
    localStorage.setItem('linkSortManual', '1');
    if (localStorage.getItem('token')) {
      await prefsApi.update({ link_sort_mode: val });
    }
  }

  /** 同步到 localStorage（站点配置一并写入，供跨标签页同步与刷新恢复） */
  function syncLocalStorage() {
    localStorage.setItem('theme', theme.value);
    localStorage.setItem('searchEngine', searchEngine.value);
    localStorage.setItem('themePreset', themePreset.value);
    localStorage.setItem('showDomain', showDomain.value ? '1' : '0');
    localStorage.setItem('noImage', noImage.value ? '1' : '0');
    localStorage.setItem('viewMode', viewMode.value);
    localStorage.setItem('viewLayoutEnabled', viewLayoutEnabled.value ? '1' : '0');
    localStorage.setItem('fontFamily', fontFamily.value);
    localStorage.setItem('fontSwitchEnabled', fontSwitchEnabled.value ? '1' : '0');
    localStorage.setItem('heroTagline', heroTagline.value);
    localStorage.setItem('festivalEnabled', festivalEnabled.value ? '1' : '0');
    localStorage.setItem('festivalCountdownEnabled', festivalCountdownEnabled.value ? '1' : '0');
    localStorage.setItem('idleMarkEnabled', idleMarkEnabled.value ? '1' : '0');
    localStorage.setItem('pinStripEnabled', pinStripEnabled.value ? '1' : '0');
    localStorage.setItem('favoriteMarkEnabled', favoriteMarkEnabled.value ? '1' : '0');
    localStorage.setItem('statTagline', statTagline.value);
    localStorage.setItem('customTheme', JSON.stringify(customTheme.value));
    localStorage.setItem('siteTitle', siteTitle.value);
    localStorage.setItem('siteKeywords', siteKeywords.value);
    localStorage.setItem('siteDescription', siteDescription.value);
    localStorage.setItem('siteLogo', siteLogo.value);
    localStorage.setItem('categorySortMode', categorySortMode.value);
    localStorage.setItem('linkSortMode', linkSortMode.value);
  }

  return {
    theme,
    searchEngine,
    themePreset,
    showDomain,
    noImage,
    viewMode,
    viewLayoutEnabled,
    defaultViewMode,
    fontFamily,
    fontSwitchEnabled,
    heroTagline,
    festivalEnabled,
    festivalCountdownEnabled,
    idleMarkEnabled,
    pinStripEnabled,
    favoriteMarkEnabled,
    statTagline,
    customTheme,
    siteTitle,
    siteLogo,
    siteKeywords,
    siteDescription,
    categorySortMode,
    linkSortMode,
    sortEnabled,
    fetchPrefs,
    updateTheme,
    updateSearchEngine,
    updateThemePreset,
    updateShowDomain,
    updateNoImage,
    updateViewMode,
    updateViewLayoutEnabled,
    updateDefaultViewMode,
    updateSortEnabled,
    updateFontFamily,
    updateFontSwitchEnabled,
    updateHeroTagline,
    updateFestivalEnabled,
    updateFestivalCountdownEnabled,
    updateIdleMarkEnabled,
    updatePinStripEnabled,
    updateFavoriteMarkEnabled,
    updateStatTagline,
    updateCustomTheme,
    updateSiteBasic,
    updateSiteLogo,
    updateCategorySortMode,
    updateLinkSortMode,
  };
});
