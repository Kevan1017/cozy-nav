/**
 * 重复链接检测 · Mock 测试脚本
 *
 * 运行方式：node scripts/test-url-normalize.mjs
 *
 * 说明：
 * - 直接 import 真实的 normalizeUrl 工具函数
 * - 用内存数组模拟数据库（mockLinks），复刻 linkController 中
 *   createLink / updateLink 的判重逻辑（真实 SQL 的简化等价版）
 * - 不依赖后端服务器，纯本地可运行
 */
import { normalizeUrl } from '../src/utils/urlNormalize.js';

let passed = 0;
let failed = 0;

/** 断言工具 */
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}\n     期望: ${JSON.stringify(expected)}\n     实际: ${JSON.stringify(actual)}`);
  }
}

/* ==================== 一、normalizeUrl 规则测试 ==================== */

console.log('\n【1】URL 规范化规则');

// 基础：hostname 小写 + 去尾斜杠
check('hostname 小写 + 去尾斜杠',
  normalizeUrl('https://Example.COM/path/'),
  'https://example.com/path');

// 默认端口去除（80 / 443）
check('去默认端口 http:80',
  normalizeUrl('http://x.com:80/a'),
  'http://x.com/a');
check('去默认端口 https:443',
  normalizeUrl('https://x.com:443/a'),
  'https://x.com/a');
check('保留非默认端口',
  normalizeUrl('http://x.com:8080/a'),
  'http://x.com:8080/a');

// 协议大写统一 + 默认首页（index.html → 根路径 '/'）
check('协议大写统一 + 去默认首页',
  normalizeUrl('HTTP://X.COM/index.html'),
  'http://x.com/');
check('去 index.php 默认首页',
  normalizeUrl('https://x.com/index.php'),
  'https://x.com/');
check('保留非默认首页文件名',
  normalizeUrl('https://x.com/about.html'),
  'https://x.com/about.html');

// 根路径：保留 '/'
check('根路径保留斜杠',
  normalizeUrl('https://x.com/'),
  'https://x.com/');

// 查询参数：排序 + 去跟踪参数
check('查询参数排序 + 去跟踪参数',
  normalizeUrl('https://x.com/p?b=2&a=1&utm_source=wechat&fbclid=abc'),
  'https://x.com/p?a=1&b=2');

// 锚点去除
check('去锚点',
  normalizeUrl('https://x.com/p#section'),
  'https://x.com/p');

// http 与 https 视为不同站（保守）
check('http 与 https 不合并',
  normalizeUrl('http://x.com/p') !== normalizeUrl('https://x.com/p'),
  true);

// 非法 / 非 http(s) 协议返回 null
check('非 http(s) 协议返回 null',
  normalizeUrl('javascript:void(0)'),
  null);
check('非法 URL 返回 null',
  normalizeUrl('不是网址'),
  null);
check('空值返回 null',
  normalizeUrl(''),
  null);

/* ==================== 二、mock 数据库 + 判重逻辑 ==================== */

console.log('\n【2】Mock 判重逻辑（模拟 createLink / updateLink）');

/** 内存 mock 表：{ id, name, url, url_normalized, deleted_at } */
const mockLinks = [];
let seq = 0;

/** 模拟 createLink 判重段 */
function mockCreate(payload) {
  const normalized = normalizeUrl(payload.url);
  if (normalized) {
    const dup = mockLinks.find((l) => l.url_normalized === normalized && !l.deleted_at);
    if (dup && !payload.force) {
      return { code: 409, data: { duplicate: { id: dup.id, name: dup.name, url: dup.url } } };
    }
  }
  const link = { id: ++seq, name: payload.name, url: payload.url, url_normalized: normalized, deleted_at: null };
  mockLinks.push(link);
  return { code: 200, data: { id: link.id } };
}

/** 模拟 updateLink 判重段（排除自身） */
function mockUpdate(id, payload) {
  const existing = mockLinks.find((l) => l.id === id);
  if (!existing) return { code: 404 };
  const finalUrl = payload.url ?? existing.url;
  const normalized = normalizeUrl(finalUrl);
  if (normalized) {
    const dup = mockLinks.find((l) => l.url_normalized === normalized && !l.deleted_at && l.id !== id);
    if (dup && !payload.force) {
      return { code: 409, data: { duplicate: { id: dup.id, name: dup.name, url: dup.url } } };
    }
  }
  existing.url = payload.url ?? existing.url;
  existing.url_normalized = normalized;
  existing.name = payload.name ?? existing.name;
  return { code: 200, data: { id: existing.id } };
}

// 场景 1：基础创建 + 变体命中重复
const r1 = mockCreate({ name: 'GitHub', url: 'https://github.com/' });
check('创建基础书签返回 200', r1.code, 200);

const r2 = mockCreate({ name: 'GitHub 副本', url: 'HTTPS://GITHUB.COM:443/index.html' });
check('变体创建命中重复返回 409', r2.code, 409);
check('409 附带重复书签信息', r2.data.duplicate.name, 'GitHub');

// 场景 2：force 强制保存
const r3 = mockCreate({ name: 'GitHub 副本', url: 'https://github.com/index.html', force: true });
check('force=true 允许保存返回 200', r3.code, 200);

// 场景 3：不同路径不冲突
const r4 = mockCreate({ name: 'GitHub 文档', url: 'https://github.com/docs' });
check('不同路径不判重返回 200', r4.code, 200);

// 场景 4：update 排除自身（对唯一地址的书签改名，URL 不变）
const r5 = mockUpdate(r4.data.id, { name: 'GitHub 文档-改名' });
check('编辑自身（排除自身）返回 200', r5.code, 200);

// 场景 5：update 改成他人地址
const r6 = mockUpdate(r4.data.id, { name: '改成根地址', url: 'https://github.com/' });
check('编辑为他人地址返回 409', r6.code, 409);

// 场景 6：软删除不参与判重（软删唯一地址后重建）
const r7a = mockCreate({ name: '待软删书签', url: 'https://deleted-test.example.com/' });
mockLinks.find((l) => l.id === r7a.data.id).deleted_at = '2026-08-10T00:00:00.000Z';
const r7 = mockCreate({ name: '软删后重建', url: 'https://deleted-test.example.com/' });
check('软删除记录不参与判重返回 200', r7.code, 200);

// 场景 7：无法规范化的 URL 跳过判重
const r8 = mockCreate({ name: 'javascript 书签', url: 'javascript:alert(1)' });
check('非 http(s) 跳过判重返回 200', r8.code, 200);
const r9 = mockCreate({ name: '同名 javascript 书签', url: 'javascript:alert(2)' });
check('非法 URL 互不判重', r9.code, 200);

// 场景 8：跟踪参数被剔除后命中重复
const r10 = mockCreate({ name: '带跟踪参数', url: 'https://github.com/?utm_source=ad&utm_medium=banner' });
check('去跟踪参数后命中重复返回 409', r10.code, 409);

// 场景 9：查询参数排序后仍视为不同（仅排序不删除）
const r11 = mockCreate({ name: '带真实查询参数', url: 'https://github.com/search?q=vue&type=repo' });
check('非跟踪查询参数保留不判重返回 200', r11.code, 200);

// 场景 10：http/https 视为不同
const r12 = mockCreate({ name: 'http 版', url: 'http://github.com/' });
check('http 与 https 不判重返回 200', r12.code, 200);

/* ==================== 汇总 ==================== */

console.log(`\n========================================`);
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
