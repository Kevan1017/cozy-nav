/**
 * JWT 认证中间件
 * 校验 Authorization: Bearer <token> 请求头
 * 并检查 token 中的 pcAt 是否与数据库一致（密码修改后旧 token 失效）
 */
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌',
      data: null,
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 检查密码是否被修改过（服务端主动失效）
    const admin = db.prepare('SELECT password_changed_at FROM admin WHERE id = ?').get(decoded.id);
    if (admin) {
      const currentPcAt = admin.password_changed_at || 0;
      if ((decoded.pcAt || 0) !== currentPcAt) {
        return res.status(401).json({
          code: 401,
          message: '密码已修改，请重新登录',
          data: null,
        });
      }
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      code: 401,
      message: '令牌无效或已过期',
      data: null,
    });
  }
}
