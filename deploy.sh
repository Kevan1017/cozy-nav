#!/bin/bash
# ============================================
# 悦行 一键部署脚本
# 用法：bash deploy.sh <版本号>
# 示例：bash deploy.sh 0.7.0
# ============================================

set -e

VERSION=${1:-}
if [ -z "$VERSION" ]; then
  echo "用法: bash deploy.sh <版本号>"
  echo "示例: bash deploy.sh 0.7.0"
  exit 1
fi

echo "========== 悦行 部署 v$VERSION =========="

# 1. 更新版本号
echo "[1/6] 更新版本号..."
node -e "
const fs = require('fs');
const path = require('path');
const files = [
  'web/package.json',
  'server/package.json',
  'web/src/version.js'
];
files.forEach(f => {
  const fp = path.resolve(f);
  let content = fs.readFileSync(fp, 'utf-8');
  if (f.endsWith('.json')) {
    const pkg = JSON.parse(content);
    pkg.version = '$VERSION';
    fs.writeFileSync(fp, JSON.stringify(pkg, null, 2) + '\n');
  } else {
    content = content.replace(/version = '[^']+'/, \"version = '$VERSION'\");
    fs.writeFileSync(fp, content);
  }
  console.log('  ✓', f);
});
"

# 2. Git 提交 + 打标签
echo "[2/6] Git 提交 + 打标签..."
git add -A
git commit -m "chore: bump version to v$VERSION"
git tag "v$VERSION"

# 3. 前端构建
echo "[3/6] 前端构建..."
cd web
npm run build
cd ..

# 4. 推送代码
echo "[4/6] 推送到远程仓库..."
git push origin main --tags

# 5. 服务器端拉取 + 重启（在服务器上执行）
echo "[5/6] 部署到服务器..."
echo "  在服务器上执行："
echo "    cd /path/to/yuehang"
echo "    git pull"
echo "    cd server && npm install && pm2 restart yuehang-server"
echo "    cd ../web && npm run build"
echo "    # nginx 自动指向 web/dist/"

# 6. 完成
echo "[6/6] 完成 ✓"
echo ""
echo "  前端: http://your-server"
echo "  后端健康检查: http://your-server/api/health"
echo "  版本: v$VERSION"
