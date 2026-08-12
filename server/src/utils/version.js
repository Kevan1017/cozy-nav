/**
 * 版本信息工具
 * 从 Git 仓库读取当前提交信息，配合版本管理生成展示版本号（如 v1.0.0+abc1234）
 * 非 git 部署环境（如 zip 解压）时自动回退，不抛错
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** server/ 目录（本文件位于 server/src/utils/，向上三级） */
const SERVER_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/** 读取 package.json 主版本号 */
function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/** 执行 git 命令，失败返回空字符串（非 git 部署时安全回退） */
function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: SERVER_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

let cached = null;

/** 获取版本信息（首次调用后缓存，进程内接口复用同一结果） */
export function getVersionInfo() {
  if (cached) return cached;
  const version = readPackageVersion();
  const commit = git('rev-parse --short HEAD');
  const commitDate = git('log -1 --format=%cd --date=short');
  const commitMessage = git('log -1 --format=%s'); // 最近一次提交标题（后台更新记录自动带出）
  cached = {
    version,                                  // 主版本号，如 1.0.0
    commit,                                   // Git 短提交哈希，如 abc1234
    commitDate,                               // 最近提交日期
    commitMessage,                            // 最近一次提交标题
    environment: process.env.NODE_ENV || 'development', // 运行环境
    display: `v${version}${commit ? `+${commit}` : ''}`, // 展示用版本号
  };
  return cached;
}
