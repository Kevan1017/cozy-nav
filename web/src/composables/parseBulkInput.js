/**
 * 批量粘贴书签输入解析
 * 支持格式（每行一条）：
 *  - 纯 URL：https://github.com
 *  - 标题在前：GitHub https://github.com
 *  - URL 在前：https://github.com GitHub
 *  - Markdown 链接：[GitHub](https://github.com)
 *  - 竖线分隔：GitHub|https://github.com
 */
import { pickRandom, BG_COLORS } from './useColor.js';

/** 从文本中提取第一个 http/https URL，未找到返回 null */
function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s，。；、'"（）()]+/i);
  return m ? m[0] : null;
}

/** 清理标题两端多余空白与标点 */
function cleanTitle(s) {
  return (s || '').replace(/^[\s，。；、'"（）()[\]:|]+|[\s，。；、'"（）()[\]:|]+$/g, '').trim();
}

/** 解析单行文本 → { name, url }，无法解析返回 null */
function parseLine(line) {
  const text = line.trim();
  if (!text) return null;

  // Markdown 链接：[标题](url)
  const md = text.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/i);
  if (md) return { name: cleanTitle(md[1]), url: md[2] };

  // 竖线分隔：标题|url 或 url|标题
  if (text.includes('|')) {
    const parts = text.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const a = extractUrl(parts[0]);
      const b = extractUrl(parts[1]);
      const url = a || b;
      if (url) {
        const title = parts[0] === url ? parts[1] : parts[0];
        return { name: cleanTitle(title), url };
      }
    }
  }

  // 通用：提取 URL，其余文本作标题
  const url = extractUrl(text);
  if (!url) return null;
  const before = cleanTitle(text.slice(0, text.indexOf(url)));
  const after = cleanTitle(text.slice(text.indexOf(url) + url.length));
  const name = before || after;
  return { name, url };
}

/**
 * 批量解析输入文本 → [{ name, url, avatar_text, avatar_color }]
 * 自动过滤空行与无法解析的行，并生成字母头像信息
 */
export function parseBulkInput(text) {
  const items = [];
  const lines = String(text || '').split('\n');
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const name = parsed.name || new URL(parsed.url).hostname.replace(/^www\./, '') || parsed.url;
    items.push({
      name,
      url: parsed.url,
      avatar_text: name.slice(0, 1).toUpperCase(),
      avatar_color: pickRandom(BG_COLORS),
    });
  }
  return items;
}
