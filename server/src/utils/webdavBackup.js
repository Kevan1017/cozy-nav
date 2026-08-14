/**
 * 坚果云 WebDAV 云端备份工具
 * 将本地备份快照上传到坚果云 WebDAV（https://dav.jianguoyun.com/dav/），
 * 实现「本地 + 云端」双保险。
 * - 零依赖：仅用 Node 18+ 内置 fetch（WebDAV 的 MKCOL/PUT/PROPFIND/DELETE）
 * - 认证：坚果云账号 + 应用密码（Basic Auth，密码仅存 preferences 配置）
 * - 远端目录结构：<远程路径>/<backup-时间戳>/（与本地快照一一对应，目录内递归上传）
 * - 按保留份数清理远端旧快照（与本地 retainCount 一致，节省坚果云流量）
 * - 所有失败只记日志并返回结果，绝不抛错影响本地备份主流程
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 请求超时（ms）：目录/小请求 10s，文件上传 60s */
const TIMEOUT_SMALL = 10000;
const TIMEOUT_UPLOAD = 60000;
/** WebDAV 成功状态码集合（不同服务器返回 200/201/204 不一） */
const OK_STATUS = new Set([200, 201, 204]);

/** Basic Auth 头（坚果云账号 + 应用密码） */
function authHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

/** 归一化 WebDAV 根地址：去尾部斜杠（https://dav.jianguoyun.com/dav/ → https://dav.jianguoyun.com/dav） */
function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** 组装远端 URL：根 + 远程路径 + 快照名 + 相对路径（统一正斜杠拼接） */
function remoteUrl(base, webdavPath, snapName, rel = '') {
  return [base, webdavPath, snapName, rel]
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .join('/');
}

/** 创建目录：MKCOL（已存在时返回 301/405/409，视为成功） */
async function mkcol(url, headers) {
  const res = await fetch(url, {
    method: 'MKCOL',
    headers,
    signal: AbortSignal.timeout(TIMEOUT_SMALL),
  });
  return OK_STATUS.has(res.status) || [301, 405, 409].includes(res.status);
}

/** PROPFIND 列出远程目录下的 backup-* 子目录名（按 href 提取，失败返回 null） */
async function listRemoteSnapshots(dirUrl, headers) {
  // 注意：坚果云等 WebDAV 服务器要求 PROPFIND 携带标准 propfind 请求体，
  // 且目录 URL 需带尾斜杠，否则可能拿不到子项 href，导致云端清理失效
  const dir = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;
  const res = await fetch(dir, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: '1', 'Content-Type': 'application/xml' },
    body: '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>',
    signal: AbortSignal.timeout(TIMEOUT_SMALL),
  });
  if (!res.ok && res.status !== 207) {
    console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [PROPFIND] 失败 HTTP ${res.status}，跳过云端清理`);
    return null;
  }
  const xml = await res.text();
  // 兼容不同 WebDAV 服务器的命名空间前缀（<d:href> / <D:href> / <href> / <DAV:href>）
  const hrefs = [...xml.matchAll(/<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/g)].map((m) => m[1]);
  const names = hrefs
    .map((h) => decodeURIComponent(h).split('/').filter(Boolean).pop() || '')
    .filter((n) => n.startsWith('backup-'));
  if (names.length === 0) {
    const preview = xml.replace(/\s+/g, ' ').slice(0, 400);
    console.log(
      `[${new Date().toISOString()}] [备份] [WebDAV] [PROPFIND] 未解析到 backup-* 快照（HTTP ${res.status}，href ${hrefs.length} 个，响应: ${preview}）`
    );
  }
  return names;
}

/** 删除远端目录（DELETE 递归删除，404 视为已删除） */
async function deleteRemote(url, headers) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    signal: AbortSignal.timeout(TIMEOUT_SMALL),
  });
  return OK_STATUS.has(res.status) || res.status === 404;
}

/** 常见状态码 → 中文提示 */
function statusMessage(status) {
  if (status === 401 || status === 403) return '认证失败：请检查账号或应用密码';
  if (status === 404) return '路径不存在：请检查 WebDAV 地址或远程目录';
  if (status === 405) return '服务器不支持该操作（请确认是 WebDAV 地址）';
  if (status === 409) return '目录冲突：请更换远程目录名';
  if (status === 507) return '存储空间不足';
  return `HTTP ${status}`;
}

/** PROPFIND 请求体（allprop） */
const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>';

/** 归一化 href：去掉尾部斜杠，便于比较 */
const normHref = (h) => h.replace(/\/+$/, '');

/** PROPFIND 请求，返回 { ok, xml, status }；失败 ok=false */
async function propfindText(dirUrl, headers, depth = '1') {
  const dir = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;
  const res = await fetch(dir, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: depth, 'Content-Type': 'application/xml' },
    body: PROPFIND_BODY,
    signal: AbortSignal.timeout(TIMEOUT_SMALL),
  });
  if (!res.ok && res.status !== 207) {
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status, xml: await res.text() };
}

/** 解析 multistatus XML → [{href, path, name, size, isCollection}]（兼容不同命名空间前缀） */
function parseMultistatus(xml) {
  const blocks = [];
  const blockRe = /<(?:\w+:)?response>([\s\S]*?)<\/(?:\w+:)?response>/g;
  let m;
  while ((m = blockRe.exec(xml))) {
    const block = m[1];
    const href = block.match(/<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/)?.[1] || '';
    if (!href) continue;
    const path = decodeURIComponent(href).split('/').filter(Boolean).join('/');
    const sizeMatch = block.match(/<(?:\w+:)?getcontentlength>([^<]+)<\/(?:\w+:)?getcontentlength>/);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : null;
    blocks.push({
      href: normHref(href),
      path,
      name: path.split('/').pop() || '',
      size: Number.isFinite(size) && size > 0 ? size : null,
      isCollection: /<(?:\w+:)?collection\s*\/?>/.test(block),
    });
  }
  return blocks;
}

/**
 * 列出坚果云 WebDAV 上的备份快照（backup-* 目录名，按时间倒序）
 * 只列名称不做大小统计：坚果云目录不返回大小，逐层下钻会触发限流（BlockedTemporarily）
 * @param {object} cfg - {url, user, pass, path}
 * @returns {Promise<{ok:boolean, names?:string[], reason?:string}>}
 */
export async function listWebdavBackups({ url, user, pass, path = '' } = {}) {
  const base = normalizeBase(url);
  if (!base || !user || !pass) return { ok: false, reason: 'WebDAV 配置不完整' };
  const headers = { Authorization: authHeader(user, pass) };
  try {
    const r = await propfindText(remoteUrl(base, path), headers, '1');
    if (!r.ok) {
      // 区分限流与其他失败，便于前端给出明确提示
      const reason = r.status === 503 ? '坚果云接口繁忙（限流），请稍后刷新重试' : `坚果云接口异常（HTTP ${r.status}）`;
      console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [列表] 获取云端记录失败：${reason}`);
      return { ok: false, reason };
    }
    const names = parseMultistatus(r.xml)
      .filter((b) => b.name.startsWith('backup-'))
      .map((b) => b.name)
      .sort()
      .reverse();
    return { ok: true, names };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * 上传本地备份快照到 WebDAV（含远端旧快照清理）
 * @param {object} opts
 * @param {string} opts.dir    - 本地快照目录（runLocalBackup 返回的 dir）
 * @param {string} opts.snap   - 快照名（backup-YYYYMMDD-HHmmss-FFF）
 * @param {object} opts.config - {url, user, pass, path}
 * @param {number} opts.retainCount - 远端保留份数（超出删除最旧）
 * @param {string[]} opts.excludeDirs - 跳过的子目录（如 favicons 可再生缓存，省流量）
 * @returns {Promise<{ok:boolean, reason?:string, uploaded?:number, skipped?:number}>}
 */
export async function uploadBackupToWebDAV({ dir, snap, config, retainCount = 3, excludeDirs = [] }) {
  const base = normalizeBase(config?.url);
  const { user, pass, path = '' } = config || {};
  if (!base || !user || !pass) return { ok: false, reason: 'WebDAV 配置不完整' };
  if (!dir || !snap) return { ok: false, reason: '缺少本地快照信息' };
  const headers = { Authorization: authHeader(user, pass) };

  try {
    const baseDirUrl = remoteUrl(base, path);
    const snapDirUrl = remoteUrl(base, path, snap);

    // 1. 创建远程目录（根目录可能已存在，失败不致命；快照目录失败则中断）
    await mkcol(baseDirUrl, headers).catch(() => false);
    if (!(await mkcol(snapDirUrl, headers))) {
      return { ok: false, reason: `创建远端目录失败：${statusMessage(404)}` };
    }

    // 2. 递归上传快照目录下文件（保持目录结构；excludeDirs 内的可再生目录跳过）
    let uploaded = 0;
    let skipped = 0;
    const walk = async (localDir, remoteDir) => {
      for (const entry of readdirSync(localDir)) {
        const lp = join(localDir, entry);
        const rp = `${remoteDir}/${entry}`;
        const st = statSync(lp);
        if (st.isDirectory()) {
          if (excludeDirs.includes(entry)) {
            skipped++;
            continue;
          }
          await mkcol(rp, headers);
          await walk(lp, rp);
        } else {
          const body = readFileSync(lp);
          const res = await fetch(rp, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/octet-stream' },
            body,
            signal: AbortSignal.timeout(TIMEOUT_UPLOAD),
          });
          if (!OK_STATUS.has(res.status)) {
            throw new Error(`上传 ${entry} 失败：${statusMessage(res.status)}`);
          }
          uploaded++;
        }
      }
    };
    await walk(dir, snapDirUrl);

    // 3. 清理远端旧快照（保留 retainCount 份）
    const list = await listRemoteSnapshots(baseDirUrl, headers);
    if (list) {
      const toDelete = list.sort().reverse().slice(retainCount);
      console.log(
        `[${new Date().toISOString()}] [备份] [WebDAV] [清理] 远端快照 ${list.length} 个，保留 ${retainCount} 份，待删 ${toDelete.length} 个`
      );
      for (const name of toDelete) {
        if (name === snap) continue; // 绝不删除本次快照
        const ok = await deleteRemote(remoteUrl(base, path, name), headers);
        if (ok) {
          console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [清理] 已删除远端旧快照 ${name}`);
        } else {
          console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [清理] 删除失败：${name}（DELETE 未返回 2xx/404）`);
        }
      }
    } else {
      console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [清理] 未获取到远端快照列表（PROPFIND 失败），本次跳过清理`);
    }

    console.log(
      `[${new Date().toISOString()}] [备份] [WebDAV] [成功] ${snap} 已上传（${uploaded} 个文件` +
      (skipped ? `，跳过 ${skipped} 个可再生目录）` : `）`)
    );
    return { ok: true, uploaded, skipped };
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [备份] [WebDAV] [失败] ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

/**
 * 测试 WebDAV 连接与写权限（PUT 探针文件后立即删除，不留残留）
 * @param {object} cfg - {url, user, pass, path}
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function testWebDAVConnection({ url, user, pass, path = '' } = {}) {
  const base = normalizeBase(url);
  if (!base || !user || !pass) return { ok: false, reason: '请填写完整的 WebDAV 配置' };
  const headers = { Authorization: authHeader(user, pass) };
  const probe = `${remoteUrl(base, path)}/.probe-${Date.now()}`;

  try {
    // 先确保远程目录存在（已存在则跳过）
    await mkcol(remoteUrl(base, path), headers).catch(() => false);
    const res = await fetch(probe, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: 'ok',
      signal: AbortSignal.timeout(TIMEOUT_SMALL),
    });
    if (!OK_STATUS.has(res.status)) {
      return { ok: false, reason: statusMessage(res.status) };
    }
    await fetch(probe, { method: 'DELETE', headers, signal: AbortSignal.timeout(TIMEOUT_SMALL) }).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `连接失败：${err.message}` };
  }
}
