// 一次性修复脚本：为 domain 为空的书签补全域名
// 运行方式（在任意目录均可，脚本自动定位 server 根目录下的数据库）：
//   node scripts/fix-link-domain.js
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// 定位 server 根目录（scripts/ 的上一级），数据库在 server/data/cozy-nav.db
const serverRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = path.join(serverRoot, 'data', 'cozy-nav.db');

if (!fs.existsSync(dbPath)) {
  console.error(`未找到数据库文件：${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const rows = db.prepare("SELECT id, url FROM links WHERE domain IS NULL OR domain = ''").all();
const upd = db.prepare('UPDATE links SET domain = ? WHERE id = ?');

let ok = 0;
let fail = 0;
for (const r of rows) {
  try {
    const d = new URL(r.url).hostname;
    if (d) {
      upd.run(d, r.id);
      ok += 1;
    } else {
      fail += 1;
    }
  } catch {
    fail += 1;
  }
}

console.log(`[修复完成] 共 ${rows.length} 条待修复：成功 ${ok} 条，失败 ${fail} 条（URL 无法解析）`);
