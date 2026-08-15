<script setup>
/**
 * 置顶书签横滑栏
 * - 无置顶时显示占位提示
 * - 单个置顶不撑满整行
 * - 头像优先显示 favicon，加载失败回退字母头像
 */
import FaviconImage from '../ui/FaviconImage.vue';
import { usePrefsStore } from '../../stores/prefs.js';
import { linkApi } from '../../api/link.js';

defineProps({
  links: { type: Array, default: () => [] },
});

const emit = defineEmits(['open']);
const prefsStore = usePrefsStore();

/** 点击置顶书签：先异步埋点记录访问，再打开链接（与分类书签 LinkItem 一致） */
function handleOpen(link) {
  if (link?.id) {
    linkApi.visit(link.id).catch(() => {});
  }
  emit('open', link.url);
}

/** 格式化序号 */
function rankText(index) {
  return String(index + 1).padStart(2, '0');
}
</script>

<template>
  <div class="pin" ref="pinEl">
    <div class="pin-head">
      <div class="lab">
        <span class="e">📌</span>置顶 · 最常访问
      </div>
      <span class="sub">— 你最离不开的几个</span>
      <span class="ln" />
    </div>

    <!-- 有置顶链接 -->
    <div v-if="links.length > 0" class="pin-row">
      <div
        v-for="(link, index) in links"
        :key="link.id"
        class="pin-card"
        @click="handleOpen(link)"
      >
        <div class="top-row">
          <FaviconImage
            v-if="!prefsStore.noImage"
            :url="link.url"
            :domain="link.domain"
            :favicon-path="link.favicon_path"
            :avatar-text="link.avatar_text"
            :avatar-color="link.avatar_color"
            :size="30"
            :radius="10"
          />
          <span class="rank">{{ rankText(index) }}</span>
        </div>
        <div class="nm">{{ link.name }}</div>
      </div>
    </div>

    <!-- 无置顶链接：占位提示 -->
    <div v-else class="pin-empty">
      <span class="empty-icon">📌</span>
      <span class="empty-text">暂无置顶书签</span>
    </div>
  </div>
</template>

<style scoped>
.pin {
  margin-bottom: clamp(10px, 1.5vw, 26px);
  opacity: 0;
  animation: bob .7s ease .05s forwards;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.pin-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.pin-head .lab {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(13px, 2.6vw, 15px);
  color: var(--pin-title, var(--ink));
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pin-head .lab .e {
  font-size: 16px;
  flex-shrink: 0;
  /* 图钉稍微往里缩进，靠近「置顶」文字 */
  margin-left: 2px;
}

.pin-head .sub {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Caveat', var(--app-font, cursive);
  font-size: 15px;
  color: var(--pin-sub, var(--soft));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pin-head .ln {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--pin-line, var(--rule)), transparent);
}

/* auto-fill：单个链接不撑满，保持原始宽度 */
.pin-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(100px, 22vw, 138px), 1fr));
  gap: 10px;
  padding: 4px 2px 8px;
}

.pin-card {
  background: var(--pin-card, var(--card));
  backdrop-filter: blur(8px);
  border-radius: 18px;
  padding: 13px 12px;
  cursor: pointer;
  /* 强制独立合成层：稳定 backdrop 采样，缓解滚动时毛玻璃卡片白屏 */
  transform: translateZ(0);
  transition: transform .2s, box-shadow .2s;
  position: relative;
  overflow: hidden;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.pin-card:hover {
  /* 保留 translateZ(0)，hover 期间合成层不降级 */
  transform: translateY(-4px) translateZ(0);
  box-shadow: 0 16px 30px -20px var(--pin-shadow, var(--shadow));
}

.pin-card:active {
  transform: scale(.97) translateZ(0);
}

.top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}

.av {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: 13px;
  color: var(--on-pop);
  box-shadow: 0 4px 8px -4px rgba(0, 0, 0, .2);
  flex: none;
}

.rank {
  margin-left: auto;
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: 'Caveat', var(--app-font, cursive);
  font-weight: 600;
  font-size: 18px;
  color: var(--pin-rank, var(--soft));
}

.nm {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: 13px;
  font-weight: 600;
  color: var(--pin-name, var(--ink));
  /* 1.1 太紧会裁掉黑体/宋体下 g 等字母的下伸部 */
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 空状态占位 */
.pin-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: clamp(16px, 3vw, 24px);
  border-radius: 18px;
  background: var(--pin-card, var(--card));
  backdrop-filter: blur(8px);
  /* 强制独立合成层：稳定 backdrop 采样，缓解滚动白屏 */
  transform: translateZ(0);
  border: 1px dashed var(--pin-empty-border, var(--rule));
}

.empty-icon {
  font-size: clamp(18px, 4vw, 22px);
  filter: grayscale(.4);
  opacity: .6;
}

.empty-text {
  font-size: clamp(12px, 2.6vw, 14px);
  font-weight: 500;
  color: var(--pin-empty-text, var(--soft));
}
</style>
