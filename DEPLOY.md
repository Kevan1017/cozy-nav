# 悦行 部署方案

## 一、版本号管理

版本号统一在三个位置维护（deploy.sh 自动同步）：

| 文件 | 作用 |
|---|---|
| `web/package.json` | 前端版本号，构建时注入 |
| `server/package.json` | 后端版本号，健康检查接口返回 |
| `web/src/version.js` | 前端运行时版本号，Footer 显示 |

## 二、升级版本流程

### 开发机上执行：
```bash
# 一键升级到 0.7.0（自动同步三个文件 + git commit + tag + 前端构建）
bash deploy.sh 0.7.0
```

### 手动升级（不用脚本）：
```bash
# 1. 改版本号
# web/package.json: "version": "0.7.0"
# server/package.json: "version": "0.7.0"  
# web/src/version.js: export const version = '0.7.0'

# 2. 提交 + 打标签
git add -A
git commit -m "feat: 新增 XX 功能，升级到 v0.7.0"
git tag v0.7.0
git push origin main --tags

# 3. 前端构建
cd web && npm run build && cd ..
```

## 三、服务器部署

### 服务器目录结构
```
/var/www/yuehang/
├── web/              # 前端
│   ├── dist/         # 构建产物
│   └── package.json
├── server/           # 后端
│   ├── src/
│   ├── data/         # SQLite 数据库
│   └── package.json
└── .env              # 环境变量
```

### 首次部署
```bash
# 服务器上
cd /var/www
git clone https://github.com/your-name/yuehang.git
cd yuehang

# 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 设置 PORT、JWT_SECRET

# 安装依赖
cd server && npm install && cd ../web && npm install

# 前端构建
cd web && npm run build

# PM2 启动后端
pm2 start server/src/app.js --name yuehang-server
pm2 save

# Nginx 配置（见下方）
```

### Nginx 配置
```nginx
server {
  listen 80;
  server_name your-domain.com;

  # 前端静态文件
  root /var/www/yuehang/web/dist;
  index index.html;

  # 前端 SPA 路由
  location / {
    try_files $uri $uri/ /index.html;
    # 静态资源强缓存（文件名含 hash，可长期缓存）
    location ~* \.(js|css|svg|png|jpg|ico|woff2?)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
  }

  # API 反向代理
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 日常升级（服务器上执行）
```bash
cd /var/www/yuehang

# 拉取最新代码
git pull
git checkout tags/v0.7.0   # 切换到指定版本（可选）

# 后端：新依赖安装 + 重启
cd server && npm install && pm2 restart yuehang-server && cd ..

# 前端：重新构建
cd web && npm run build && cd ..

# 刷新浏览器即可看到新版本
```

## 四、版本检查机制

### 自动提示刷新
- 浏览器打开页面时，`initVersionCheck()` 对比当前版本和本地缓存版本
- 后端升级后，用户下次访问会看到底部"🎉 新版本 vX.X.X 已就绪"提示
- 点击提示条 → 刷新页面 → 加载新版本

### 后端版本检查
- `GET /api/health` 返回 `{ version: "0.7.0" }`
- 前端可通过 `checkVersionNow()` 主动检查

### 缓存策略
- 构建产物文件名含 hash（如 `index-a1b2c3d4.js`）
- 版本升级 → hash 变化 → 浏览器自动加载新文件
- Nginx 静态资源设 1 年强缓存 + immutable

## 五、回滚

```bash
# 服务器上
cd /var/www/yuehang
git checkout tags/v0.6.3   # 回退到上一个版本
cd server && npm install && pm2 restart yuehang-server
cd ../web && npm run build
```

## 六、版本号规范

| 版本号 | 含义 | 示例 |
|---|---|---|
| MAJOR.MINOR.PATCH | 主版本.次版本.修订号 | 0.6.3 |
| MAJOR +1 | 架构大改，不兼容旧版 | 1.0.0 |
| MINOR +1 | 新功能，向下兼容 | 0.7.0 |
| PATCH +1 | Bug 修复，向下兼容 | 0.6.4 |
