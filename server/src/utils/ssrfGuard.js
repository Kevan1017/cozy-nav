/**
 * SSRF 防护工具
 *
 * 供所有"服务器出站请求"（fetch-title、favicon 抓取等）统一校验目标主机，
 * 禁止访问内网/回环/链路本地/保留地址，防止服务器被当作跳板探测内网。
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

/** DNS 解析超时上限（毫秒）：超出视为无法解析，保守拒绝出站，避免慢域名长时间阻塞接口响应 */
const DNS_TIMEOUT = 1500;

/** 给 Promise 加超时（超时 reject；timer unref 避免定时器阻止进程退出） */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('DNS lookup timeout')), ms);
      if (timer.unref) timer.unref();
    }),
  ]);
}

/** 是否为内网/保留 IPv4 地址 */
function isInternalIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  if (a === 0) return true;                            // 0.0.0.0/8（本机）
  if (a === 10) return true;                           // 10.0.0.0/8（私有）
  if (a === 127) return true;                          // 127.0.0.0/8（回环）
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16（链路本地/云元数据）
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12（私有）
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16（私有）
  if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10（CGNAT）
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15（基准测试）
  if (a === 192 && b === 0) return true;               // 192.0.0.0/24、192.0.2.0/24（保留/文档）
  if (a >= 224) return true;                           // 224.0.0.0/4 起（组播/保留）
  return false;
}

/** 是否为内网/保留 IPv6 地址 */
function isInternalIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;  // 未指定 / 回环
  // IPv4 映射地址（::ffff:a.b.c.d）按内嵌 IPv4 判断
  const mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isInternalIPv4(mapped[1]);
  // fc00::/7（ULA）、fe80::/10（链路本地）、2001:db8::/32（文档）
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  if (lower.startsWith('2001:db8')) return true;
  return false;
}

/** 判断 IP 字符串是否为内网/保留地址（无法识别按内网处理，保守拒绝） */
export function isInternalIP(ip) {
  const version = isIP(ip);
  if (version === 4) return isInternalIPv4(ip);
  if (version === 6) return isInternalIPv6(ip);
  return true;
}

/**
 * 分类主机名可访问性（供检测类逻辑区分"解析失败"与"解析到内网"）
 * - IP 字面量：直接判断是否内网
 * - 域名：DNS 解析全部地址，任一为内网即拒绝；解析失败返回 unresolved（由上层决定处理）
 * @param {string} hostname 纯主机名（不含协议/端口/路径）
 * @returns {Promise<'public'|'internal'|'unresolved'>}
 *   public: 全部公网 IP，允许出站
 *   internal: 存在内网/保留 IP 或参数非法（保守拒绝）
 *   unresolved: 域名无法解析（NXDOMAIN 等），上层可判定为死链而非 SSRF
 */
export async function classifyHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return 'internal';
  // 去掉 IPv6 方括号
  const clean = hostname.replace(/^\[|\]$/g, '');
  if (!clean) return 'internal';

  // IP 字面量直接判断
  if (isIP(clean)) return isInternalIP(clean) ? 'internal' : 'public';

  // 域名：转 ASCII（兼容中文域名）后解析全部地址
  let ascii;
  try {
    ascii = domainToASCII(clean);
  } catch {
    return 'internal';
  }
  if (!ascii) return 'internal';
  if (isIP(ascii)) return isInternalIP(ascii) ? 'internal' : 'public';

  let records;
  try {
    records = await withTimeout(lookup(ascii, { all: true }), DNS_TIMEOUT);
  } catch {
    return 'unresolved'; // 解析失败/超时：域名不存在或 DNS 无响应，保守拒绝
  }
  if (!records || records.length === 0) return 'unresolved';
  return records.every((r) => !isInternalIP(r.address)) ? 'public' : 'internal';
}

/**
 * 判断主机名是否允许服务器出站访问（非内网）
 * 解析失败也拒绝（保守），安全类接口（fetch-title / favicon 抓取）继续使用本函数
 * @param {string} hostname 纯主机名（不含协议/端口/路径）
 * @returns {Promise<boolean>}
 */
export async function isPublicHostname(hostname) {
  return (await classifyHostname(hostname)) === 'public';
}
