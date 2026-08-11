/**
 * 统一响应工具函数
 */

// 成功响应
export function jsonSuccess(res, data = null, message = 'success') {
  return res.json({ code: 200, message, data });
}

// 失败响应
export function jsonError(res, message = '操作失败', code = 400, data = null) {
  return res.status(code).json({ code, message, data });
}

// 分页响应
export function jsonPage(res, list, total, page, pageSize) {
  return res.json({
    code: 200,
    message: 'success',
    data: {
      list,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
