/**
 * 保险库认证中间件（两种模式）
 *
 * 1. vaultGuard（软过滤）：用于列表查询 API
 *    - 无 token / token 无效：标记 req.filterLocked = true，后续查询过滤锁定项
 *    - token 有效：标记 req.vaultUnlocked = true，返回全部数据
 *
 * 2. vaultAuthMiddleware（硬拒绝）：用于需要强制解锁的操作
 *    - 无 token / token 无效：直接返回 403
 *
 * 安全策略：
 * - 两个中间件都校验 token 里的 lockVersion 是否与数据库一致
 * - 用户修改保险库密码或关闭保险库时，lock_version 递增，旧 token 立即失效
 * - 防止"修改密码后旧 token 仍能用"的安全漏洞
 */
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

/**
 * 校验 vault token 的 lockVersion 是否与数据库一致
 * @param {object} decoded - jwt.decode 后的 payload
 * @param {number} adminId - 管理员 ID
 * @returns {boolean} true 表示 token 仍然有效
 */
function isLockVersionValid(decoded, adminId) {
  // 兼容旧 token（无 lockVersion 字段）视为无效，强制重新解锁
  if (decoded.lockVersion === undefined) return false;

  const admin = db.prepare('SELECT lock_version FROM admin WHERE id = ?').get(adminId);
  const dbLockVersion = admin?.lock_version || 0;
  return decoded.lockVersion === dbLockVersion;
}

/**
 * 软过滤中间件：列表查询用
 * 不拦截请求，只设置标记位让 controller 决定是否过滤锁定内容
 */
export function vaultGuard(req, res, next) {
  const vaultToken = req.headers['x-vault-token'];

  if (!vaultToken) {
    // 无 token：标记需要过滤锁定项
    req.filterLocked = true;
    req.vaultUnlocked = false;
    return next();
  }

  try {
    const decoded = jwt.verify(vaultToken, process.env.JWT_SECRET);

    // 校验 Token 类型
    if (decoded.type !== 'vault') {
      req.filterLocked = true;
      req.vaultUnlocked = false;
      return next();
    }

    // 校验 lock_version：密码修改后旧 token 立即失效
    if (!isLockVersionValid(decoded, decoded.id)) {
      req.filterLocked = true;
      req.vaultUnlocked = false;
      return next();
    }

    // token 有效：标记已解锁
    req.vaultUnlocked = true;
    req.filterLocked = false;
    req.vault = decoded;
    next();
  } catch (err) {
    // token 过期：返回 401 让前端拦截器触发静默刷新
    const message = err.name === 'TokenExpiredError'
      ? '保险库令牌已过期'
      : '保险库令牌无效';
    return res.status(401).json({
      code: 401,
      message,
      data: null,
    });
  }
}

/**
 * 硬拒绝中间件：强制需要解锁的操作用
 */
export function vaultAuthMiddleware(req, res, next) {
  const vaultToken = req.headers['x-vault-token'];

  if (!vaultToken) {
    return res.status(403).json({
      code: 403,
      message: '保险库未解锁，请先解锁',
      data: null,
    });
  }

  try {
    const decoded = jwt.verify(vaultToken, process.env.JWT_SECRET);

    if (decoded.type !== 'vault') {
      return res.status(403).json({
        code: 403,
        message: '保险库令牌无效',
        data: null,
      });
    }

    // 校验 lock_version：密码修改后旧 token 立即失效
    if (!isLockVersionValid(decoded, decoded.id)) {
      return res.status(403).json({
        code: 403,
        message: '保险库状态已变更，请重新解锁',
        data: null,
      });
    }

    req.vault = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      code: 403,
      message: '保险库令牌已过期，请重新解锁',
      data: null,
    });
  }
}
