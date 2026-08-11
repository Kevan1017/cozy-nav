/**
 * Git 异地备份工具
 * 将 server/data 目录作为 git 仓库（.gitignore 排除 backups/ 与 .failed 缓存），
 * 每天本地备份完成后执行 add/commit/push，把数据库 + favicons + logo 推到
 * 私有远程仓库（建议 Gitee，国内服务器访问稳定）。
 * - 凭据走系统 Git Credential Manager / SSH Key，不写入代码
 * - 推送失败只记日志，绝不抛错影响备份主流程
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
/** 数据目录（作为 git 仓库根目录） */
const DATA_DIR = join(__dirname, '../../data');
/** 每条 git 命令超时时间（ms） */
const GIT_TIMEOUT = 60000;

/** 是否已初始化 git 仓库（存在 .git 目录） */
export function isGitRepoReady() {
  return existsSync(join(DATA_DIR, '.git'));
}

/**
 * 推送数据目录到远程 git 仓库
 * @param {object} opts
 * @param {string} opts.remote - 远程仓库地址
 * @param {string} opts.branch - 分支名（默认 main）
 * @returns {Promise<{pushed:boolean, reason?:string}>}
 */
export async function pushToGit({ remote, branch = 'main' } = {}) {
  if (!remote) return { pushed: false, reason: '未配置 Git 仓库地址' };
  if (!isGitRepoReady()) {
    return { pushed: false, reason: 'data 目录尚未初始化 git 仓库（需手动 git init）' };
  }

  // commit 身份：优先 .env 的 GIT_USER/GIT_EMAIL，缺省用本地标识（避免依赖全局 git 配置）
  const userName = process.env.GIT_USER || 'cozy-nav';
  const userEmail = process.env.GIT_EMAIL || 'cozy-nav@local';

  try {
    await execFileAsync('git', ['-C', DATA_DIR, 'add', '-A'], { timeout: GIT_TIMEOUT });
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [备份] [Git] [失败] git add: ${err.message}`);
    return { pushed: false, reason: 'git add 失败' };
  }

  try {
    // nothing to commit 时 git 退出码为 1 且提示输出在 stdout（Windows/Linux 均在 stdout），视为成功跳过
    await execFileAsync(
      'git', ['-C', DATA_DIR, '-c', `user.name=${userName}`, '-c', `user.email=${userEmail}`,
        'commit', '-m', `backup ${new Date().toLocaleString('zh-CN')}`],
      { timeout: GIT_TIMEOUT }
    );
  } catch (err) {
    const msg = String(err?.stderr || err?.stdout || err?.message || '');
    if (msg.includes('nothing to commit')) {
      return { pushed: true, reason: '无变化，跳过提交' };
    }
    console.log(`[${new Date().toISOString()}] [备份] [Git] [失败] git commit: ${msg.slice(0, 500)}`);
    return { pushed: false, reason: `git commit 失败：${msg.slice(0, 120)}` };
  }

  // 同步远程地址：后台可随时换仓库，这里确保 origin 始终指向配置的最新地址
  //（否则本地 origin 仍指向旧仓库，换仓库后推送会跑偏）
  try {
    await execFileAsync('git', ['-C', DATA_DIR, 'remote', 'set-url', 'origin', remote], { timeout: GIT_TIMEOUT });
  } catch {
    // remote 尚不存在（用户未手动 git remote add）→ 自动创建
    try {
      await execFileAsync('git', ['-C', DATA_DIR, 'remote', 'add', 'origin', remote], { timeout: GIT_TIMEOUT });
    } catch (err) {
      console.log(`[${new Date().toISOString()}] [备份] [Git] [失败] 设置远程地址失败: ${err.message}`);
      return { pushed: false, reason: '无法设置 git 远程地址（data 目录未初始化 git 仓库？）' };
    }
  }

  try {
    // 用 HEAD:branch 推送：不依赖本地默认分支名（git init 可能建的是 master 而非 main）
    await execFileAsync('git', ['-C', DATA_DIR, 'push', 'origin', `HEAD:${branch}`], { timeout: GIT_TIMEOUT });
  } catch (err) {
    const msg = String(err?.stderr || err?.stdout || err?.message || '');
    console.log(`[${new Date().toISOString()}] [备份] [Git] [失败] git push: ${msg.slice(0, 500)}`);
    // 常见失败：首次未授权 / 远程仓库已有内容导致 rejected
    if (msg.includes('rejected')) {
      return { pushed: false, reason: '远程仓库已有内容，git push 被拒绝。请先在 Gitee 清空仓库或手动 git pull --allow-unrelated-histories' };
    }
    if (msg.toLowerCase().includes('auth') || msg.includes('Could not read Username')) {
      return { pushed: false, reason: '推送需要授权：请先在服务器终端手动执行一次 git push 完成 Gitee 登录授权' };
    }
    return { pushed: false, reason: `git push 失败：${msg.slice(0, 120)}` };
  }

  console.log(`[${new Date().toISOString()}] [备份] [Git] [成功] 已推送到 ${remote} (${branch})`);
  return { pushed: true };
}
