import { h } from 'vue';
import FaviconAvatar from '../components/ui/FaviconAvatar.vue';
import { resolveColor } from './useColor.js';

/**
 * 表格单元格渲染函数（书签管理 / 分类管理共用）
 * 供 n-data-table 的 columns render 使用（h() 创建，需配合全局共享样式）
 */

/**
 * 渲染书签名称列：favicon 图标 + 名称（点击名称在新标签页打开链接）
 */
export function renderAvatar(link) {
  const hasUrl = !!link.url;
  const name = h(
    hasUrl ? 'a' : 'span',
    {
      href: hasUrl ? link.url : undefined,
      target: hasUrl ? '_blank' : undefined,
      rel: hasUrl ? 'noopener noreferrer' : undefined,
      title: link.name || undefined,
      class: 'link-cell-name',
      style: 'font-weight:600; color: var(--admin-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;',
    },
    link.name
  );
  return h('div', { class: 'link-cell' }, [
    h(FaviconAvatar, {
      faviconPath: link.favicon_path || '',
      avatarText: link.avatar_text || '',
      avatarColor: link.avatar_color || '',
    }),
    name,
  ]);
}

/** 渲染分类 Emoji 小色块（白底 + 斜切描边） */
export function renderEmoji(cat) {
  return h('span', {
    class: 'cat-emoji',
    style: { '--bgc': resolveColor(cat.bg_color) },
  }, cat.emoji || '🧭');
}
