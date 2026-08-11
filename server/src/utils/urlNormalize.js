/**
 * URL 规范化工具
 * 将 URL 归一化为稳定指纹，用于书签重复检测
 *
 * 处理规则（按顺序）：
 *   1. 仅处理 http/https 协议，其他协议返回 null（跳过判重）
 *   2. 协议统一小写（http 与 https 视为不同站，保守不合并）
 *   3. hostname 统一小写
 *   4. 去除默认端口（http:80 / https:443）
 *   5. 路径去除尾部斜杠
 *   6. 去除默认首页（index.html / default.asp 等）
 *   7. 查询参数按键字典序排序（顺序不影响判定）
 *   8. 去除锚点
 *   9. 去除常见跟踪参数（utm_* / fbclid / gclid 等）
 *
 * 明确不处理：路径大小写、www 前缀、IDN 转码
 *   （www.x.com 与 x.com 可能是不同站，避免误判）
 */

// 常见跟踪/来源标记参数（键名小写匹配，全部剔除）
const TRACKING_KEYS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_campaignid', 'utm_brand', 'utm_viz_id',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'yclid', 'ttclid', 'twclid',
  'spm', 'spm_id_from', 'from', 'from_source', 'from_sid', 'from_tool',
  'bd_source', 'bd_query', 'bd_ts', 'bd_rs',
]);

// 默认首页文件名（匹配则去掉，视为根路径）
const DEFAULT_INDEX_RE = /^\/(?:index|default|home|main)\.(?:html?|php|aspx?|jsp)(?:\/.*)?$/i;

/**
 * 规范化 URL
 * @param {string} url 原始 URL
 * @returns {string|null} 规范化后的指纹；无法解析或非 http/https 时返回 null
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  // 仅 http/https 参与判重，其余协议（javascript: / mailto: 等）跳过
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const protocol = parsed.protocol; // URL 构造后协议已小写
  const hostname = parsed.hostname.toLowerCase();

  // 去除默认端口
  let port = '';
  const isDefaultPort = (protocol === 'http:' && (!parsed.port || parsed.port === '80'))
    || (protocol === 'https:' && (!parsed.port || parsed.port === '443'));
  if (!isDefaultPort) port = `:${parsed.port}`;

  // 路径：去尾部斜杠 → 去默认首页
  let pathname = parsed.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  pathname = pathname.replace(DEFAULT_INDEX_RE, '');
  if (pathname === '') pathname = '/';

  // 查询参数：剔除跟踪参数后按键排序
  const params = parsed.searchParams;
  [...params.keys()].forEach((key) => {
    if (TRACKING_KEYS.has(key.toLowerCase())) params.delete(key);
  });
  params.sort(); // URLSearchParams 支持 sort()，按 key 字典序
  const search = params.toString() ? `?${params.toString()}` : '';

  // 锚点由 URL 构造时不会进入 searchParams，parsed.hash 直接忽略即可

  return `${protocol}//${hostname}${port}${pathname}${search}`;
}
