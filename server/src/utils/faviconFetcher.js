/**
 * favicon 抓取核心模块
 *
 * 职责：
 *  - 多源回退抓取 favicon（DuckDuckGo → 站点直抓 → Google S2）
 *  - 多级缓存（内存 Map → 磁盘文件 → 远程抓取）
 *  - 失败短周期缓存（24h）避免重复请求
 *  - 定时清理过期失败记录（>7天）
 *  - 抓取成功后写文件 + 写路径到 links.favicon_path
 *
 * 目录结构：
 *  data/favicons/
 *  ├── {domainHash}.png      # 成功图标
 *  └── .failed/
 *      └── {domainHash}.json # 失败记录 { domain, failedAt }
 */
import { writeFile, readFile, mkdir, readdir, stat, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import db from '../db/index.js';
import { isPublicHostname } from './ssrfGuard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAVICON_DIR = join(__dirname, '../../data/favicons');
const FAILED_DIR = join(FAVICON_DIR, '.failed');

/** 失败缓存有效期（24 小时） */
const FAILED_TTL = 24 * 60 * 60 * 1000;
/** 过期失败记录清理阈值（7 天） */
const EXPIRED_THRESHOLD = 7 * 24 * 60 * 60 * 1000;
/** 单源抓取超时（3 秒，并行竞速模式下足够） */
const SOURCE_TIMEOUT = 3000;
/** 合法图标大小范围 */
const MIN_SIZE = 100;          // 100 字节（部分 favicon 体积很小）
const MAX_SIZE = 512 * 1024;  // 512KB

/** 内存缓存：domain -> { buffer, ext } */
const memCache = new Map();

// 模块加载时确保目录存在
await mkdir(FAILED_DIR, { recursive: true });

/* ----------------------------- 域名处理 ----------------------------- */

/**
 * 标准化域名：去 www. 前缀、转小写
 * @param {string} hostname
 * @returns {string}
 */
export function normalizeDomain(hostname) {
  if (!hostname) return '';
  let d = hostname.toLowerCase().trim();
  if (d.startsWith('www.')) d = d.slice(4);
  return d;
}

/**
 * 域名哈希：MD5 取前 16 位（作为文件名，避免特殊字符）
 * @param {string} domain
 * @returns {string}
 */
export function hashDomain(domain) {
  return createHash('md5').update(domain).digest('hex').slice(0, 16);
}

/**
 * 校验域名是否为可安全抓取的公网域名（SSRF 防护）
 * - 格式：必须为纯主机名（无协议/端口/路径/查询/用户信息）
 * - 禁止 IP 字面量（含内网与公网 IP），仅允许域名
 * - DNS 解析后所有地址必须为公网 IP（内网/解析失败均拒绝）
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function isValidPublicDomain(domain) {
  if (!domain || typeof domain !== 'string' || domain.length > 253) return false;

  let parsed;
  try {
    parsed = new URL(`http://${domain}`);
  } catch {
    return false;
  }
  // 拒绝：带端口/路径/查询/锚点/用户信息，或解析后主机名与入参不一致（含 @、/、\ 等分隔符绕过）
  if (
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.hostname !== domain
  ) {
    return false;
  }

  // 拒绝 IP 字面量直连（favicon 服务仅面向域名）
  if (isIP(parsed.hostname)) return false;

  return isPublicHostname(parsed.hostname);
}

/* ----------------------------- 失败记录 ----------------------------- */

/**
 * 检查域名是否在失败缓存期内（24h）
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function isRecentlyFailed(domain) {
  const filePath = join(FAILED_DIR, `${hashDomain(domain)}.json`);
  if (!existsSync(filePath)) return false;
  try {
    const st = await stat(filePath);
    return Date.now() - st.mtimeMs < FAILED_TTL;
  } catch {
    return false;
  }
}

/**
 * 标记域名为失败（写失败记录）
 * @param {string} domain
 */
export async function markAsFailed(domain) {
  const filePath = join(FAILED_DIR, `${hashDomain(domain)}.json`);
  try {
    await writeFile(filePath, JSON.stringify({ domain, failedAt: new Date().toISOString() }));
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [标记失败] [失败] ${err.message}`);
  }
}

/**
 * 清除域名的失败记录（抓取成功时调用）
 * @param {string} domain
 */
export async function clearFailedRecord(domain) {
  const filePath = join(FAILED_DIR, `${hashDomain(domain)}.json`);
  try {
    if (existsSync(filePath)) await unlink(filePath);
  } catch { /* 忽略 */ }
}

/* ----------------------------- 缓存读写 ----------------------------- */

/**
 * 获取缓存的 favicon（内存 → 磁盘）
 * @param {string} domain
 * @returns {Promise<Buffer|null>}
 */
export async function getCachedFavicon(domain) {
  // ① 内存缓存
  const mem = memCache.get(domain);
  if (mem) return mem.buffer;

  // ② 磁盘缓存
  const fileName = `${hashDomain(domain)}.png`;
  const filePath = join(FAVICON_DIR, fileName);
  if (!existsSync(filePath)) return null;

  try {
    const buffer = await readFile(filePath);
    memCache.set(domain, { buffer, ext: 'png' });
    return buffer;
  } catch {
    return null;
  }
}

/**
 * 保存 favicon 到缓存（内存 + 磁盘）
 * @param {string} domain
 * @param {Buffer} buffer
 * @param {string} ext 扩展名（默认 png）
 */
export async function saveToCache(domain, buffer, ext = 'png') {
  const fileName = `${hashDomain(domain)}.${ext}`;
  const filePath = join(FAVICON_DIR, fileName);
  try {
    await writeFile(filePath, buffer);
    memCache.set(domain, { buffer, ext });
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [写缓存] [失败] ${err.message}`);
  }
}

/* ----------------------------- 远程抓取 ----------------------------- */

/**
 * 校验 buffer 是否为合法图片格式
 * 支持 PNG / JPEG / ICO / GIF / WebP / SVG
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // ICO: 00 00 01 00
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  // SVG: 文本检测（<?xml 或 <svg）
  const head = buffer.slice(0, 200).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return true;

  return false;
}

/**
 * 单源抓取（带超时）
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
async function fetchOne(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cozy-nav-favicon/1.0)' },
      redirect: 'follow',
    });
    if (!resp.ok) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < MIN_SIZE || buffer.length > MAX_SIZE) return null;
    if (!isImageBuffer(buffer)) return null;

    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 抓取站点首页 HTML（仅前 64KB，5s 超时）。
 * 图标声明必然位于 <head> 内，读取前 64KB 足够，避免大页面占用带宽。
 * @param {string} domain
 * @returns {Promise<string|null>} HTML 文本或 null
 */
async function fetchHtmlHead(domain) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT);
  try {
    const resp = await fetch(`https://${domain}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cozy-nav-favicon/1.0)' },
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 4) return null;
    return buf.slice(0, 65536).toString('utf8');
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从 HTML 中提取 <link rel="icon"> 的 href。
 * 兼容 rel="icon" / rel="shortcut icon" / rel="mask-icon"，排除 apple-touch-icon（iOS 高清图标，尺寸过大）。
 * @param {string|null} html
 * @returns {string|null} 原始 href（未拼接），带 HTML 实体解码
 */
function extractIconHref(html) {
  if (!html) return null;
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (/apple-touch-icon/i.test(tag)) continue;
    if (!/rel\s*=\s*["']?[^"'>]*icon[^"'>]*/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    // HTML 实体解码（&amp; 等）
    return href
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  }
  return null;
}

/**
 * 将提取的 href 拼接为完整图标 URL，支持 5 种形态：
 * data:（内嵌）/ 协议相对 // / 绝对 http(s) / 根相对 / 普通相对
 * @param {string} domain
 * @param {string} href
 * @returns {string|null}
 */
function resolveIconUrl(domain, href) {
  if (!href) return null;
  const base = `https://${domain}/`;
  if (href.startsWith('data:')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `https://${domain}${href}`;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/**
 * 解码 data: URI 图标（base64），限制大小并校验魔数。
 * @param {string} dataUrl
 * @returns {Buffer|null}
 */
function decodeDataIcon(dataUrl) {
  try {
    if (!/^data:image\/[a-z+.-]+;base64,/i.test(dataUrl)) return null;
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < MIN_SIZE || buffer.length > MAX_SIZE) return null;
    if (!isImageBuffer(buffer)) return null;
    return buffer;
  } catch {
    return null;
  }
}

/**
 * 源站直抓增强：解析首页 <link rel="icon"> 获取真实图标路径，失败回退根路径 /favicon.ico。
 * 覆盖 SPA/框架站（无根目录 favicon.ico，但 HTML 声明图标路径）场景，提高源站直抓成功率。
 * @param {string} domain
 * @returns {Promise<Buffer|null>}
 */
async function fetchSiteIcon(domain) {
  // ① 抓首页 HTML（仅前 64KB）
  const html = await fetchHtmlHead(domain);
  const href = extractIconHref(html);

  // ② 无 <link rel="icon"> 声明 → 回退根路径 /favicon.ico
  if (!href) {
    return fetchOne(`https://${domain}/favicon.ico`);
  }

  // ③ 拼接完整 URL（5 种形态统一处理）
  const iconUrl = resolveIconUrl(domain, href);
  if (!iconUrl) {
    return fetchOne(`https://${domain}/favicon.ico`);
  }

  // ④ data: URI 直接解码校验
  if (iconUrl.startsWith('data:')) {
    return decodeDataIcon(iconUrl);
  }

  // ⑤ SSRF 防护：图标可能托管在 CDN，对提取出的 host 重新做公网校验
  try {
    const iconHost = new URL(iconUrl).hostname;
    if (!(await isValidPublicDomain(iconHost))) {
      console.log(`[${new Date().toISOString()}] [favicon] [源站解析] [拒绝] icon host=${iconHost} (非公网域名)`);
      return fetchOne(`https://${domain}/favicon.ico`);
    }
  } catch {
    return fetchOne(`https://${domain}/favicon.ico`);
  }

  return fetchOne(iconUrl);
}

/**
 * 多源并行竞速抓取 favicon
 * 同时请求所有源，取第一个成功返回的结果（被墙的源在后台超时不影响响应）
 * 源列表：cccyun（国内代理）→ DuckDuckGo → 站点直抓 → Google S2
 * @param {string} domain
 * @returns {Promise<Buffer|null>}
 */
export async function fetchFromSources(domain) {
  // SSRF 防护：仅允许公网域名，内网/非法域名直接放弃（所有远程抓取的统一兜底）
  if (!(await isValidPublicDomain(domain))) {
    console.log(`[${new Date().toISOString()}] [favicon] [远程抓取] [拒绝] domain=${domain} (非公网域名)`);
    return null;
  }

  // 各源统一为"返回 Buffer 的异步工厂"，并行竞速取第一个成功
  const fetchers = [
    () => fetchOne(`https://favicon.cccyun.cc/${domain}`),
    () => fetchOne(`https://icons.duckduckgo.com/ip3/${domain}.ico`),
    // 源站直抓增强：先解析首页 <link rel="icon">，失败回退根路径 /favicon.ico
    () => fetchSiteIcon(domain),
    () => fetchOne(`https://www.google.com/s2/favicons?sz=64&domain=${domain}`),
  ];

  try {
    const buffer = await Promise.any(
      fetchers.map(async (fn) => {
        const buf = await fn();
        if (!buf) throw new Error('源返回空');
        console.log(`[${new Date().toISOString()}] [favicon] [远程抓取] [成功] domain=${domain}`);
        return buf;
      })
    );
    return buffer;
  } catch {
    // 所有源都失败
    return null;
  }
}

/* ----------------------------- 手动抓取共用核心 ----------------------------- */

/**
 * favicon 抓取核心流程（按 URL / 按 ID 两个手动入口共用）
 * 清除失败记录 → 查缓存（内存→磁盘） → 未命中同步远程抓取 → 写缓存
 * @param {string} domain - 规范化后的公网域名（已通过 isValidPublicDomain 校验）
 * @returns {Promise<string>} 成功返回 favicon 文件名（hashDomain.png），失败返回 ''
 */
export async function fetchFaviconByDomain(domain) {
  // 清除失败记录，允许重新尝试
  await clearFailedRecord(domain);

  // 查缓存（内存 → 磁盘）
  let buffer = await getCachedFavicon(domain);

  // 缓存未命中 → 远程抓取
  if (!buffer) {
    buffer = await fetchFromSources(domain);
    if (!buffer) {
      await markAsFailed(domain);
      return '';
    }
    await saveToCache(domain, buffer, 'png');
  }

  return `${hashDomain(domain)}.png`;
}

/**
 * 异步抓取 favicon 并写路径到库（不阻塞接口响应）
 * 同时写入 favicon_status：'ok'=成功 / 'fail'=失败，供后台图标列展示状态
 * @param {string} url 书签 URL
 * @param {number} linkId 书签 ID
 */
export async function fetchFaviconAsync(url, linkId) {
  try {
    const domain = normalizeDomain(new URL(url).hostname);
    if (!domain) return;

    // ① 检查失败缓存（24h 内跳过，视为本次获取失败）
    if (await isRecentlyFailed(domain)) {
      console.log(`[${new Date().toISOString()}] [favicon] [抓取] [跳过] domain=${domain} (近期失败)`);
      db.prepare('UPDATE links SET favicon_status = ? WHERE id = ?').run('fail', linkId);
      return;
    }

    // ② 检查缓存（内存 → 磁盘）
    let buffer = await getCachedFavicon(domain);

    // ③ 缓存未命中 → 远程抓取
    if (!buffer) {
      buffer = await fetchFromSources(domain);
      if (!buffer) {
        await markAsFailed(domain);
        db.prepare('UPDATE links SET favicon_status = ? WHERE id = ?').run('fail', linkId);
        console.log(`[${new Date().toISOString()}] [favicon] [抓取] [失败] domain=${domain}`);
        return;
      }
      // 写缓存
      await saveToCache(domain, buffer, 'png');
    }

    // ④ 写路径到数据库 + 标记成功
    const fileName = `${hashDomain(domain)}.png`;
    db.prepare('UPDATE links SET favicon_path = ?, favicon_status = ? WHERE id = ?').run(fileName, 'ok', linkId);

    // ⑤ 清除失败记录（如果之前有）
    await clearFailedRecord(domain);

    console.log(`[${new Date().toISOString()}] [favicon] [抓取] [成功] domain=${domain} linkId=${linkId}`);
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [抓取] [异常] ${url} ${err.message}`);
  }
}

/* ----------------------------- 定时清理 ----------------------------- */

/**
 * 清理过期失败记录（mtime > 7 天）
 */
export async function cleanExpiredFailedRecords() {
  try {
    const files = await readdir(FAILED_DIR);
    const now = Date.now();
    let cleaned = 0;

    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const filePath = join(FAILED_DIR, f);
      try {
        const st = await stat(filePath);
        if (now - st.mtimeMs > EXPIRED_THRESHOLD) {
          await unlink(filePath);
          cleaned++;
        }
      } catch { /* 忽略单个文件错误 */ }
    }

    if (cleaned > 0) {
      console.log(`[${new Date().toISOString()}] [favicon] [清理] [成功] 删除 ${cleaned} 条过期失败记录`);
    }
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [favicon] [清理] [失败] ${err.message}`);
  }
}

/* ----------------------------- 兜底 API 辅助 ----------------------------- */

/**
 * 获取 favicon 文件路径（供 controller 使用）
 * @param {string} domain
 * @returns {string|null}
 */
export function getFaviconFilePath(domain) {
  const fileName = `${hashDomain(domain)}.png`;
  const filePath = join(FAVICON_DIR, fileName);
  return existsSync(filePath) ? filePath : null;
}

export { FAVICON_DIR, FAILED_DIR };
