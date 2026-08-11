import request from './request.js';

/**
 * 通用下载：请求文件流并触发浏览器下载
 * 统一走 request 封装（10s 超时 + Token 注入 + 统一错误处理）
 * @param {string} url - 接口路径（相对 /api）
 * @param {string} filename - 下载文件名
 */
async function downloadFile(url, filename) {
  const blob = await request({
    url,
    method: 'GET',
    responseType: 'blob',
  });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * 导出 JSON 格式数据
 */
export function exportJSON() {
  return downloadFile('/export/json', `cozy-nav-export-${new Date().toISOString().split('T')[0]}.json`);
}

/**
 * 导出浏览器书签 HTML 格式
 */
export function exportBookmarks() {
  return downloadFile('/export/bookmarks', `cozy-nav-bookmarks-${new Date().toISOString().split('T')[0]}.html`);
}

/**
 * 导入 JSON 数据
 */
export async function importJSON(data, strategy = 'skip') {
  return request({
    url: '/import/json',
    method: 'POST',
    data: {
      ...data,
      strategy,
    },
  });
}

/**
 * 导入浏览器书签 HTML
 */
export async function importBookmarks(html, strategy = 'skip') {
  return request({
    url: '/import/bookmarks',
    method: 'POST',
    data: {
      html,
      strategy,
    },
  });
}