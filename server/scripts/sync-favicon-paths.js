/**
 * 一次性迁移脚本：将已缓存的 favicon 文件路径同步到数据库
 * 运行：node scripts/sync-favicon-paths.js
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../src/db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAVICON_DIR = join(__dirname, '..', 'data', 'favicons');

/**
 * 域名哈希：MD5 取前 16 位
 */
function hashDomain(domain) {
  return createHash('md5').update(domain).digest('hex').slice(0, 16);
}

/**
 * 检查 favicon 文件是否存在
 */
function faviconExists(domain) {
  const fileName = `${hashDomain(domain)}.png`;
  return existsSync(join(FAVICON_DIR, fileName));
}

// 获取所有 favicon_path 为 NULL 的链接
const links = db.prepare(
  `SELECT id, domain FROM links 
   WHERE favicon_path IS NULL AND deleted_at IS NULL 
   AND domain IS NOT NULL AND domain != ''`
).all();

console.log(`[迁移] 共发现 ${links.length} 条链接需要同步 favicon_path`);

let updated = 0;
let notFound = 0;

for (const link of links) {
  if (faviconExists(link.domain)) {
    const fileName = `${hashDomain(link.domain)}.png`;
    db.prepare('UPDATE links SET favicon_path = ? WHERE id = ?').run(fileName, link.id);
    updated++;
  } else {
    notFound++;
  }
}

console.log(`[迁移] 完成：更新 ${updated} 条，未找到缓存 ${notFound} 条`);
process.exit(0);