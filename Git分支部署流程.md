# 悦行（cozy·nav）Git 分支部署流程手册

> 适用场景：本地写代码 → 推到测试分支 → 服务器测试版验证 → 合并正式分支 → 正式版上线。
> 主仓库用 **Gitee**（`origin`），GitHub（`github`）作为开源镜像仓库，额外给出推送方法。

---

## 一、架构总览

系统采用「双实例 · 双分支」模型：**演示版先行验证新功能，正式版保持稳定**。

| 分支 | 对应实例 | 职责 |
|------|----------|------|
| `master` | 自用版 `yue.lrevan.top`（端口 8000，进程 `yuehang-prod`） | 已验证的稳定代码 |
| `dev` | 演示版 `test1.lrevan.top`（端口 8001，进程 `yuehang-demo`） | 新功能先行测试 |

```
本地 dev 写代码 → push dev → demo 服务器拉取测试 → 通过 → merge 到 master → push master → 正式服务器拉取
```

远程仓库（已配置）：

```
origin  https://gitee.com/lrevan/cozy-nav.git      # 主仓库（Gitee 私有）
github  https://github.com/Kevan1017/cozy-nav.git  # 开源镜像（GitHub）
```

---

## 二、本地日常开发（默认在 dev 分支）

> 本地命令环境为 **PowerShell**（Windows）。

### 2.1 确认当前分支

```powershell
git branch --show-current
# 期望输出：dev
```

如果不在 dev 分支：

```powershell
git checkout dev
```

### 2.2 查看改动并提交

```powershell
git status                       # 查看改动文件
git add <具体文件路径...>         # 只添加本次改动的文件
git commit -m "feat: 功能描述" -m "- 改动点 1`n- 改动点 2"
git push origin dev              # 推送到 Gitee dev 分支
```

⚠️ 注意：

- 不要用 `git add -A` 全量添加，避免误提交 `.env`、`旧站导航-导入.html` 等临时/敏感文件（`.gitignore` 已排除大部分，但临时导入文件不在排除列表，需手动跳过）。
- 提交信息建议带前缀：`feat:`（新功能）/ `fix:`（修复 Bug）/ `chore:`（杂项）/ `docs:`（文档）。

---

## 三、demo 服务器（test1）拉取测试

> 服务器命令环境为 **Linux（宝塔终端）**，目录 `/www/wwwroot/yuehang-demo`。

```bash
cd /www/wwwroot/yuehang-demo

# ① 切换到 dev 分支并拉取最新代码
git fetch origin
git checkout dev          # 首次或不确定时执行；已在 dev 分支可跳过
git pull origin dev

# ② 后端有改动：重启即可（数据库迁移在启动时自动执行，无需手动操作）
pm2 restart yuehang-demo

# ③ 前端有改动：需重新构建（只改后端可跳过此步）
cd web && npm run build && cd ..

# ④ 重启后端（前端构建会输出到 dist，由 nginx 直接服务，无需重启 pm2；
#    但若同时改了后端，上面 ② 已重启过）
```

然后在浏览器打开 `https://test1.lrevan.top` 验证新功能，重点测试：

- 新增功能是否正常；
- 后台操作（增删改查）是否报错；
- 移动端布局是否有问题。

> 测试通过 → 进入第四章；测试有问题 → 回到本地继续改，重复第二章 → 第三章。

---

## 四、测试通过后合并到 master（本地操作）

```powershell
git checkout master     # 切换到正式分支
git merge dev           # 把 dev 合并进来
git push origin master  # 推送到 Gitee master
git checkout dev        # ★ 记得切回 dev，继续日常开发
```

> 若 `git merge dev` 提示冲突：`git status` 查看冲突文件 → 手动解决后 `git add <文件> && git commit`。
> 正常流程下 dev 是 master 的超集，不应出现冲突。

---

## 五、正式服务器（yue）上线

> 目录 `/www/wwwroot/yuehang`，进程 `yuehang-prod`。

```bash
cd /www/wwwroot/yuehang

# ① 拉取 master 最新代码
git pull origin master

# ② 后端有改动：重启（数据库自动迁移）
pm2 restart yuehang-prod

# ③ 前端有改动：重新构建
cd web && npm run build && cd ..
```

浏览器打开 `https://yue.lrevan.top` 确认线上功能正常。

---

## 六、GitHub 镜像仓库推送方法

GitHub 在国内直连不稳定，**推送前需配置代理**（例如 Clash 默认 7890 端口）：

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

推完可关闭代理（避免影响其他操作）：

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 6.1 按分支推送（推荐，与 Gitee 流程一致）

GitHub 默认分支名为 `main`，本地 `master` / `dev` 用「分支映射」方式推送：

```powershell
# 推送 dev（测试线）到 GitHub 的 dev 分支
git push github dev:dev

# 推送 master（正式线）到 GitHub 的 main 分支
git push github master:main
```

### 6.2 完整 GitHub 发布流程

```powershell
# 本地：合并 dev → master
git checkout master
git merge dev
git push origin master            # 先推 Gitee

# 推 GitHub
git push github master:main       # 正式线
git push github dev:dev           # 测试线

# 回到 dev 继续开发
git checkout dev
```

### 6.3 也可以走 GitHub Pull Request（网页操作）

1. 本地只推送分支：`git push github dev:dev`；
2. 打开 GitHub 仓库页面 → Pull requests → New pull request，选择 `dev` → `main`；
3. 点击 Merge 合并（合并后 GitHub 的 main 自动更新，本地无需再 push master）。

> 首次推送 GitHub 时若提示认证失败，需在 GitHub 设置 → Developer settings → Personal access tokens 生成 Token，推送时用户名填 GitHub 用户名、密码填 Token（也可用 GitHub CLI 或 SSH key，见 GitHub 官方文档）。

---

## 七、版本号与更新记录（每次发版必做）

1. **升级版本号**：编辑 `server/package.json` 的 `version` 字段（如 `1.0.1` → `1.0.2`）。
2. **必须重启后端**：版本号接口有进程内缓存，且 `node --watch` 不监听 package.json，**改完版本号后必须手动重启后端进程**（本地 Ctrl+C 重新 `npm run dev`；服务器 `pm2 restart yuehang-xxx`），否则页面版本号不变。
3. **写更新记录**：打开后台「网站设置 → ℹ️ 关于悦行」→「📝 更新记录」→「添加记录」，填写版本号和本次修复/新增内容（数据存数据库，随备份保留）。

> 版本号示例：后台「关于悦行」显示 `v1.0.1+2e40552`，其中 `2e40552` 为当前 Git 提交哈希，`git pull` 后自动更新，用于核对线上代码版本。

---

## 八、常见问题排查

| 现象 | 原因与解决 |
|------|-----------|
| `git pull` 提示「工作区不干净」 | 服务器上不应改代码。`git status` 查看，若是误改文件：`git checkout -- <文件>` 还原；若被 gitignore 排除的文件，忽略即可 |
| 页面版本号不更新 | 版本接口有缓存，改完 package.json 未重启后端。`pm2 restart yuehang-xxx` 或本地重启 `npm run dev` |
| 前端 `npm run build` 报 `.user.ini` 权限错误 | build 脚本已内置构建前自动清理 dist/.user.ini，若仍报错检查 dist 目录权限 |
| 服务器 `npm install` 404 | npm 镜像缺包（如 `@fontsource/noto-serif-sc`），需用官方源：`npm config set registry https://registry.npmjs.org` 后重装 |
| demo 测坏了 dev | 不影响 master 与正式版，本地改好重新 push dev 即可 |
| 新环境/新服务器首次拉取 | `git fetch origin && git checkout dev && git pull origin dev`（或 master 对应分支） |

---

## 九、一句话速查

```bash
# 本地
git checkout dev && git add <文件> && git commit -m "..." && git push origin dev

# demo 服务器（test1）
cd /www/wwwroot/yuehang-demo && git pull origin dev && pm2 restart yuehang-demo && cd web && npm run build && cd ..

# 本地合并发布
git checkout master && git merge dev && git push origin master && git checkout dev

# 正式服务器（yue）
cd /www/wwwroot/yuehang && git pull origin master && pm2 restart yuehang-prod && cd web && npm run build && cd ..

# GitHub 镜像（需代理）
git push github dev:dev && git push github master:main
```
