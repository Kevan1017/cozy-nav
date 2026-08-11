/* 右键菜单收藏（#44）：在任意网页/链接上右键 → 收藏到 cozy·nav */
importScripts('common.js');

const MENU_ID = 'cnav-save-link';

/** 安装时创建右键菜单（removeAll 幂等，重载扩展不会重复） */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '收藏到 悦行',
      contexts: ['page', 'link'],
    });
  });
});

/** 点击右键菜单 → 拿目标地址和页面标题，一键收藏 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 右键的是链接则收藏该链接，否则收藏当前页面
  const targetUrl = info.linkUrl || (tab ? tab.url : '');
  const title = tab ? tab.title : '';
  await saveToCozyNav(targetUrl, title);
});

/** 系统通知（成功/失败/引导配置） */
function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

/** 核心收藏逻辑（与 popup 共用同一套 API 封装） */
async function saveToCozyNav(url, title) {
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

  // 3. 选择分类：优先最近使用的分类，否则取第一个
  const cats = await CNAV.api('/api/categories');
  if (!cats.ok) return notify('获取分类失败', cats.message || '请确认服务器可用');
  const list = cats.data || [];
  if (!list.length) return notify('暂无分类', '请先在管理后台创建一个分类');
  let categoryId = await CNAV.getLastCategoryId();
  if (!list.some((c) => c.id === categoryId)) categoryId = list[0].id;

  // 4. 创建书签（名称取页面标题，收藏后可在后台修改）
  const res = await CNAV.api('/api/links', {
    method: 'POST',
    body: { category_id: categoryId, name: title || url, url },
  });

  if (res.ok) {
    await CNAV.saveLastCategoryId(categoryId);
    const catName = list.find((c) => c.id === categoryId)?.name || '';
    notify('收藏成功', `已保存到「${catName}」`);
  } else if (res.code === 409) {
    notify('已收藏过', '该地址已存在于书签中，无需重复添加');
  } else {
    notify('收藏失败', res.message || '未知错误');
  }
}
