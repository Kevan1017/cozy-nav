#!/usr/bin/env node
/**
 * Git 异地备份配置体检脚本
 * 检查 4 项：仓库初始化 / 远程仓库关联 / .gitignore / 远程可达性
 *
 * 用法：
 *   cd d:\PersonHub\server
 *   node scripts/check-git-backup.mjs
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
/** 数据目录（git 仓库根目录） */
const DATA_DIR = join(__dirname, '../data');

/** 逐项检查结果收集 */
const results = [];
function report(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('=== Git 异地备份配置体检 ===\n');

// 1. data 目录是否为 git 仓库（是否存在 .git）
const repoOk = existsSync(join(DATA_DIR, '.git'));
report(
  'git 仓库已初始化',
  repoOk,
  repoOk ? DATA_DIR : `请先执行: git init (在 ${DATA_DIR} 目录下)`
);

// 2. 远程仓库 origin 是否已关联
let remotes = [];
if (repoOk) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', DATA_DIR, 'remote', '-v'], { timeout: 15000 });
    remotes = stdout.split('\n').filter(Boolean);
  } catch { /* 非 git 仓库时忽略 */ }
}
const origin = remotes.find((line) => line.includes('origin'));
report(
  '远程仓库 origin 已关联',
  !!origin,
  origin || '请执行: git remote add origin https://gitee.com/你的账号/cozy-nav-backup.git'
);

// 3. .gitignore 是否排除备份产物
const giPath = join(DATA_DIR, '.gitignore');
let giText = '';
if (existsSync(giPath)) {
  giText = readFileSync(giPath, 'utf8');
}
const ignoreOk = giText.includes('backups/') && giText.includes('favicons/.failed/');
report(
  '.gitignore 已排除备份产物',
  ignoreOk,
  ignoreOk ? 'backups/ + favicons/.failed/ 均已排除' : '缺少 backups/ 或 favicons/.failed/ 条目'
);

// 4. 远程仓库是否可达（尝试 ls-remote 探测网络 + 凭据）
let reachable = false;
if (origin) {
  try {
    await execFileAsync('git', ['-C', DATA_DIR, 'ls-remote', '--heads', 'origin'], { timeout: 20000 });
    reachable = true;
  } catch { /* 网络/凭据/仓库不存在等原因导致失败 */ }
}
report(
  '远程仓库可达（可推送）',
  reachable,
  reachable ? '网络与凭据正常' : '无法连接远程（检查网络 / Gitee 登录授权 / 仓库是否存在）'
);

// 汇总
const passCount = results.filter((r) => r.ok).length;
console.log(`\n${passCount}/${results.length} 项就绪`);
if (passCount === results.length) {
  console.log('🎉 配置完整，可到后台「数据管理 → 自动备份」填写地址并开启 Git 开关。');
} else {
  console.log('按上面 ❌ 的提示修复后，重新运行本脚本复查。');
}
