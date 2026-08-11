// TLS 证书读取需要原生 https 模块（undici fetch 不暴露 peer certificate）
import https from 'node:https';
// SSRF 防护：禁止服务器出站访问内网/回环/保留地址
import { classifyHostname } from './ssrfGuard.js';

/**
 * 链接可用性检测工具
 * 策略（无代理 + DoH 判定，适配国内公网服务器场景）：
 *   ① 直连 HEAD 请求（5s 超时，带浏览器 UA）
 *       成功（任意 HTTP 响应）→ ok
 *   ② 直连失败时二次确认（再测一轮直连）：
 *       偶发抖动导致的超时/错误会在重试后恢复 → ok
 *   ③ 二次确认仍失败 + IP 直连链接 → fail（无法 DoH）
 *   ④ 二次确认仍失败 + 域名链接 → DoH 加密 DNS 解析辅助判定：
 *       DoH 能解析出真实 IP（域名活着）→ blocked（疑似被墙）
 *       DoH 返回 NXDOMAIN（域名不存在）→ fail（真挂了）
 *       DoH 全部源不可达 → fail（本地网络不可达，无法验证域名）
 */

// 直连超时（毫秒）
const DIRECT_TIMEOUT = 5000;
// DoH 查询单源超时（毫秒）
const DOH_TIMEOUT = 3000;
// 浏览器 UA（部分站点屏蔽无 UA 请求）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// DoH 源（按国内可达性排序；doh.pub 为腾讯 DNSPod、223.5.5.5 为阿里公共 DNS，均支持 Google 风格 JSON 接口）
const DOH_SOURCES = [
  { build: (h) => `https://doh.pub/dns-query?name=${h}&type=A`, label: '腾讯' },
  { build: (h) => `https://223.5.5.5/resolve?name=${h}&type=A`, label: '阿里' },
  { build: (h) => `https://dns.google/resolve?name=${h}&type=A`, label: 'Google' },
];

/** 直连检测：HEAD 请求，失败时降级 GET 重试一次 */
async function directCheck(url) {
  const started = Date.now();

  const tryRequest = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': UA, Accept: '*/*' },
      });
      clearTimeout(timer);
      return { ok: true, httpCode: res.status, ms: Date.now() - started };
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, err };
    }
  };

  let result = await tryRequest('HEAD');
  // 仅非超时错误（如快速连接拒绝）时用 GET 再试一次；
  // 超时说明网络确实不通，重试只会翻倍耗时
  const isTimeout = result.err?.name === 'AbortError'
    || result.err?.cause?.code === 'ETIMEDOUT'
    || result.err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
  if (!result.ok && !isTimeout) {
    result = await tryRequest('GET');
  }
  if (result.ok) {
    return { ok: true, httpCode: result.httpCode, ms: result.ms };
  }

  return { ok: false, note: describeNetworkError(result.err) };
}

/** 把网络错误码转成可读的中文诊断信息 */
function describeNetworkError(err) {
  const code = err?.cause?.code || err?.code || err?.name || 'UNKNOWN';
  switch (code) {
    case 'ENOTFOUND': return 'DNS 解析失败';
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT': return '连接超时';
    case 'AbortError': return '请求超时';
    case 'ECONNREFUSED': return '连接被拒绝';
    case 'ECONNRESET': return '连接被重置';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH': return '网络不可达';
    case 'CERT_HAS_EXPIRED': return 'TLS 证书已过期';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT': return 'TLS 证书无效（可能为自签名）';
    case 'EPROTO': return 'TLS 握手失败';
    default: return `网络异常（${code}）`;
  }
}

/**
 * DoH 加密 DNS 解析：确认域名是否仍存活
 * @returns {boolean|null} true=域名活着（有 A/AAAA/CNAME 记录）· false=域名不存在（NXDOMAIN）· null=无法判定
 */
async function resolveViaDoh(host) {
  for (const src of DOH_SOURCES) {
    try {
      const res = await fetch(src.build(host), {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(DOH_TIMEOUT),
      });
      if (!res.ok) continue;
      const data = await res.json();
      // Status：0=NOERROR · 3=NXDOMAIN
      if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length) {
        return true;
      }
      if (data.Status === 3) {
        return false;
      }
      // 其他状态码（ServFail 等）视为该源失败，继续换源
    } catch { /* 网络错误/超时，换下一个源 */ }
  }
  return null;
}

/** 判断 hostname 是否为 IP（IP 直连无法走 DoH 判定） */
function isIpAddress(host) {
  if (host.includes(':')) return true; // IPv6
  const parts = host.split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p));
}

/**
 * TLS 证书到期日读取：HTTPS 握手后取 peer 证书 valid_to
 * 注：undici 的 fetch 不暴露 peer certificate，故用原生 https 模块单独请求一次
 * @param {string} url - 完整 https 链接
 * @returns {Promise<string|null>} ISO 日期字符串；失败/非 TLS 返回 null
 */
function getTlsExpiry(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    const req = https.get(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      timeout: DIRECT_TIMEOUT,
    }, (res) => {
      res.resume(); // 不下载正文，立即释放连接
      try {
        const cert = res.socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const d = new Date(cert.valid_to);
          done(isNaN(d.getTime()) ? null : d.toISOString());
        } else {
          done(null);
        }
      } catch { done(null); }
    });
    req.on('error', () => done(null));
    req.on('timeout', () => { req.destroy(); done(null); });
  });
}

/**
 * 检测单个链接可用性
 * @param {string} url - 完整链接（http/https）
 * @returns {Promise<{status:string, httpCode:number|null, ms:number, note:string, tlsExpiresAt:string|null}>}
 *   status: ok 正常 / blocked 疑似被墙 / fail 打不开 / skip 跳过
 */
export async function checkLinkHealth(url) {
  const started = Date.now();

  // 1. 协议校验
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'skip', httpCode: null, ms: 0, note: 'URL 格式非法', tlsExpiresAt: null };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { status: 'skip', httpCode: null, ms: Date.now() - started, note: '非 HTTP(S) 链接，跳过检测', tlsExpiresAt: null };
  }

  // 2. SSRF 收敛：解析到内网/回环/保留地址一律跳过；域名无法解析（NXDOMAIN）不拦截，交由 DoH 判死
  const hostCls = await classifyHostname(parsed.hostname);
  if (hostCls === 'internal') {
    return { status: 'skip', httpCode: null, ms: Date.now() - started, note: '内网地址，跳过检测', tlsExpiresAt: null };
  }

  // 3. 直连检测（失败时二次确认，过滤偶发抖动导致的误判）
  let direct = await directCheck(url);
  if (!direct.ok) {
    direct = await directCheck(url);
  }
  if (direct.ok) {
    // HTTPS 链接额外读取证书到期日（供 TLS 到期告警）
    const tlsExpiresAt = parsed.protocol === 'https:' ? await getTlsExpiry(url) : null;
    return { status: 'ok', httpCode: direct.httpCode, ms: direct.ms, note: direct.httpCode >= 400 ? `HTTP ${direct.httpCode}（站点可达但页面异常）` : '', tlsExpiresAt };
  }

  // 4. IP 直连链接无法 DoH，直接判定失败
  if (isIpAddress(parsed.hostname)) {
    return { status: 'fail', httpCode: null, ms: Date.now() - started, note: `${direct.note}（IP 直连不可达）`, tlsExpiresAt: null };
  }

  // 5. DoH 辅助判定域名是否存活
  const doh = await resolveViaDoh(parsed.hostname);
  if (doh === true) {
    return { status: 'blocked', httpCode: null, ms: Date.now() - started, note: `${direct.note}，域名仍可解析，疑似被墙`, tlsExpiresAt: null };
  }
  if (doh === false) {
    return { status: 'fail', httpCode: null, ms: Date.now() - started, note: '域名无法解析（NXDOMAIN），可能已失效', tlsExpiresAt: null };
  }
  return { status: 'fail', httpCode: null, ms: Date.now() - started, note: `${direct.note}，且无法验证域名是否存活`, tlsExpiresAt: null };
}
