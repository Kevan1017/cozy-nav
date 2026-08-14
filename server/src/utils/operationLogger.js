/**
 * 后台操作日志工具
 * - 关键写操作（登录/增删改/导入导出/密码等）落库，支撑事后追溯异常操作（如百万级导入）
 * - 与既有 console 日志并存：落库 + console 双写
 * - 保留策略：超出 MAX_OPERATION_LOGS 条时自动删除最旧记录（物理删除，非软删）
 */
import db from '../db/index.js';

// 日志保留上限（默认 5000 条，覆盖单人约 1~2 年操作量）
const MAX_OPERATION_LOGS = 5000;

// 模块常量
export const LOG_MODULE = {
  AUTH: 'auth',        // 登录/密码
  LINK: 'link',        // 书签增删改
  CATEGORY: 'category',// 分类增删改
  ENGINE: 'engine',    // 搜索引擎增删改
  IMPORT: 'import',    // 导入/导出
  SETTING: 'setting',  // 后台设置
  VAULT: 'vault',      // 保险库
  BACKUP: 'backup',    // 备份/WebDAV
  PATROL: 'patrol',    // 巡检/批量检测
};

// 动作常量
export const LOG_ACTION = {
  LOGIN: 'login',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESTORE: 'restore',
  IMPORT: 'import',
  EXPORT: 'export',
  CLEAR: 'clear',
  TOGGLE: 'toggle',
  RUN: 'run',          // 执行（立即备份/立即巡检）
  UNLOCK: 'unlock',    // 保险库解锁
  MOVE: 'move',        // 批量移动
  CHECK: 'check',      // 批量检测/重检/重置
  SEND: 'send',        // 通知测试发送
};

// 兼容别名导出（业务代码用 logOperation 更直观）
export const logOperation = { MODULE: LOG_MODULE, ACTION: LOG_ACTION };

/**
 * 规范化 IP 显示：还原 IPv4 映射格式（::ffff:127.0.0.1 -> 127.0.0.1）、去掉 IPv6 字面量端口
 * @param {string|null} ip
 * @returns {string|null}
 */
export function normalizeIp(ip) {
  if (!ip) return null;
  let v = ip.trim();
  // 去掉 IPv6 字面量端口，如 [::1]:53652
  const bracketMatch = v.match(/^\[(.+)\]:\d+$/);
  if (bracketMatch) v = bracketMatch[1];
  // IPv4-mapped IPv6 还原为 IPv4（node 在 IPv6 栈下常见）
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v || null;
}

/**
 * 尽量准确地解析真实客户端 IP（兼容本机直连 / nginx 反代 / Node 直对公网三种部署）
 * 优先级：
 *  1. 已配置 trust proxy：req.ip 是 Express 按跳数从 XFF 右侧解析出的可信真实 IP（防伪造，最准）
 *  2. 未配置 trust proxy 但直连是本机回环：说明经反代转发，从 XFF 取最后一个（nginx 追加的真实 IP）
 *  3. 直连不是本机：Node 直对公网，socket 地址即真实来源，此时拒绝 XFF 防止客户端伪造
 * @param {object|null} req
 * @returns {string|null}
 */
export function resolveClientIp(req) {
  if (!req) return null;

  // 1. trust proxy 已开启：直接信任 Express 解析结果
  if (req.app?.get('trust proxy')) {
    return normalizeIp(req.ip);
  }

  // 2/3. trust proxy 未开启：req.ip 即 socket 直连方
  const direct = normalizeIp(req.ip || req.socket?.remoteAddress);
  if (!direct) return null;

  // 直连是本机回环 → 大概率经反代转发，从 XFF 末尾取真实 IP（nginx 追加的最后一位）
  if (direct === '127.0.0.1' || direct === '::1') {
    const xffList = (req.headers?.['x-forwarded-for'] || '')
      .split(',').map(s => s.trim()).filter(s => s && s !== 'unknown');
    if (xffList.length) return normalizeIp(xffList[xffList.length - 1]);
  }

  return direct;
}

/**
 * 写入一条操作日志
 * @param {object} opts - { module, action, detail, meta }
 * @param {object} req  - 请求对象（取操作人与 IP），可为空
 */
export function writeLog(opts, req = null) {
  const { module, action, detail = '', meta = null } = opts || {};
  if (!module || !action) return;

  try {
    const operator = req?.admin?.username || null;
    const ip = resolveClientIp(req);

    db.prepare(
      'INSERT INTO operation_logs (module, action, detail, meta, operator, ip) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(module, action, detail, meta ? JSON.stringify(meta) : null, operator, ip);

    // 超量裁剪：仅保留最近 MAX_OPERATION_LOGS 条（按 id 正序删最旧）
    const { c: total } = db.prepare('SELECT COUNT(*) AS c FROM operation_logs WHERE deleted_at IS NULL').get();
    if (total > MAX_OPERATION_LOGS) {
      db.prepare(
        'DELETE FROM operation_logs WHERE id IN (SELECT id FROM operation_logs WHERE deleted_at IS NULL ORDER BY id ASC LIMIT ?)'
      ).run(total - MAX_OPERATION_LOGS);
    }

    console.log(`[${new Date().toISOString()}] [操作日志] [${module}] [${action}] [成功] ${detail}`);
  } catch (err) {
    // 日志写入失败不影响主流程，仅输出警告
    console.log(`[${new Date().toISOString()}] [操作日志] [写入失败] ${err.message}`);
  }
}
