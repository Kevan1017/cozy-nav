/**
 * 输入校验结果检查中间件
 * 如果 express-validator 校验不通过，返回 400 错误
 */
import { validationResult } from 'express-validator';

export function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => err.msg);
    return res.status(400).json({
      code: 400,
      message: messages[0] || '输入参数有误',
      data: null,
    });
  }

  next();
}
