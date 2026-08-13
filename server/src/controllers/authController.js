/**
 * 认证控制器
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { jsonSuccess, jsonError } from '../utils/response.js';
import { writeLog, LOG_MODULE, LOG_ACTION } from '../utils/operationLogger.js';

/**
 * 管理员登录
 * POST /api/auth/login
 */
export async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return jsonError(res, '用户名和密码不能为空');
  }

  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();

  if (!admin) {
    return jsonError(res, '管理员账号未初始化', 500);
  }

  if (admin.username !== username) {
    // 与其他网站一致：登录失败返回 HTTP 200 + 业务码（body.code），
    // 避免浏览器控制台自动打印接口信息（状态码/URL）
    return res.status(200).json({ code: 401, message: '用户名或密码错误', data: null });
  }

  // bcrypt 异步比较，避免同步哈希阻塞事件循环
  const passwordOk = await bcrypt.compare(password, admin.password);
  if (!passwordOk) {
    return res.status(200).json({ code: 401, message: '用户名或密码错误', data: null });
  }

  // 生成 JWT，有效期 7 天，携带密码变更时间戳用于服务端主动失效
  const token = jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      pcAt: admin.password_changed_at || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log(`[${new Date().toISOString()}] [认证] [登录] [成功] ${username}`);
  // 操作日志（登录前未认证，operator 留空，仅记来源 IP）
  writeLog({
    module: LOG_MODULE.AUTH,
    action: LOG_ACTION.LOGIN,
    detail: `管理员登录成功：${username}`,
    meta: { username },
  }, req);

  return jsonSuccess(res, { token, username: admin.username }, '登录成功');
}

/**
 * 修改密码（需登录）
 * POST /api/auth/change-password
 */
export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const adminId = req.admin.id;

  if (!oldPassword || !newPassword) {
    return jsonError(res, '原密码和新密码不能为空');
  }

  if (newPassword.length < 8) {
    return jsonError(res, '新密码至少 8 位');
  }

  // 密码强度检查：建议包含字母和数字（非强制，仅警告）
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  if (newPassword.length >= 8 && (!hasLetter || !hasNumber)) {
    console.log(`[${new Date().toISOString()}] [认证] [修改密码] [警告] 密码强度偏弱，建议包含字母和数字`);
  }

  const admin = db.prepare('SELECT * FROM admin WHERE id = ?').get(adminId);

  // bcrypt 异步比较
  const oldOk = await bcrypt.compare(oldPassword, admin.password);
  if (!oldOk) {
    return jsonError(res, '原密码错误');
  }

  // 盐轮次 12，与保险库保持一致（异步哈希）
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const now = new Date().toISOString();

  db.prepare('UPDATE admin SET password = ?, password_changed_at = ? WHERE id = ?')
    .run(hashedPassword, now, adminId);

  console.log(`[${now}] [认证] [修改密码] [成功] ${admin.username}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.AUTH,
    action: LOG_ACTION.UPDATE,
    detail: '修改登录密码',
    meta: {},
  }, req);

  return jsonSuccess(res, null, '密码修改成功，请重新登录');
}

/* ============================== 保险库控制器（原 vaultController.js 合并） ============================== */

// 保险库 Token 有效期
const VAULT_ACCESS_TOKEN_EXPIRES_IN = '30m';   // access_token：30 分钟
const VAULT_REFRESH_TOKEN_EXPIRES_IN = '7d';   // refresh_token：7 天

/**
 * 查询保险库状态
 * GET /api/vault/status
 * 返回：是否已开启功能、是否已设置密码
 */
export function getVaultStatus(req, res) {
  const admin = db.prepare('SELECT vault_enabled, vault_password_hash FROM admin WHERE id = ?').get(req.admin.id);

  const isEnabled = !!admin?.vault_enabled;
  const isSet = !!admin?.vault_password_hash;

  return jsonSuccess(res, { isEnabled, isSet }, '查询成功');
}

/**
 * 开启/关闭保险库功能
 * PUT /api/vault/toggle
 * 关闭时清除所有锁定状态（分类和书签的 is_locked 归零），并使已签发的 Token 失效
 */
export function toggleVault(req, res) {
  const { enabled } = req.body;
  const adminId = req.admin.id;

  const admin = db.prepare('SELECT vault_enabled, vault_password_hash FROM admin WHERE id = ?').get(adminId);

  if (enabled && !admin?.vault_password_hash) {
    return jsonError(res, '请先在网站设置中设置保险库密码');
  }

  const newValue = enabled ? 1 : 0;
  db.prepare('UPDATE admin SET vault_enabled = ? WHERE id = ?').run(newValue, adminId);

  // 关闭时：清除所有锁定状态 + 递增 lock_version 使旧 Token 失效
  if (!enabled) {
    db.prepare('UPDATE categories SET is_locked = 0 WHERE deleted_at IS NULL').run();
    db.prepare('UPDATE links SET is_locked = 0 WHERE deleted_at IS NULL').run();
    db.prepare('UPDATE admin SET lock_version = lock_version + 1 WHERE id = ?').run(adminId);
  }

  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [开关] [成功] ${req.admin.username} -> ${enabled ? '开启' : '关闭'}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.VAULT,
    action: LOG_ACTION.TOGGLE,
    detail: `保险库${enabled ? '开启' : '关闭'}`,
    meta: { enabled: !!newValue },
  }, req);

  return jsonSuccess(res, { enabled: !!newValue }, enabled ? '保险库已开启' : '保险库已关闭');
}

/**
 * 设置保险库密码（首次设置）
 * POST /api/vault/password
 */
export async function setVaultPassword(req, res) {
  const { password } = req.body;
  const adminId = req.admin.id;

  if (!password) {
    return jsonError(res, '保险库密码不能为空');
  }

  if (password.length < 8) {
    return jsonError(res, '保险库密码至少 8 位');
  }

  // 密码强度检查：建议包含字母和数字（非强制，仅警告）
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (password.length >= 8 && (!hasLetter || !hasNumber)) {
    console.log(`[${new Date().toISOString()}] [保险库] [设置密码] [警告] 密码强度偏弱，建议包含字母和数字`);
  }

  const admin = db.prepare('SELECT vault_password_hash FROM admin WHERE id = ?').get(adminId);

  // 已设置过密码则不允许重复设置，需走修改流程
  if (admin?.vault_password_hash) {
    return jsonError(res, '保险库密码已设置，请使用修改密码接口');
  }

  // 盐轮次 12，与登录密码保持一致（异步哈希）
  const hashedPassword = await bcrypt.hash(password, 12);

  db.prepare('UPDATE admin SET vault_password_hash = ? WHERE id = ?')
    .run(hashedPassword, adminId);

  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [设置密码] [成功] ${req.admin.username}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.VAULT,
    action: LOG_ACTION.UPDATE,
    detail: '设置保险库密码',
    meta: {},
  }, req);

  return jsonSuccess(res, null, '保险库密码设置成功');
}

/**
 * 修改保险库密码
 * PUT /api/vault/password
 */
export async function changeVaultPassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const adminId = req.admin.id;

  if (!oldPassword || !newPassword) {
    return jsonError(res, '原密码和新密码不能为空');
  }

  if (newPassword.length < 8) {
    return jsonError(res, '新保险库密码至少 8 位');
  }

  // 密码强度检查：建议包含字母和数字（非强制，仅警告）
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  if (newPassword.length >= 8 && (!hasLetter || !hasNumber)) {
    console.log(`[${new Date().toISOString()}] [保险库] [修改密码] [警告] 密码强度偏弱，建议包含字母和数字`);
  }

  const admin = db.prepare('SELECT vault_password_hash FROM admin WHERE id = ?').get(adminId);

  if (!admin?.vault_password_hash) {
    return jsonError(res, '保险库密码尚未设置');
  }

  // bcrypt 异步比较
  const oldOk = await bcrypt.compare(oldPassword, admin.vault_password_hash);
  if (!oldOk) {
    return jsonError(res, '原密码错误');
  }

  // 盐轮次 12，与登录密码保持一致（异步哈希）
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // 更新密码哈希并递增 lock_version，使旧 Token 全部失效
  db.prepare('UPDATE admin SET vault_password_hash = ?, lock_version = lock_version + 1 WHERE id = ?')
    .run(hashedPassword, adminId);

  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [修改密码] [成功] ${req.admin.username}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.VAULT,
    action: LOG_ACTION.UPDATE,
    detail: '修改保险库密码',
    meta: {},
  }, req);

  return jsonSuccess(res, null, '保险库密码修改成功');
}

/**
 * 解锁保险库
 * POST /api/vault/unlock
 * 校验密码后签发短期有效的保险库 Token
 * Token payload 中包含当前的 lockVersion，加密状态变化后旧 Token 失效
 */
export async function unlockVault(req, res) {
  const { password } = req.body;
  const adminId = req.admin.id;

  if (!password) {
    return jsonError(res, '保险库密码不能为空');
  }

  const admin = db.prepare('SELECT vault_password_hash, lock_version FROM admin WHERE id = ?').get(adminId);

  if (!admin?.vault_password_hash) {
    return jsonError(res, '保险库密码尚未设置');
  }

  // bcrypt 异步比较
  const passwordOk = await bcrypt.compare(password, admin.vault_password_hash);
  if (!passwordOk) {
    return jsonError(res, '保险库密码错误');
  }

  // 签发保险库 Token，携带当前 lockVersion
  // 加密状态变化后 lock_version 递增，旧 Token 校验失败
  const tokenPayload = {
    id: adminId,
    type: 'vault',
    lockVersion: admin.lock_version || 0,
  };

  const accessToken = jwt.sign(
    { ...tokenPayload, t: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: VAULT_ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { ...tokenPayload, t: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: VAULT_REFRESH_TOKEN_EXPIRES_IN }
  );

  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [解锁] [成功] ${req.admin.username} (lockVersion=${admin.lock_version || 0})`);

  return jsonSuccess(res, {
    accessToken,
    refreshToken,
    expiresIn: VAULT_ACCESS_TOKEN_EXPIRES_IN,
  }, '保险库已解锁');
}

/**
 * 锁定保险库（服务端仅记录日志，实际锁定由前端清除 Token 实现）
 * POST /api/vault/lock
 */
export function lockVault(req, res) {
  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [锁定] [成功] ${req.admin.username}`);

  return jsonSuccess(res, null, '保险库已锁定');
}

/**
 * 忘记密码 - 重置保险库密码
 * POST /api/vault/reset-password
 * 验证管理员登录密码（非保险库密码）后，允许重新设置保险库密码
 * 用于用户忘记保险库密码时的恢复场景
 */
export async function resetVaultPassword(req, res) {
  const { adminPassword, newPassword } = req.body;
  const adminId = req.admin.id;

  if (!adminPassword || !newPassword) {
    return jsonError(res, '管理员密码和新保险库密码不能为空');
  }

  if (newPassword.length < 8) {
    return jsonError(res, '新保险库密码至少 8 位');
  }

  // 验证管理员登录密码（二级验证，确保是管理员本人操作）
  const admin = db.prepare('SELECT password FROM admin WHERE id = ?').get(adminId);

  // bcrypt 异步比较
  const adminOk = await bcrypt.compare(adminPassword, admin.password);
  if (!adminOk) {
    return jsonError(res, '管理员密码错误');
  }

  // 密码强度检查：建议包含字母和数字
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  if (newPassword.length >= 8 && (!hasLetter || !hasNumber)) {
    console.log(`[${new Date().toISOString()}] [保险库] [重置密码] [警告] 密码强度偏弱，建议包含字母和数字`);
  }

  // 保险库开启中则先关闭（清除所有锁定状态）
  const adminFull = db.prepare('SELECT vault_enabled FROM admin WHERE id = ?').get(adminId);
  if (adminFull?.vault_enabled) {
    db.prepare('UPDATE categories SET is_locked = 0 WHERE deleted_at IS NULL').run();
    db.prepare('UPDATE links SET is_locked = 0 WHERE deleted_at IS NULL').run();
    db.prepare('UPDATE admin SET vault_enabled = 0 WHERE id = ?').run(adminId);
  }

  // 设置新密码哈希 + 递增 lock_version 使旧 Token 全部失效（异步哈希）
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE admin SET vault_password_hash = ?, lock_version = lock_version + 1 WHERE id = ?')
    .run(hashedPassword, adminId);

  const now = new Date().toISOString();
  console.log(`[${now}] [保险库] [重置密码] [成功] ${req.admin.username}`);
  // 操作日志
  writeLog({
    module: LOG_MODULE.VAULT,
    action: LOG_ACTION.UPDATE,
    detail: '重置保险库密码',
    meta: {},
  }, req);

  return jsonSuccess(res, null, '保险库密码已重置，请重新设置保险库');
}

/**
 * 刷新保险库 Token
 * POST /api/vault/refresh
 * 用 refresh_token 静默换取新的 access_token + refresh_token
 */
export function refreshVaultToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return jsonError(res, 'refresh_token 不能为空', 401);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // 校验是否为 vault refresh token
    if (decoded.type !== 'vault' || decoded.t !== 'refresh') {
      return jsonError(res, '无效的 refresh_token', 401);
    }

    // 检查 lock_version 是否变化（密码修改后旧 token 失效）
    const admin = db.prepare('SELECT lock_version, vault_password_hash FROM admin WHERE id = ?').get(decoded.id);

    if (!admin?.vault_password_hash) {
      return jsonError(res, '保险库密码已被重置', 401, null);
    }

    if ((decoded.lockVersion || 0) !== (admin.lock_version || 0)) {
      return jsonError(res, '保险库状态已变更，请重新解锁', 401, null);
    }

    // 签发新的双 Token
    const tokenPayload = {
      id: decoded.id,
      type: 'vault',
      lockVersion: admin.lock_version || 0,
    };

    const newAccessToken = jwt.sign(
      { ...tokenPayload, t: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: VAULT_ACCESS_TOKEN_EXPIRES_IN }
    );

    const newRefreshToken = jwt.sign(
      { ...tokenPayload, t: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: VAULT_REFRESH_TOKEN_EXPIRES_IN }
    );

    return jsonSuccess(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: VAULT_ACCESS_TOKEN_EXPIRES_IN,
    }, '刷新成功');
  } catch (err) {
    // refresh_token 过期
    return jsonError(res, 'refresh_token 已过期，请重新输入密码解锁', 401, null);
  }
}
