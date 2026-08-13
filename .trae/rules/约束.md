# cozy·nav AI 写代码约束

---

## 一、通用规范

1. 代码注释用中文，变量/函数名用英文（驼峰或下划线）
2. 缩进 2 空格，文件编码 UTF-8 无 BOM
3. 函数体不超过 50 行，超长则按职责拆分为子函数
4. 环境变量（.env）必须包含 `PORT` 和 `JWT_SECRET`，启动时校验

## 二、前端规范（Vue 3 + `<script setup>`）

1. 语法：强制使用 `<script setup>` 组合式 API，禁止 Options API
2. 样式：所有颜色必须引用 `tokens.css` 中的 CSS 变量（禁止硬编码 `#fff` 或 `#000`）。背景需用毛玻璃/噪点/blob 装饰，玻璃态必须保留
3. 响应式：间距、圆角、字体大小统一使用 `clamp()` 函数（参照原有 bob 动效写法）
4. 组件：组件名采用 PascalCase，`.vue` 文件名与组件名完全一致
5. 请求：所有 HTTP 请求走 `api/` 目录封装（如 `api/links.js`），禁止在组件内直接 fetch 或 axios
6. 列表：`v-for` 必须使用数据项的 id 作为 key，严禁使用遍历索引 index
7. 逻辑：复杂业务逻辑（增删改查、排序、搜索）必须抽离至 `composables/` 目录下的组合式函数
8. 动画：使用原文件的 `@keyframes bob`，保持一致的动效语言
9. 装饰：blob / 噪点 / 玻璃拟态等装饰效果必须保留，不可省略

## 三、后端规范（Node.js + Express）

1. 校验：所有接口路由必须经过 `express-validator` 校验，并统一返回 400 错误
2. 加密：用户密码存储必须使用 bcrypt 加盐哈希（盐轮次 >= 10）
3. 安全：SQL 查询必须使用参数化绑定（`?` 占位符），严禁使用 `${变量}` 拼接 SQL 字符串
4. 架构：`routes/` 只做路由定义，数据库操作逻辑全部写入 `controllers/`；数据库表必须包含 `sort_order`（排序权重）和 `deleted_at`（软删除时间）
5. 鉴权：所有需要管理员身份的操作，必须校验 JWT Token 有效性
6. 异常：所有 `throw new Error()` 必须由顶层 `errorHandler` 中间件捕获，并输出统一格式 `{ code, message, data }`
7. 软删除：所有查询默认过滤 `WHERE deleted_at IS NULL`，在 controllers 中封装基础查询方法

## 四、通信与接口规范（RESTful）

1. 响应：所有接口返回 JSON 格式 `{ code: 200, message: 'success', data: {} }`
2. 认证：Token 必须放在请求头 `Authorization: Bearer <token>` 中传递
3. 方法：删除资源强制使用 DELETE 方法
4. 置顶：书签置顶/取消置顶接口定义为 `PUT /api/links/:id/pin`，请求体 `{ "pinned": true/false, "order": 1 }`

## 五、补充规范

1. 前端网络异常处理：Axios 拦截器统一处理超时/断网，超时时间 10 秒，断网提示"网络不可用"
2. 后端日志：关键操作（登录/增删改）输出到 console，格式 `[时间] [模块] [操作] [结果]`，部署后用 pm2 自动收集
3. 目录约定：
   - 后端：`routes/` `controllers/` `middlewares/` `utils/` `db/`
   - 前端：`api/` `stores/` `composables/` `components/` `views/` `styles/`
