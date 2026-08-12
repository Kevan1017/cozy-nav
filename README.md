# 悦行 · cozy·nav

> 一款温暖风格的个人书签导航站：一站式收藏、搜索、巡检、统计与备份，提供 Web 管理界面与浏览器扩展（Chrome/Edge），帮助高效管理和整理网络书签。

## ✨ 主要特性

### 🌐 智能书签管理
- **快速保存** - 浏览器扩展一键保存当前页面为书签，右键菜单可直接选分类收藏
- **分类管理** - 分类 + 置顶 + 排序，支持软删除与回收站恢复
- **智能去重** - URL 规范化判重，重复收藏自动提示
- **导入导出** - 支持浏览器书签 HTML 与 JSCN 格式导入导出

### 🔍 搜索与导航
- **多搜索引擎** - 内置多种搜索引擎，支持后台自定义与前台切换
- **置顶快捷栏** - 常用书签置顶，一键直达
- **结果高亮** - 站内搜索关键词高亮（安全转义，防 XSS）

### 🛡️ 健康监测
- **链接可用性检查** - 直连 + DoH 双判定，识别打不开 / 疑似被墙
- **HTTPS/SSL 检测** - 监控证书到期时间，提前预警
- **告警通知** - 通过 Server酱 / 邮件推送巡检异常

### 📊 访问统计
- **访问趋势** - 近 N 天访问量折线图
- **热门 TOP** - 高频访问链接排行
- **冷链接分析** - 识别 30 天未访问的闲置书签

### 🔒 数据安全
- **保险库** - 分类 / 书签独立加密锁定，独立密码
- **自动备份** - 本地备份 + 可选 Git 异地快照
- **软删除** - 删除先进回收站可恢复，彻底删除才物理清除

### 🎨 个性化定制
- **多主题预设** - 内置多套配色，亮 / 暗 / 自动三种模式
- **自定义配色** - 后台可视调整并固化为预设
- **字体切换** - 黑体 / 楷体 / 宋体一键切换
- **多视图布局** - 卡片 / 列表 / 紧凑三种模式
- **节日彩蛋** - 春节灯笼、圣诞雪花等节日装饰
- **双端适配** - PC 与移动端完美适配

## 🏗️ 项目结构

```
cozy-nav/
├── extension/          # 浏览器扩展 (Chrome/Edge, Manifest V3)
│   ├── manifest.json   # 扩展配置
│   ├── popup.html      # 弹出界面
│   ├── popup.js        # 界面逻辑
│   ├── background.js   # 后台脚本（右键菜单收藏）
│   └── icons/          # 图标资源
├── server/             # 后端服务 (Express + node:sqlite)
│   ├── src/
│   │   ├── app.js          # Express 应用入口
│   │   ├── controllers/    # 业务控制器
│   │   ├── routes/         # API 路由
│   │   ├── middlewares/    # 中间件（鉴权 / 校验 / 错误处理）
│   │   ├── utils/          # 工具函数（巡检 / favicon / 备份等）
│   │   └── db/             # 数据库初始化与迁移
│   └── .env.example        # 环境变量示例
└── web/                # 前端应用 (Vue 3 + Vite)
    ├── src/
    │   ├── api/            # API 接口封装
    │   ├── components/     # Vue 组件
    │   ├── views/          # 页面视图（前台 + 后台）
    │   ├── stores/         # Pinia 状态管理
    │   ├── composables/    # 组合式函数
    │   └── styles/         # 全局样式（tokens.css 等）
    └── vite.config.js      # Vite 配置（含 /api 代理）
```

## 🚀 快速开始（本地开发）

### 环境要求

- **Node.js ≥ 22.13**（后端使用内置 `node:sqlite` 驱动，零数据库配置）
- npm（随 Node 自带）

### 1. 后端启动

```bash
cd server
npm install
cp .env.example .env        # 修改 .env 中的 PORT、JWT_SECRET
npm run dev                 # 开发模式，监听 http://localhost:8000
```

### 2. 前端启动

```bash
cd web
npm install
npm run dev                 # 开发模式，访问 http://localhost:5173
                            # /api、/favicons、/logo 已自动代理到 8000
```

### 3. 浏览器扩展安装

1. 打开 Chrome/Edge，访问 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `extension` 目录
4. 点击扩展图标，服务器地址填 `http://localhost:8000`，登录一次即可使用

> 首次启动自动创建管理员账号（`.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，默认 `admin` / `admin123`，**生产环境务必修改**）。

## 📦 生产部署

### 1. 环境变量（`.env`）

```env
# 服务端口
PORT=8000

# 运行环境：development / production（生产必须设为 production）
NODE_ENV=production

# JWT 密钥：生产环境改为至少 32 位随机字符串（可用 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 生成）
JWT_SECRET=your-long-random-secret

# 允许跨域的来源（生产环境改为你的前端域名，多个用逗号分隔）
CORS_ORIGIN=https://nav.example.com

# 浏览器扩展 ID 白名单（可选，不配置则默认放行所有 chrome-extension:// 来源，扩展仍需 JWT 鉴权）
CORS_EXTENSIONS=

# 管理员账号（仅首次启动建库时生效）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123   # ← 务必改成强密码
```

### 2. 安装依赖并构建前端

```bash
cd server && npm install
cd ../web && npm install
npm run build               # 产物输出到 web/dist
```

### 3. 进程守护（pm2）

```bash
npm install -g pm2
cd server
pm2 start src/app.js --name cozy-nav
pm2 save && pm2 startup    # 开机自启
```

### 4. Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name nav.example.com;

    # 前端静态资源
    location / {
        root /www/wwwroot/cozy-nav/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location ^~ /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源（favicon 与 logo 图片）
    location ^~ /favicons { proxy_pass http://127.0.0.1:8000; }
    location ^~ /logo { proxy_pass http://127.0.0.1:8000; }
}
```

> 建议通过 certbot 等工具配置 HTTPS（后端会下发 HSTS 头）。

## 🔒 安全注意事项

部署到公网前请务必完成：

- [ ] `ADMIN_PASSWORD` 改为强密码（默认 `admin123` 仅限本地）
- [ ] `JWT_SECRET` 改为至少 32 位随机字符串
- [ ] `NODE_ENV=production`（隐藏内部错误信息）
- [ ] `CORS_ORIGIN` 配置为你的前端域名
- [ ] 首次启动后登录后台，建议开启「保险库」并设置独立密码，加密敏感书签
- [ ] 系统内置 SSRF 内网黑名单（fetch 标题 / favicon 抓取均过滤内网地址）

## 🖥️ 浏览器扩展使用

1. 点击工具栏扩展图标，在「设置」中填写你的服务器地址（如 `https://nav.example.com`，不含 `/api`）
2. 登录一次（保存 JWT，之后无需重复登录）
3. 收藏方式：
   - **弹窗收藏**：点击图标 → 选择分类 → 保存
   - **右键收藏**：网页上右键 → 「收藏到悦行」→ 选择分类 → 一步完成

## 📦 更新记录
### v1.0.2（2026-08-12）
- 修复测试/正式环境切换后旧Token失效导致收藏失败的问题
- 版本号自动填及更新记录

### v1.0.1（2026-08-12）
- 🐛 修复：新建/编辑书签时未自动解析域名，导致书签管理「域名」列空白（浏览器扩展收藏的链接受影响）
- 新增 `server/scripts/fix-link-domain.js` 一键修复脚本，可批量补全历史书签缺失的域名

### v1.0.0（2026-08-11）
- 🎉 首个正式版本：完整书签管理、多搜索引擎、链接巡检、访问统计、保险库、自动备份、多主题、浏览器扩展、双端适配

## 🤝 贡献

欢迎提交 Issue 或 Pull Request：

1. Fork 本项目
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送分支并提交 Pull Request

## 📧 联系

如有问题或建议，请在本仓库提交 Issue。
