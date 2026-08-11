/**
 * Naive UI 主题配置（与 tokens.css 对齐）
 * 亮/暗双模式，主色薄荷绿 + 次色樱花粉，大圆角，毛玻璃质感
 */

/* ---------- 共享 Token（与 tokens.css 对齐） ---------- */

const SHARED_LIGHT = {
  primaryColor: '#3FB98F',       // --pop 薄荷绿
  primaryColorHover: '#57C99F',
  primaryColorPressed: '#35A37E',
  primaryColorSuppl: '#3FB98F',
  infoColor: '#FF6B8A',          // --pop2 樱花粉
  infoColorHover: '#FF84A0',
  infoColorPressed: '#E85A79',
  successColor: '#3FB98F',
  warningColor: '#F4B860',
  errorColor: '#F0727A',
  borderRadius: '14px',
  borderRadiusSmall: '10px',
  fontFamily: `'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans CN',
    system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
};

const SHARED_DARK = {
  primaryColor: '#F2A85A',
  primaryColorHover: '#F5B874',
  primaryColorPressed: '#E09840',
  primaryColorSuppl: '#F2A85A',
  infoColor: '#F27898',
  infoColorHover: '#F490AB',
  infoColorPressed: '#DE6888',
  successColor: '#6BB898',
  warningColor: '#F4C070',
  errorColor: '#FF8087',
  borderRadius: '14px',
  borderRadiusSmall: '10px',
  fontFamily: SHARED_LIGHT.fontFamily,
};

/* ---------- 浅色主题 Overrides ---------- */

export const lightThemeOverrides = {
  common: {
    ...SHARED_LIGHT,
    // 中性色（对齐 tokens.css 亮色系）
    bodyColor: 'rgba(255, 255, 255, .7)',        // --card
    cardColor: '#FFFFFF',                           // --card-solid
    modalColor: '#E6EEF5',                          // --cream
    popoverColor: '#FFFFFF',
    tableColor: 'rgba(255, 255, 255, .7)',
    tableHeaderColor: '#E6EEF5',                    // --cream
    dividerColor: '#C8DCEA',                        // --peach (分割线)
    borderColor: '#C8DCEA',
    textColorBase: '#2B3947',                       // --ink
    textColor1: '#2B3947',
    textColor2: '#4A5B6C',                           // --ink2
    textColor3: '#7A8B9C',                           // --soft
  },
  Layout: {
    siderColor: '#E6EEF5',                           // --cream
    headerColor: '#E6EEF5',
  },
  Menu: {
    borderRadius: '14px',
    itemColorHover: '#C8DCEA',                       // --peach
    itemColorActive: '#C2E8DC',                      // --mint
    itemColorActiveCollapsed: '#C2E8DC',
    itemTextColorActive: '#2B3947',
    itemTextColorHover: '#2B3947',
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
    colorHoverPrimary: SHARED_LIGHT.primaryColorHover,
    colorPressedPrimary: SHARED_LIGHT.primaryColorPressed,
    borderHover: SHARED_LIGHT.primaryColor,
  },
  Input: {
    borderRadius: '10px',
    color: '#FFFFFF',
    colorFocus: '#FFFFFF',
    borderHover: SHARED_LIGHT.primaryColor,
    borderFocus: SHARED_LIGHT.primaryColor,
  },
  Select: {
    borderRadius: '10px',
    peers: {
      InternalSelectMenu: { borderRadius: '14px' },
    },
  },
  Card: {
    colorEmbedded: 'rgba(255, 255, 255, .7)',
    borderRadius: '18px',
    borderColor: '#C8DCEA',
  },
  Modal: {
    borderRadius: '18px',
    color: '#E6EEF5',
    boxShadow: '0 30px 60px -30px rgba(43, 57, 71, .4)',
  },
  DataTable: {
    borderRadius: '18px',
    tdColor: 'rgba(255, 255, 255, .7)',
    thColor: '#E6EEF5',
    thTextColor: '#4A5B6C',
    tdTextColor: '#2B3947',
    borderColor: '#C8DCEA',
    colorStriped: 'rgba(255, 255, 255, .4)',
  },
  Drawer: {
    bodyPadding: '0',
    borderRadius: '18px 0 0 18px',
  },
  Tag: {
    borderRadius: '8px',
  },
  Form: {
    labelFontSizeSmall: '13px',
    labelTextColor: '#4A5B6C',
  },
};

/* ---------- 暗色主题 Overrides（暖棕夜色体系，对齐 tokens.css） ---------- */

export const darkThemeOverrides = {
  common: {
    ...SHARED_DARK,
    // 中性色 — 暖棕夜色
    bodyColor: 'rgba(255, 253, 248, .04)',
    cardColor: '#2A221A',
    modalColor: '#26201A',
    popoverColor: '#2E2620',
    tableColor: '#2A221A',
    tableHeaderColor: '#2E2620',
    dividerColor: 'rgba(255, 253, 248, .10)',
    borderColor: 'rgba(255, 253, 248, .12)',
    textColorBase: '#F5EFE5',
    textColor1: '#F5EFE5',
    textColor2: '#C8BCAE',
    textColor3: '#9A8E80',
  },
  Layout: {
    siderColor: '#1E1814',
    headerColor: '#26201A',
  },
  Menu: {
    borderRadius: '14px',
    itemColorHover: '#332A20',
    itemColorActive: 'rgba(242, 168, 90, .20)',
    itemColorActiveCollapsed: 'rgba(242, 168, 90, .20)',
    itemTextColorActive: '#F5EFE5',
    itemTextColorHover: '#F5EFE5',
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
    colorHoverPrimary: SHARED_DARK.primaryColorHover,
    colorPressedPrimary: SHARED_DARK.primaryColorPressed,
    textColor2: '#F5EFE5',
    border: '1px solid rgba(255,255,255,.12)',
  },
  Input: {
    borderRadius: '10px',
    color: '#332A20',
    colorFocus: '#332A20',
    border: '1px solid rgba(255,253,248,.16)',
    borderHover: '#F2A85A',
    borderFocus: '#F2A85A',
    textColor: '#F5EFE5',
    placeholderColor: '#9A8E80',
  },
  Select: {
    borderRadius: '10px',
    peers: {
      InternalSelectMenu: { borderRadius: '14px' },
    },
  },
  Card: {
    colorEmbedded: '#2A221A',
    borderRadius: '18px',
    borderColor: 'rgba(255,253,248,.08)',
    color: '#2A221A',
  },
  Modal: {
    borderRadius: '18px',
    color: '#26201A',
    boxShadow: '0 30px 60px -30px rgba(0, 0, 0, .7)',
  },
  DataTable: {
    borderRadius: '18px',
    tdColor: '#2A221A',
    thColor: '#2E2620',
    thTextColor: '#C8BCAE',
    tdTextColor: '#F5EFE5',
    borderColor: 'rgba(255,253,248,.08)',
    colorStriped: 'rgba(255,253,248,.03)',
  },
  Drawer: {
    bodyPadding: '0',
    borderRadius: '18px 0 0 18px',
    color: '#1E1814',
  },
  Tag: {
    borderRadius: '8px',
  },
  Form: {
    labelFontSizeSmall: '13px',
    labelTextColor: '#C8BCAE',
  },
  Checkbox: {
    color: '#F2A85A',
    colorChecked: '#F2A85A',
  },
  Radio: {
    color: '#F2A85A',
  },
  Switch: {
    colorActive: '#F2A85A',
  },
  Progress: {
    color: '#F2A85A',
  },
  Badge: {
    color: '#F2A85A',
  },
};

/* ---------- 自定义断点（与 useResponsive.js 对齐） ---------- */

export const breakpoints = {
  xs: 0,
  s: 768,   // 移动端分界
  m: 1024,  // 平板分界
  l: 1440,
  xl: 1920,
};
