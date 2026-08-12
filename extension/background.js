/* 右键菜单收藏（#44）：在任意网页/链接上右键 → 收藏到悦行
 * 菜单结构：父菜单「收藏到悦行」+ 每个分类一个子菜单
 * - 点击子菜单 → 直接收藏到该分类（一步完成）
 * - 点击父菜单标题 → 收藏到最近使用的分类（兜底）
 * 每次右键显示前（onShown）动态刷新分类列表，后台增删分类即时生效
 */
importScripts('common.js');

const MENU_ID = 'cnav-save-link';
const MENU_PREFIX = 'cnav-save-';

/** 构建右键菜单：父菜单 + 每个分类一个子菜单（id 格式 cnav-save-<分类id>） */
async function buildMenu() {
  let list = [];
  try {
    // 未配置服务器 / 未登录时接口会返回错误，此时只保留父菜单即可
    const res = await CNAV.api('/api/categories');
    list = res.ok ? res.data || [] : [];
  } catch { /* 忽略，仅建父菜单 */ }
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '收藏到 悦行',
      contexts: ['page', 'link'],
    });
    list.forEach((c) => {
      chrome.contextMenus.create({
        id: MENU_PREFIX + c.id,
        parentId: MENU_ID,
        title: `${c.emoji || '📎'} ${c.name}`,
        contexts: ['page', 'link'],
      });
    });
  });
}

// 安装 / 升级时构建菜单（removeAll 幂等，重载扩展不会重复）
chrome.runtime.onInstalled.addListener(() => { buildMenu(); });
// 浏览器启动时构建（兜底，确保菜单存在）
chrome.runtime.onStartup.addListener(() => { buildMenu(); });

// 每次右键菜单显示前刷新分类列表（Chrome 110+），让新增/修改分类即时出现
if (chrome.contextMenus.onShown) {
  chrome.contextMenus.onShown.addListener(async () => {
    await buildMenu();
    chrome.contextMenus.refresh();
  });
}

/** 点击菜单：子菜单返回对应分类 ID，父菜单返回 null（用最近分类） */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 右键的是链接则收藏该链接，否则收藏当前页面
  const targetUrl = info.linkUrl || (tab ? tab.url : '');
  const title = tab ? tab.title : '';
  await saveToCozyNav(targetUrl, title, parseCategoryId(info.menuItemId));
});

/** 从菜单 id 解析分类 ID（子菜单格式 cnav-save-<id>；父菜单返回 null） */
function parseCategoryId(menuId) {
  if (typeof menuId === 'string' && menuId.startsWith(MENU_PREFIX)) {
    const id = Number(menuId.slice(MENU_PREFIX.length));
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

/** 系统通知（成功/失败/引导配置） */
function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

/**
 * 核心收藏逻辑（与 popup 共用同一套 API 封装）
 * @param {string} url - 要收藏的地址
 * @param {string} title - 书签名称（通常取页面标题）
 * @param {number|null} categoryId - 指定分类 ID；为空时用最近使用的分类，否则取第一个
 */
async function saveToCozyNav(url, title, categoryId) {
  // 1. 校验地址：仅 http/https 网页可收藏
  if (!url || !/^https?:\/\//.test(url)) {
    return notify('收藏失败', '当前不是可收藏的网页（仅支持 http/https）');
  }

  // 2. 配置检查：服务器地址 + 登录状态
  const serverUrl = await CNAV.getServerUrl();
  if (!serverUrl) {
    return notify('请先配置服务器', '点击扩展图标，在弹窗中填写服务器地址并登录一次');
  }
  const token = await CNAV.getToken();
  if (!token) {
    return notify('尚未登录', '点击扩展图标，在弹窗中登录一次即可使用');
  }

  // 3. 解析目标分类：指定分类 → 最近使用 → 第一个
  const cats = await CNAV.api('/api/categories');
  if (!cats.ok) return notify('获取分类失败', cats.message || '请确认服务器可用');
  const list = cats.data || [];
  if (!list.length) return notify('暂无分类', '请先在管理后台创建一个分类');
  let targetId = categoryId;
  if (!targetId) {
    targetId = await CNAV.getLastCategoryId();
    if (!list.some((c) => c.id === targetId)) targetId = list[0].id;
  }
  const cat = list.find((c) => c.id === targetId);
  if (!cat) return notify('收藏失败', '所选分类不存在，请在弹窗中重新选择');

  // 4. 创建书签（名称取页面标题，收藏后可在后台修改）
  const res = await CNAV.api('/api/links', {
    method: 'POST',
    body: { category_id: targetId, name: title || url, url },
  });

  if (res.ok) {
    await CNAV.saveLastCategoryId(targetId);
    notify('收藏成功', `已保存到「${cat.name}」`);
  } else if (res.code === 409) {
    notify('已收藏过', '该地址已存在于书签中，无需重复添加');
  } else {
    notify('收藏失败', res.message || '未知错误');
  }
}
