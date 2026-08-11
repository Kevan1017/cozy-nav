/**
 * 网页配色主题组 —— 每组包含亮色和暗色两个变体
 * 用户选择主题（如"琥珀青松"），切换亮暗模式时自动使用该主题的对应变体
 * 保持色系一致性：亮色模式的琥珀金 → 暗色模式仍是琥珀金
 */

/** @typedef {Object} PresetVariant
 *  @property {string[]} swatches     预览色板（4-5 个色块 hex）
 *  @property {Object} cssVars        覆盖 tokens.css 中的 CSS 变量
 *  @property {Object} naiveOverrides 覆盖 naiveTheme.js 中的主题 overrides
 */

/** @typedef {Object} ThemeGroup
 *  @property {string} key           唯一标识
 *  @property {string} name          显示名称
 *  @property {string} desc          简短描述
 *  @property {PresetVariant} light  亮色变体
 *  @property {PresetVariant} dark   暗色变体
 */

/* ============================================================
 * 1. 琥珀青松 —— 暖米底 + 琥珀金 + 薄荷绿
 *    亮色：温暖米白     暗色：暖棕夜色
 * ============================================================ */
const amberPineTheme = {
  key: 'amber-pine',
  name: '琥珀青松',
  desc: '温暖米白，琥珀金点缀',
  light: {
    swatches: ['#FAF6F0', '#F2A85A', '#3FB98F', '#FFD4A0', '#E8C9A8'],
    cssVars: {
      '--bg': '#FAF6F0',
      '--ink': '#2B3947',
      '--ink2': '#4A5B6C',
      '--soft': '#7A8B9C',
      '--pop': '#F2A85A',
      '--pop2': '#3FB98F',
      '--card': 'rgba(255,255,255,.72)',
      '--card-solid': '#FFFFFF',
      '--cream': '#E8DFD0',
      '--rule': '#D9C8B8',
      '--shadow': 'rgba(42,57,71,.14)',
      '--blob-1': 'rgba(232,180,120,.35)',
      '--blob-2': 'rgba(123,184,154,.30)',
      '--blob-3': 'rgba(200,159,200,.28)',
      '--blob-4': 'rgba(140,184,216,.28)',
      '--admin-sidebar': '#EEE6D8',
      '--admin-header': '#EDE4D4',
      '--admin-surface': '#FAF4EA',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#D9C8B8',
      '--admin-table-head': '#F0E8DA',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.72)',
        cardColor: '#FFFFFF',
        modalColor: '#E8DFD0',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.72)',
        tableHeaderColor: '#E8DFD0',
        dividerColor: '#D9C8B8',
        borderColor: '#D9C8B8',
        textColorBase: '#2B3947',
        textColor1: '#2B3947',
        textColor2: '#4A5B6C',
        textColor3: '#7A8B9C',
        primaryColor: '#F2A85A',
        primaryColorHover: '#F5B874',
        primaryColorPressed: '#E09840',
        primaryColorSuppl: '#F2A85A',
        infoColor: '#3FB98F',
        infoColorHover: '#57C99F',
        successColor: '#3FB98F',
        warningColor: '#F4B860',
        errorColor: '#F0727A',
      },
      Layout: { siderColor: '#EEE6D8', headerColor: '#EDE4D4' },
      Menu: {
        itemColorHover: '#DDD1BE',
        itemColorActive: 'rgba(242,168,90,.18)',
        itemColorActiveCollapsed: 'rgba(242,168,90,.18)',
        itemTextColorActive: '#2B3947',
        itemTextColorHover: '#2B3947',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #D9C8B8',
        borderHover: '#F2A85A',
        borderFocus: '#F2A85A',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.72)', borderColor: '#D9C8B8' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.72)',
        thColor: '#E8DFD0',
        thTextColor: '#4A5B6C',
        tdTextColor: '#2B3947',
        borderColor: '#D9C8B8',
      },
    },
  },
  dark: {
    swatches: ['#1A1410', '#F2A85A', '#6BB898', '#332A20', '#2A221A'],
    cssVars: {
      '--bg': '#1A1410',
      '--ink': '#F5EFE5',
      '--ink2': '#C8BCAE',
      '--soft': '#9A8E80',
      '--pop': '#F2A85A',
      '--pop2': '#6BB898',
      '--card': 'rgba(255,253,248,.04)',
      '--card-solid': '#2A221A',
      '--cream': '#26201A',
      '--rule': 'rgba(255,253,248,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(242,168,90,.15)',
      '--blob-2': 'rgba(123,184,154,.12)',
      '--blob-3': 'rgba(200,159,200,.12)',
      '--blob-4': 'rgba(140,184,216,.10)',
      '--admin-sidebar': '#1E1814',
      '--admin-header': '#26201A',
      '--admin-surface': '#2A221A',
      '--admin-input': '#332A20',
      '--admin-input-border': 'rgba(255,253,248,.16)',
      '--admin-table-head': '#2E2620',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,253,248,.04)',
        cardColor: '#2A221A',
        modalColor: '#26201A',
        popoverColor: '#2E2620',
        tableColor: '#2A221A',
        tableHeaderColor: '#2E2620',
        dividerColor: 'rgba(255,253,248,.10)',
        borderColor: 'rgba(255,253,248,.12)',
        textColorBase: '#F5EFE5',
        textColor1: '#F5EFE5',
        textColor2: '#C8BCAE',
        textColor3: '#9A8E80',
        primaryColor: '#F2A85A',
        primaryColorHover: '#F5B874',
        primaryColorPressed: '#E09840',
        primaryColorSuppl: '#F2A85A',
        infoColor: '#F27898',
        successColor: '#6BB898',
        warningColor: '#F4C070',
        errorColor: '#FF8087',
      },
      Layout: { siderColor: '#1E1814', headerColor: '#26201A' },
      Menu: {
        itemColorHover: '#332A20',
        itemColorActive: 'rgba(242,168,90,.20)',
        itemColorActiveCollapsed: 'rgba(242,168,90,.20)',
        itemTextColorActive: '#F5EFE5',
        itemTextColorHover: '#F5EFE5',
      },
      Input: {
        color: '#332A20',
        colorFocus: '#332A20',
        border: '1px solid rgba(255,253,248,.16)',
        borderHover: '#F2A85A',
        borderFocus: '#F2A85A',
        textColor: '#F5EFE5',
        placeholderColor: '#9A8E80',
      },
      Card: { colorEmbedded: '#2A221A', borderColor: 'rgba(255,253,248,.08)', color: '#2A221A' },
      DataTable: {
        tdColor: '#2A221A',
        thColor: '#2E2620',
        thTextColor: '#C8BCAE',
        tdTextColor: '#F5EFE5',
        borderColor: 'rgba(255,253,248,.08)',
      },
    },
  },
};

/* ============================================================
 * 2. 薄荷清凉 —— 冷白底 + 薄荷绿 + 天蓝
 *    亮色：清爽冷白     暗色：深空蓝调
 * ============================================================ */
const mintFreshTheme = {
  key: 'mint-fresh',
  name: '薄荷清凉',
  desc: '清爽冷白，薄荷蓝天',
  light: {
    swatches: ['#F4FAF8', '#3FB98F', '#5DADE2', '#B8E0D2', '#AED6F1'],
    cssVars: {
      '--bg': '#F4FAF8',
      '--ink': '#2A3A4A',
      '--ink2': '#4A5B6C',
      '--soft': '#7A8B9C',
      '--pop': '#3FB98F',
      '--pop2': '#5DADE2',
      '--card': 'rgba(255,255,255,.75)',
      '--card-solid': '#FFFFFF',
      '--cream': '#E6F0EC',
      '--rule': '#C8DCEA',
      '--shadow': 'rgba(42,58,74,.12)',
      '--blob-1': 'rgba(63,185,143,.28)',
      '--blob-2': 'rgba(93,173,226,.30)',
      '--blob-3': 'rgba(184,224,210,.25)',
      '--blob-4': 'rgba(174,214,241,.28)',
      '--admin-sidebar': '#EAF2EE',
      '--admin-header': '#E8F0EC',
      '--admin-surface': '#F0F6F3',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#C8DCEA',
      '--admin-table-head': '#E4EDE8',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.75)',
        cardColor: '#FFFFFF',
        modalColor: '#E6F0EC',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.75)',
        tableHeaderColor: '#E6F0EC',
        dividerColor: '#C8DCEA',
        borderColor: '#C8DCEA',
        textColorBase: '#2A3A4A',
        textColor1: '#2A3A4A',
        textColor2: '#4A5B6C',
        textColor3: '#7A8B9C',
        primaryColor: '#3FB98F',
        primaryColorHover: '#57C99F',
        primaryColorPressed: '#35A37E',
        primaryColorSuppl: '#3FB98F',
        infoColor: '#5DADE2',
        infoColorHover: '#7CBDE9',
        successColor: '#3FB98F',
        warningColor: '#F4B860',
        errorColor: '#F0727A',
      },
      Layout: { siderColor: '#EAF2EE', headerColor: '#E8F0EC' },
      Menu: {
        itemColorHover: '#D6E5DD',
        itemColorActive: 'rgba(63,185,143,.18)',
        itemColorActiveCollapsed: 'rgba(63,185,143,.18)',
        itemTextColorActive: '#2A3A4A',
        itemTextColorHover: '#2A3A4A',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #C8DCEA',
        borderHover: '#3FB98F',
        borderFocus: '#3FB98F',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.75)', borderColor: '#C8DCEA' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.75)',
        thColor: '#E6F0EC',
        thTextColor: '#4A5B6C',
        tdTextColor: '#2A3A4A',
        borderColor: '#C8DCEA',
      },
    },
  },
  dark: {
    swatches: ['#0F1923', '#4FD0A0', '#5DADE2', '#1A2535', '#151C28'],
    cssVars: {
      '--bg': '#0F1923',
      '--ink': '#E8EEF5',
      '--ink2': '#B8C4D0',
      '--soft': '#8A96A8',
      '--pop': '#4FD0A0',
      '--pop2': '#5DADE2',
      '--card': 'rgba(255,255,255,.04)',
      '--card-solid': '#1A2230',
      '--cream': '#1E2736',
      '--rule': 'rgba(255,255,255,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(79,208,160,.15)',
      '--blob-2': 'rgba(93,173,226,.15)',
      '--blob-3': 'rgba(184,224,210,.10)',
      '--blob-4': 'rgba(174,214,241,.10)',
      '--admin-sidebar': '#151C28',
      '--admin-header': '#1E2736',
      '--admin-surface': '#1A2230',
      '--admin-input': '#222B3A',
      '--admin-input-border': 'rgba(255,255,255,.14)',
      '--admin-table-head': '#1E2736',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.04)',
        cardColor: '#1A2230',
        modalColor: '#1E2736',
        popoverColor: '#1E2736',
        tableColor: '#1A2230',
        tableHeaderColor: '#1E2736',
        dividerColor: 'rgba(255,255,255,.10)',
        borderColor: 'rgba(255,255,255,.12)',
        textColorBase: '#E8EEF5',
        textColor1: '#E8EEF5',
        textColor2: '#B8C4D0',
        textColor3: '#8A96A8',
        primaryColor: '#4FD0A0',
        primaryColorHover: '#6ED9B1',
        primaryColorPressed: '#44B88F',
        primaryColorSuppl: '#4FD0A0',
        infoColor: '#5DADE2',
        successColor: '#4FD0A0',
        warningColor: '#F4C070',
        errorColor: '#FF8087',
      },
      Layout: { siderColor: '#151C28', headerColor: '#1E2736' },
      Menu: {
        itemColorHover: '#222B3A',
        itemColorActive: 'rgba(79,208,160,.18)',
        itemColorActiveCollapsed: 'rgba(79,208,160,.18)',
        itemTextColorActive: '#E8EEF5',
        itemTextColorHover: '#E8EEF5',
      },
      Input: {
        color: '#222B3A',
        colorFocus: '#222B3A',
        border: '1px solid rgba(255,255,255,.14)',
        borderHover: '#4FD0A0',
        borderFocus: '#4FD0A0',
        textColor: '#E8EEF5',
        placeholderColor: '#8A96A8',
      },
      Card: { colorEmbedded: '#1A2230', borderColor: 'rgba(255,255,255,.08)', color: '#1A2230' },
      DataTable: {
        tdColor: '#1A2230',
        thColor: '#1E2736',
        thTextColor: '#B8C4D0',
        tdTextColor: '#E8EEF5',
        borderColor: 'rgba(255,255,255,.08)',
      },
    },
  },
};

/* ============================================================
 * 3. 暮色橙橘 —— 暖橙底 + 橘红 + 焦糖
 *    亮色：暖橙米白     暗色：深棕夜橘
 * ============================================================ */
const sunsetOrangeTheme = {
  key: 'sunset-orange',
  name: '暮色橙橘',
  desc: '暖橙底色，橘红焦糖',
  light: {
    swatches: ['#FBF1E8', '#E8704A', '#D4843A', '#FFC9A0', '#E8B070'],
    cssVars: {
      '--bg': '#FBF1E8',
      '--ink': '#3A2A1F',
      '--ink2': '#5C4434',
      '--soft': '#8A7060',
      '--pop': '#E8704A',
      '--pop2': '#D4843A',
      '--card': 'rgba(255,255,255,.74)',
      '--card-solid': '#FFFFFF',
      '--cream': '#F4E2D0',
      '--rule': '#E0C8B0',
      '--shadow': 'rgba(58,42,31,.14)',
      '--blob-1': 'rgba(232,112,74,.30)',
      '--blob-2': 'rgba(212,132,58,.28)',
      '--blob-3': 'rgba(255,201,160,.30)',
      '--blob-4': 'rgba(232,176,112,.28)',
      '--admin-sidebar': '#F4E6D2',
      '--admin-header': '#F2E2CC',
      '--admin-surface': '#FAF0E2',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#E0C8B0',
      '--admin-table-head': '#F2E2CC',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.74)',
        cardColor: '#FFFFFF',
        modalColor: '#F4E2D0',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.74)',
        tableHeaderColor: '#F4E2D0',
        dividerColor: '#E0C8B0',
        borderColor: '#E0C8B0',
        textColorBase: '#3A2A1F',
        textColor1: '#3A2A1F',
        textColor2: '#5C4434',
        textColor3: '#8A7060',
        primaryColor: '#E8704A',
        primaryColorHover: '#ED8562',
        primaryColorPressed: '#D05F38',
        primaryColorSuppl: '#E8704A',
        infoColor: '#D4843A',
        infoColorHover: '#DE964F',
        successColor: '#6BAE5A',
        warningColor: '#F4B860',
        errorColor: '#F0727A',
      },
      Layout: { siderColor: '#F4E6D2', headerColor: '#F2E2CC' },
      Menu: {
        itemColorHover: '#E6D2B8',
        itemColorActive: 'rgba(232,112,74,.18)',
        itemColorActiveCollapsed: 'rgba(232,112,74,.18)',
        itemTextColorActive: '#3A2A1F',
        itemTextColorHover: '#3A2A1F',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #E0C8B0',
        borderHover: '#E8704A',
        borderFocus: '#E8704A',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.74)', borderColor: '#E0C8B0' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.74)',
        thColor: '#F4E2D0',
        thTextColor: '#5C4434',
        tdTextColor: '#3A2A1F',
        borderColor: '#E0C8B0',
      },
    },
  },
  dark: {
    swatches: ['#1F1410', '#FF8C5A', '#E89A4D', '#2A1D16', '#33241A'],
    cssVars: {
      '--bg': '#1F1410',
      '--ink': '#F5E8DC',
      '--ink2': '#D0B8A4',
      '--soft': '#9A8474',
      '--pop': '#FF8C5A',
      '--pop2': '#E89A4D',
      '--card': 'rgba(255,253,248,.04)',
      '--card-solid': '#2A1D16',
      '--cream': '#2E2018',
      '--rule': 'rgba(255,253,248,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(255,140,90,.15)',
      '--blob-2': 'rgba(232,154,77,.15)',
      '--blob-3': 'rgba(255,180,140,.10)',
      '--blob-4': 'rgba(212,132,58,.10)',
      '--admin-sidebar': '#231814',
      '--admin-header': '#2A1D16',
      '--admin-surface': '#2A1D16',
      '--admin-input': '#33241A',
      '--admin-input-border': 'rgba(255,253,248,.16)',
      '--admin-table-head': '#2E2418',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,253,248,.04)',
        cardColor: '#2A1D16',
        modalColor: '#2E2018',
        popoverColor: '#33241A',
        tableColor: '#2A1D16',
        tableHeaderColor: '#2E2418',
        dividerColor: 'rgba(255,253,248,.10)',
        borderColor: 'rgba(255,253,248,.12)',
        textColorBase: '#F5E8DC',
        textColor1: '#F5E8DC',
        textColor2: '#D0B8A4',
        textColor3: '#9A8474',
        primaryColor: '#FF8C5A',
        primaryColorHover: '#FFA070',
        primaryColorPressed: '#E67A48',
        primaryColorSuppl: '#FF8C5A',
        infoColor: '#E89A4D',
        infoColorHover: '#F0AC65',
        successColor: '#7CC46E',
        warningColor: '#F4C070',
        errorColor: '#FF8087',
      },
      Layout: { siderColor: '#231814', headerColor: '#2A1D16' },
      Menu: {
        itemColorHover: '#33241A',
        itemColorActive: 'rgba(255,140,90,.20)',
        itemColorActiveCollapsed: 'rgba(255,140,90,.20)',
        itemTextColorActive: '#F5E8DC',
        itemTextColorHover: '#F5E8DC',
      },
      Input: {
        color: '#33241A',
        colorFocus: '#33241A',
        border: '1px solid rgba(255,253,248,.16)',
        borderHover: '#FF8C5A',
        borderFocus: '#FF8C5A',
        textColor: '#F5E8DC',
        placeholderColor: '#9A8474',
      },
      Card: { colorEmbedded: '#2A1D16', borderColor: 'rgba(255,253,248,.08)', color: '#2A1D16' },
      DataTable: {
        tdColor: '#2A1D16',
        thColor: '#2E2418',
        thTextColor: '#D0B8A4',
        tdTextColor: '#F5E8DC',
        borderColor: 'rgba(255,253,248,.08)',
      },
    },
  },
};

/* ============================================================
 * 4. 深海静谧 —— 冷灰底 + 青蓝 + 海绿
 *    亮色：清冷灰白     暗色：深海夜色
 * ============================================================ */
const deepSeaTheme = {
  key: 'deep-sea',
  name: '深海静谧',
  desc: '冷灰底色，青蓝海绿',
  light: {
    swatches: ['#EEF3F5', '#2B7FA8', '#3FA68A', '#B8D2DC', '#A8D4C4'],
    cssVars: {
      '--bg': '#EEF3F5',
      '--ink': '#1F2D36',
      '--ink2': '#3A4B56',
      '--soft': '#6A7B86',
      '--pop': '#2B7FA8',
      '--pop2': '#3FA68A',
      '--card': 'rgba(255,255,255,.75)',
      '--card-solid': '#FFFFFF',
      '--cream': '#DDE5E8',
      '--rule': '#B8C8D2',
      '--shadow': 'rgba(31,45,54,.12)',
      '--blob-1': 'rgba(43,127,168,.25)',
      '--blob-2': 'rgba(63,166,138,.25)',
      '--blob-3': 'rgba(184,210,220,.28)',
      '--blob-4': 'rgba(168,212,196,.28)',
      '--admin-sidebar': '#E2E9EC',
      '--admin-header': '#E0E7EA',
      '--admin-surface': '#EAF0F3',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#B8C8D2',
      '--admin-table-head': '#DDE5E8',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.75)',
        cardColor: '#FFFFFF',
        modalColor: '#DDE5E8',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.75)',
        tableHeaderColor: '#DDE5E8',
        dividerColor: '#B8C8D2',
        borderColor: '#B8C8D2',
        textColorBase: '#1F2D36',
        textColor1: '#1F2D36',
        textColor2: '#3A4B56',
        textColor3: '#6A7B86',
        primaryColor: '#2B7FA8',
        primaryColorHover: '#3F90BC',
        primaryColorPressed: '#246E92',
        primaryColorSuppl: '#2B7FA8',
        infoColor: '#3FA68A',
        infoColorHover: '#56B89E',
        successColor: '#3FA68A',
        warningColor: '#F4B860',
        errorColor: '#F0727A',
      },
      Layout: { siderColor: '#E2E9EC', headerColor: '#E0E7EA' },
      Menu: {
        itemColorHover: '#CAD6DC',
        itemColorActive: 'rgba(43,127,168,.18)',
        itemColorActiveCollapsed: 'rgba(43,127,168,.18)',
        itemTextColorActive: '#1F2D36',
        itemTextColorHover: '#1F2D36',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #B8C8D2',
        borderHover: '#2B7FA8',
        borderFocus: '#2B7FA8',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.75)', borderColor: '#B8C8D2' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.75)',
        thColor: '#DDE5E8',
        thTextColor: '#3A4B56',
        tdTextColor: '#1F2D36',
        borderColor: '#B8C8D2',
      },
    },
  },
  dark: {
    swatches: ['#0E1820', '#4DA0CC', '#5BC4A4', '#142028', '#1A242C'],
    cssVars: {
      '--bg': '#0E1820',
      '--ink': '#E0E8EE',
      '--ink2': '#A8B8C4',
      '--soft': '#7A8896',
      '--pop': '#4DA0CC',
      '--pop2': '#5BC4A4',
      '--card': 'rgba(255,255,255,.04)',
      '--card-solid': '#1A242C',
      '--cream': '#1E2830',
      '--rule': 'rgba(255,255,255,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(77,160,204,.15)',
      '--blob-2': 'rgba(91,196,164,.15)',
      '--blob-3': 'rgba(120,180,210,.10)',
      '--blob-4': 'rgba(140,200,180,.10)',
      '--admin-sidebar': '#121C24',
      '--admin-header': '#1A242C',
      '--admin-surface': '#1A242C',
      '--admin-input': '#222C36',
      '--admin-input-border': 'rgba(255,255,255,.14)',
      '--admin-table-head': '#1E2830',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.04)',
        cardColor: '#1A242C',
        modalColor: '#1E2830',
        popoverColor: '#1E2830',
        tableColor: '#1A242C',
        tableHeaderColor: '#1E2830',
        dividerColor: 'rgba(255,255,255,.10)',
        borderColor: 'rgba(255,255,255,.12)',
        textColorBase: '#E0E8EE',
        textColor1: '#E0E8EE',
        textColor2: '#A8B8C4',
        textColor3: '#7A8896',
        primaryColor: '#4DA0CC',
        primaryColorHover: '#66B0D6',
        primaryColorPressed: '#3F8DB5',
        primaryColorSuppl: '#4DA0CC',
        infoColor: '#5BC4A4',
        infoColorHover: '#72D1B4',
        successColor: '#5BC4A4',
        warningColor: '#F4C070',
        errorColor: '#FF8087',
      },
      Layout: { siderColor: '#121C24', headerColor: '#1A242C' },
      Menu: {
        itemColorHover: '#222C36',
        itemColorActive: 'rgba(77,160,204,.18)',
        itemColorActiveCollapsed: 'rgba(77,160,204,.18)',
        itemTextColorActive: '#E0E8EE',
        itemTextColorHover: '#E0E8EE',
      },
      Input: {
        color: '#222C36',
        colorFocus: '#222C36',
        border: '1px solid rgba(255,255,255,.14)',
        borderHover: '#4DA0CC',
        borderFocus: '#4DA0CC',
        textColor: '#E0E8EE',
        placeholderColor: '#7A8896',
      },
      Card: { colorEmbedded: '#1A242C', borderColor: 'rgba(255,255,255,.08)', color: '#1A242C' },
      DataTable: {
        tdColor: '#1A242C',
        thColor: '#1E2830',
        thTextColor: '#A8B8C4',
        tdTextColor: '#E0E8EE',
        borderColor: 'rgba(255,255,255,.08)',
      },
    },
  },
};

/* ============================================================
 * 5. 原木森野 —— 暖沙底 + 橄榄绿 + 赭石
 *    亮色：暖沙米色     暗色：深林夜木
 * ============================================================ */
const forestWoodTheme = {
  key: 'forest-wood',
  name: '原木森野',
  desc: '暖沙底色，橄榄赭石',
  light: {
    swatches: ['#F4EEDF', '#6B8E3F', '#A6703A', '#C8D8A8', '#E0C8A0'],
    cssVars: {
      '--bg': '#F4EEDF',
      '--ink': '#2A2A1F',
      '--ink2': '#4A4636',
      '--soft': '#7A7460',
      '--pop': '#6B8E3F',
      '--pop2': '#A6703A',
      '--card': 'rgba(255,255,255,.74)',
      '--card-solid': '#FFFFFF',
      '--cream': '#E8DEC8',
      '--rule': '#D0C4A8',
      '--shadow': 'rgba(42,42,31,.14)',
      '--blob-1': 'rgba(107,142,63,.25)',
      '--blob-2': 'rgba(166,112,58,.25)',
      '--blob-3': 'rgba(200,216,168,.28)',
      '--blob-4': 'rgba(224,200,160,.28)',
      '--admin-sidebar': '#EDE4D0',
      '--admin-header': '#EAE0CC',
      '--admin-surface': '#F2EBDC',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#D0C4A8',
      '--admin-table-head': '#E8DEC8',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.74)',
        cardColor: '#FFFFFF',
        modalColor: '#E8DEC8',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.74)',
        tableHeaderColor: '#E8DEC8',
        dividerColor: '#D0C4A8',
        borderColor: '#D0C4A8',
        textColorBase: '#2A2A1F',
        textColor1: '#2A2A1F',
        textColor2: '#4A4636',
        textColor3: '#7A7460',
        primaryColor: '#6B8E3F',
        primaryColorHover: '#7BA04D',
        primaryColorPressed: '#5E7E36',
        primaryColorSuppl: '#6B8E3F',
        infoColor: '#A6703A',
        infoColorHover: '#B8824C',
        successColor: '#6B8E3F',
        warningColor: '#D49A3A',
        errorColor: '#C7655A',
      },
      Layout: { siderColor: '#EDE4D0', headerColor: '#EAE0CC' },
      Menu: {
        itemColorHover: '#DCD0B4',
        itemColorActive: 'rgba(107,142,63,.18)',
        itemColorActiveCollapsed: 'rgba(107,142,63,.18)',
        itemTextColorActive: '#2A2A1F',
        itemTextColorHover: '#2A2A1F',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #D0C4A8',
        borderHover: '#6B8E3F',
        borderFocus: '#6B8E3F',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.74)', borderColor: '#D0C4A8' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.74)',
        thColor: '#E8DEC8',
        thTextColor: '#4A4636',
        tdTextColor: '#2A2A1F',
        borderColor: '#D0C4A8',
      },
    },
  },
  dark: {
    swatches: ['#181410', '#8FB05A', '#C68848', '#221E18', '#2A2418'],
    cssVars: {
      '--bg': '#181410',
      '--ink': '#EDE5D6',
      '--ink2': '#C4B8A0',
      '--soft': '#948770',
      '--pop': '#8FB05A',
      '--pop2': '#C68848',
      '--card': 'rgba(255,253,248,.04)',
      '--card-solid': '#2A2418',
      '--cream': '#2E2818',
      '--rule': 'rgba(255,253,248,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(143,176,90,.15)',
      '--blob-2': 'rgba(198,136,72,.15)',
      '--blob-3': 'rgba(180,200,140,.10)',
      '--blob-4': 'rgba(200,170,120,.10)',
      '--admin-sidebar': '#1C1814',
      '--admin-header': '#221E18',
      '--admin-surface': '#2A2418',
      '--admin-input': '#322A1E',
      '--admin-input-border': 'rgba(255,253,248,.16)',
      '--admin-table-head': '#2E2818',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,253,248,.04)',
        cardColor: '#2A2418',
        modalColor: '#2E2818',
        popoverColor: '#322A1E',
        tableColor: '#2A2418',
        tableHeaderColor: '#2E2818',
        dividerColor: 'rgba(255,253,248,.10)',
        borderColor: 'rgba(255,253,248,.12)',
        textColorBase: '#EDE5D6',
        textColor1: '#EDE5D6',
        textColor2: '#C4B8A0',
        textColor3: '#948770',
        primaryColor: '#8FB05A',
        primaryColorHover: '#A2C26D',
        primaryColorPressed: '#7E9F4C',
        primaryColorSuppl: '#8FB05A',
        infoColor: '#C68848',
        infoColorHover: '#D49A5C',
        successColor: '#8FB05A',
        warningColor: '#E0B060',
        errorColor: '#D87060',
      },
      Layout: { siderColor: '#1C1814', headerColor: '#221E18' },
      Menu: {
        itemColorHover: '#322A1E',
        itemColorActive: 'rgba(143,176,90,.20)',
        itemColorActiveCollapsed: 'rgba(143,176,90,.20)',
        itemTextColorActive: '#EDE5D6',
        itemTextColorHover: '#EDE5D6',
      },
      Input: {
        color: '#322A1E',
        colorFocus: '#322A1E',
        border: '1px solid rgba(255,253,248,.16)',
        borderHover: '#8FB05A',
        borderFocus: '#8FB05A',
        textColor: '#EDE5D6',
        placeholderColor: '#948770',
      },
      Card: { colorEmbedded: '#2A2418', borderColor: 'rgba(255,253,248,.08)', color: '#2A2418' },
      DataTable: {
        tdColor: '#2A2418',
        thColor: '#2E2818',
        thTextColor: '#C4B8A0',
        tdTextColor: '#EDE5D6',
        borderColor: 'rgba(255,253,248,.08)',
      },
    },
  },
};

/* ============================================================
 * 6. 葡萄紫韵 —— 淡紫底 + 葡萄紫 + 玫瑰粉
 *    亮色：柔紫米白     暗色：深紫夜色
 * ============================================================ */
const grapePurpleTheme = {
  key: 'grape-purple',
  name: '葡萄紫韵',
  desc: '淡紫底色，葡萄玫粉',
  light: {
    swatches: ['#F4F0F8', '#8E4FAA', '#C66B8E', '#D8C0E4', '#E8C0D0'],
    cssVars: {
      '--bg': '#F4F0F8',
      '--ink': '#2F2438',
      '--ink2': '#4E3F5C',
      '--soft': '#7E6F8C',
      '--pop': '#8E4FAA',
      '--pop2': '#C66B8E',
      '--card': 'rgba(255,255,255,.75)',
      '--card-solid': '#FFFFFF',
      '--cream': '#E6DEEC',
      '--rule': '#C8B8D4',
      '--shadow': 'rgba(47,36,56,.12)',
      '--blob-1': 'rgba(142,79,170,.25)',
      '--blob-2': 'rgba(198,107,142,.25)',
      '--blob-3': 'rgba(216,192,228,.28)',
      '--blob-4': 'rgba(232,192,208,.28)',
      '--admin-sidebar': '#EAE2EE',
      '--admin-header': '#E8DFEC',
      '--admin-surface': '#F0EAF4',
      '--admin-input': '#FFFFFF',
      '--admin-input-border': '#C8B8D4',
      '--admin-table-head': '#E6DEEC',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.75)',
        cardColor: '#FFFFFF',
        modalColor: '#E6DEEC',
        popoverColor: '#FFFFFF',
        tableColor: 'rgba(255,255,255,.75)',
        tableHeaderColor: '#E6DEEC',
        dividerColor: '#C8B8D4',
        borderColor: '#C8B8D4',
        textColorBase: '#2F2438',
        textColor1: '#2F2438',
        textColor2: '#4E3F5C',
        textColor3: '#7E6F8C',
        primaryColor: '#8E4FAA',
        primaryColorHover: '#A05FBC',
        primaryColorPressed: '#7E4498',
        primaryColorSuppl: '#8E4FAA',
        infoColor: '#C66B8E',
        infoColorHover: '#D17C9C',
        successColor: '#5AAA8E',
        warningColor: '#D49A3A',
        errorColor: '#D8607A',
      },
      Layout: { siderColor: '#EAE2EE', headerColor: '#E8DFEC' },
      Menu: {
        itemColorHover: '#D8CCDE',
        itemColorActive: 'rgba(142,79,170,.18)',
        itemColorActiveCollapsed: 'rgba(142,79,170,.18)',
        itemTextColorActive: '#2F2438',
        itemTextColorHover: '#2F2438',
      },
      Input: {
        color: '#FFFFFF',
        colorFocus: '#FFFFFF',
        border: '1px solid #C8B8D4',
        borderHover: '#8E4FAA',
        borderFocus: '#8E4FAA',
      },
      Card: { colorEmbedded: 'rgba(255,255,255,.75)', borderColor: '#C8B8D4' },
      DataTable: {
        tdColor: 'rgba(255,255,255,.75)',
        thColor: '#E6DEEC',
        thTextColor: '#4E3F5C',
        tdTextColor: '#2F2438',
        borderColor: '#C8B8D4',
      },
    },
  },
  dark: {
    swatches: ['#161020', '#B870D4', '#D884A4', '#1E1828', '#241C30'],
    cssVars: {
      '--bg': '#161020',
      '--ink': '#EDE5F0',
      '--ink2': '#C0B4D0',
      '--soft': '#8A7E9A',
      '--pop': '#B870D4',
      '--pop2': '#D884A4',
      '--card': 'rgba(255,255,255,.04)',
      '--card-solid': '#241C30',
      '--cream': '#281F34',
      '--rule': 'rgba(255,255,255,.10)',
      '--shadow': 'rgba(0,0,0,.50)',
      '--blob-1': 'rgba(184,112,212,.15)',
      '--blob-2': 'rgba(216,132,164,.15)',
      '--blob-3': 'rgba(200,160,220,.10)',
      '--blob-4': 'rgba(220,160,180,.10)',
      '--admin-sidebar': '#1A1424',
      '--admin-header': '#1E1828',
      '--admin-surface': '#241C30',
      '--admin-input': '#2C2438',
      '--admin-input-border': 'rgba(255,255,255,.14)',
      '--admin-table-head': '#281F34',
    },
    naiveOverrides: {
      common: {
        bodyColor: 'rgba(255,255,255,.04)',
        cardColor: '#241C30',
        modalColor: '#281F34',
        popoverColor: '#2C2438',
        tableColor: '#241C30',
        tableHeaderColor: '#281F34',
        dividerColor: 'rgba(255,255,255,.10)',
        borderColor: 'rgba(255,255,255,.12)',
        textColorBase: '#EDE5F0',
        textColor1: '#EDE5F0',
        textColor2: '#C0B4D0',
        textColor3: '#8A7E9A',
        primaryColor: '#B870D4',
        primaryColorHover: '#C884E0',
        primaryColorPressed: '#A45EC0',
        primaryColorSuppl: '#B870D4',
        infoColor: '#D884A4',
        infoColorHover: '#E096B2',
        successColor: '#6BC4A0',
        warningColor: '#E0B060',
        errorColor: '#E8708A',
      },
      Layout: { siderColor: '#1A1424', headerColor: '#1E1828' },
      Menu: {
        itemColorHover: '#2C2438',
        itemColorActive: 'rgba(184,112,212,.20)',
        itemColorActiveCollapsed: 'rgba(184,112,212,.20)',
        itemTextColorActive: '#EDE5F0',
        itemTextColorHover: '#EDE5F0',
      },
      Input: {
        color: '#2C2438',
        colorFocus: '#2C2438',
        border: '1px solid rgba(255,255,255,.14)',
        borderHover: '#B870D4',
        borderFocus: '#B870D4',
        textColor: '#EDE5F0',
        placeholderColor: '#8A7E9A',
      },
      Card: { colorEmbedded: '#241C30', borderColor: 'rgba(255,255,255,.08)', color: '#241C30' },
      DataTable: {
        tdColor: '#241C30',
        thColor: '#281F34',
        thTextColor: '#C0B4D0',
        tdTextColor: '#EDE5F0',
        borderColor: 'rgba(255,255,255,.08)',
      },
    },
  },
};

/* ============================================================
 * 导出
 * ============================================================ */

/** 所有主题组（6 套，每套含亮/暗变体） */
export const THEME_GROUPS = [
  amberPineTheme,
  mintFreshTheme,
  sunsetOrangeTheme,
  deepSeaTheme,
  forestWoodTheme,
  grapePurpleTheme,
];

/**
 * 为每套预设补充配套的后台配色变量（方案C：默认与前台协调，可独立调整）
 * 前台已有的 6 个 --admin-* 保留预设值，其余从本套预设推导或取固定协调值
 */
function enrichAdminCssVars(group) {
  for (const mode of ['light', 'dark']) {
    const cssVars = { ...group[mode].cssVars };
    const isDark = mode === 'dark';
    const extra = {
      '--admin-accent': cssVars['--pop'],
      '--admin-accent-2': cssVars['--pop2'],
      '--admin-accent-3': isDark ? '#C8B8E8' : '#9B8FD0',
      '--admin-peach-dark': isDark ? '#D89868' : '#C87858',
      '--admin-on-accent': isDark ? '#1A1410' : '#FFFFFF',
      '--admin-text': cssVars['--ink'],
      '--admin-text-2': cssVars['--ink2'],
      '--admin-muted': cssVars['--soft'],
      '--admin-card': cssVars['--card-solid'],
      '--admin-card-solid': cssVars['--card-solid'],
      '--admin-border': cssVars['--rule'],
      '--admin-shadow': cssVars['--shadow'],
      '--admin-peach': cssVars['--cream'],
    };
    group[mode].cssVars = { ...cssVars, ...extra };
  }
}

// 导出前统一补充后台配色变量
THEME_GROUPS.forEach(enrichAdminCssVars);

/**
 * 为每套预设补充被细分项引用的缺失全局变量
 * 细分项（顶栏/Hero/统计卡/置顶/分类/书签/页脚）的默认色通过回退链引用这些变量，
 * 补入预设后取色器可精准显示预设配置色，无需运行时兜底
 * 取值与 tokens.css 当前默认一致，不改变现有渲染外观
 */
function enrichMissingGlobals(group) {
  for (const mode of ['light', 'dark']) {
    const cssVars = { ...group[mode].cssVars };
    const isDark = mode === 'dark';
    const extra = {
      // 主色（--pop）上的文字色
      '--on-pop': isDark ? '#1A1410' : '#FFFFFF',
      // 桃色 / 薄荷绿 / 玫瑰红点缀色
      '--peach': isDark ? '#C88860' : '#E8A088',
      '--mint': isDark ? '#6BB898' : '#7BB89A',
      '--rose': isDark ? '#D88878' : '#E8928C',
    };
    group[mode].cssVars = { ...cssVars, ...extra };
  }
}

// 导出前统一补充细分项引用的缺失全局变量
THEME_GROUPS.forEach(enrichMissingGlobals);

/** 默认主题 key */
export const DEFAULT_PRESET_KEY = 'amber-pine';

/**
 * 根据 key 和 mode 获取预设变体
 * 用户存储的是主题 key（如 'amber-pine'），根据当前亮/暗模式返回对应变体
 * @param {string} key - 主题 key
 * @param {'light'|'dark'} mode - 当前模式
 * @returns {{key:string, name:string, desc:string, swatches:string[], cssVars:Object, naiveOverrides:Object}}
 */
export function getPresetByKey(key, mode) {
  const group = THEME_GROUPS.find((g) => g.key === key) || THEME_GROUPS[0];
  const variant = group[mode === 'dark' ? 'dark' : 'light'];
  return {
    key: group.key,
    name: group.name,
    desc: group.desc,
    ...variant,
  };
}

/**
 * 根据 key 查找主题组
 * @param {string} key
 * @returns {ThemeGroup|undefined}
 */
export function findThemeGroup(key) {
  return THEME_GROUPS.find((g) => g.key === key);
}

/* ---------- 兼容导出（供旧代码过渡使用） ---------- */

/** 亮色预设列表（从主题组提取） */
export const LIGHT_PRESETS = THEME_GROUPS.map((g) => ({
  key: g.key,
  name: g.name,
  desc: g.desc,
  mode: 'light',
  ...g.light,
}));

/** 暗色预设列表（从主题组提取） */
export const DARK_PRESETS = THEME_GROUPS.map((g) => ({
  key: g.key,
  name: g.name,
  desc: g.desc,
  mode: 'dark',
  ...g.dark,
}));

/** 所有预设（亮+暗） */
export const ALL_PRESETS = [...LIGHT_PRESETS, ...DARK_PRESETS];

/** 兼容旧代码的默认预设 key 映射 */
export const DEFAULT_PRESET_KEYS = {
  light: DEFAULT_PRESET_KEY,
  dark: DEFAULT_PRESET_KEY,
};

/** 兼容旧代码的 findPreset */
export function findPreset(key) {
  const group = findThemeGroup(key);
  if (!group) return undefined;
  return { key: group.key, name: group.name, desc: group.desc, ...group.light };
}
