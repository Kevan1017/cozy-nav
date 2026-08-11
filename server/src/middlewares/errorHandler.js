/**
 * 全局错误处理中间件
 * 捕获所有未处理的异常，返回统一格式
 *
 * 安全策略：
 * - 开发环境（NODE_ENV !== 'production'）：返回完整 err.message，便于调试
 * - 生产环境（NODE_ENV === 'production'）：返回通用提示，不泄露内部错误细节
 *   防止攻击者通过 err.message 获取数据库错误/堆栈/业务逻辑等敏感信息
 * - 服务器日志始终完整记录 err.stack，便于运维排查
 */
export function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  // 服务器日志：始终完整记录（含堆栈），便于运维排查
  console.error(
    `[${timestamp}] [错误] ${method} ${url}\n` +
    `  message: ${err.message}\n` +
    `  stack: ${err.stack || '(无堆栈)'}`
  );

  // express-validator 验证错误（4xx，可安全返回）
  if (err.type === 'entity.validation.failed') {
    return res.status(400).json({
      code: 400,
      message: '请求数据格式错误',
      data: null,
    });
  }

  // JSON 请求体解析失败（畸形 JSON）——按 400 处理，不泄露解析细节
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 400,
      message: '请求数据格式错误',
      data: null,
    });
  }

  // 请求体超出大小限制——按 413 处理
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      code: 413,
      message: '请求体过大',
      data: null,
    });
  }

  // 5xx 服务器内部错误
  if (isProd) {
    // 生产环境：返回通用提示，不泄露 err.message
    // （err.message 可能包含 SQL 错误、文件路径、堆栈片段等敏感信息）
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误，请稍后重试',
      data: null,
    });
  }

  // 开发环境：返回完整错误信息，便于调试
  return res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    data: null,
  });
}
