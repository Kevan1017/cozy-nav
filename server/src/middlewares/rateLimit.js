/**
 * 轻量级内存限流中间件
 * 不引入外部依赖，使用 Map 存储 IP 访问记录
 * 适用场景：登录、解锁等敏感接口的爆破防护
 *
 * 注意：单进程内存方案，多实例部署需替换为 Redis 版本
 */

/**
 * 创建限流中间件
 * @param {Object} options - 配置项
 * @param {number} options.windowMs - 时间窗口（毫秒），默认 60 秒
 * @param {number} options.max - 窗口内最大请求数，默认 5
 * @param {string} options.message - 超限错误消息
 * @returns {Function} Express 中间件
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 5,
  message = '请求过于频繁，请稍后再试',
} = {}) {
  // Map<ip, { count: number, resetAt: number }>
  const store = new Map();

  // 定期清理过期记录，避免内存泄漏
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store) {
      if (now > record.resetAt) {
        store.delete(ip);
      }
    }
  }, windowMs * 2);

  // 允许 clearInterval 在进程退出时被清理（防止 Node 报告句柄泄漏）
  cleanupInterval.unref?.();

  return function rateLimit(req, res, next) {
    // 提取客户端 IP（考虑反向代理场景）
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let record = store.get(ip);

    // 首次访问或窗口已重置
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      store.set(ip, record);
      return next();
    }

    // 窗口内累加
    record.count += 1;

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      console.warn(
        `[${new Date().toISOString()}] [限流] [拦截] IP=${ip} ` +
        `count=${record.count}/${max} retryAfter=${retryAfter}s`
      );
      return res.status(429).json({
        code: 429,
        message: `${message}（${retryAfter} 秒后重试）`,
        data: null,
      });
    }

    next();
  };
}

/**
 * 登录接口限流：5 次/分钟/IP
 */
export const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: '登录尝试次数过多',
});

/**
 * 保险库解锁接口限流：5 次/分钟/IP
 */
export const vaultUnlockLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: '保险库解锁尝试次数过多',
});

/**
 * 密码操作接口限流：3 次/分钟/IP
 * 覆盖：修改登录密码、设置/修改保险库密码、忘记密码重置
 * 防御：持有 JWT 的攻击者对密码字段的暴力尝试
 */
export const passwordChangeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: '密码操作过于频繁，请稍后再试',
});
