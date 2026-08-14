<script setup>
/**
 * 书签条目：头像 + 名称 + 域名
 * 支持加密状态：锁定时显示锁图标，点击触发解锁
 * 头像优先显示 favicon，加载失败回退字母头像
 * 闲置标记：开启开关且超过 30 天未访问时，右上角显示时钟角标，悬停提示天数
 * 常用标记：开关开启且链接标记为常用时，名称末尾内联金色小星（所有视图模式统一）
 */
import { computed } from 'vue';
import FaviconImage from '../ui/FaviconImage.vue';
import { usePrefsStore } from '../../stores/prefs.js';
import { resolveColor } from '../../composables/useColor.js';
import { linkApi } from '../../api/link.js';

const props = defineProps({
  link: { type: Object, required: true },
  /** 保险库是否已解锁（已解锁时加密链接正常显示） */
  unlocked: { type: Boolean, default: false },
});

const prefsStore = usePrefsStore();

const emit = defineEmits(['open', 'unlock']);

/** 闲置天数（last_visited 为空表示无记录，不标记） */
const idleDays = computed(() => {
  if (!props.link.last_visited) return 0;
  const diff = Math.floor((Date.now() - new Date(props.link.last_visited).getTime()) / 86400000);
  return Math.max(diff, 0);
});

/** 是否标记为闲置：开关开启 + 有访问记录 + 闲置 ≥ 30 天（与域名显示开关无关） */
const showIdle = computed(() =>
  prefsStore.idleMarkEnabled && props.link.last_visited && idleDays.value >= 30
);

/** 角标悬浮提示文本 */
const idleTip = computed(() => `已 ${idleDays.value} 天未打开`);

/** 是否显示常用星标：开关开启 + 链接标记为常用 */
const showFav = computed(() => prefsStore.favoriteMarkEnabled && !!props.link.is_favorite);

/** 点击打开：先异步埋点记录访问，再打开链接 */
function handleOpen() {
  if (props.link.id) {
    linkApi.visit(props.link.id).catch(() => {});
  }
  emit('open', props.link.url);
}
</script>

<template>
  <!-- 加密链接占位（未解锁时显示） -->
  <div v-if="link.is_locked && !unlocked" class="lk lk-locked" @click="emit('unlock')">
    <div v-if="!prefsStore.noImage" class="av av-locked">🔒</div>
    <div class="txt">
      <div class="nm nm-locked">已加密</div>
      <div class="dm">点击解锁查看</div>
    </div>
  </div>

  <!-- 正常书签 -->
  <div v-else class="lk" :title="showIdle ? idleTip : undefined" @click="handleOpen">
    <span v-if="showIdle" class="idle-clock" :title="idleTip">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </span>
    <!-- 有 favicon：用 FaviconImage（含加载失败回退字母头像） -->
    <FaviconImage
      v-if="link.favicon_path && !prefsStore.noImage"
      :url="link.url"
      :domain="link.domain"
      :favicon-path="link.favicon_path"
      :avatar-text="link.avatar_text"
      :avatar-color="link.avatar_color"
      :size="32"
      :radius="11"
    />
    <!-- 无 favicon：直接内联字母头像（免去组件实例，600+ 链接时显著减负） -->
    <div
      v-else-if="!prefsStore.noImage"
      class="av"
      :style="{
        width: '32px',
        height: '32px',
        borderRadius: '11px',
        background: resolveColor(link.avatar_color)
      }"
    >{{ link.avatar_text }}</div>
    <div class="txt">
      <div class="nm">
        <span class="nm-text">{{ link.name }}</span>
        <span v-if="showFav" class="fav-star" title="常用书签">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.6-6.2 3.6 1.6-7L2 9.3l7.1-.7z" />
          </svg>
        </span>
      </div>
      <div v-if="prefsStore.showDomain" class="dm">{{ link.domain }}</div>
    </div>
  </div>
</template>

<style scoped>
.lk {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: clamp(9px, 2vw, 10px) clamp(9px, 2vw, 11px);
  border-radius: 15px;
  cursor: pointer;
  background: var(--link-bg);
  transition: all .2s;
  border: 1px solid transparent;
  min-height: 52px;
  overflow: hidden;
  position: relative;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.lk:hover {
  background: var(--link-hover, var(--card-solid));
  transform: translateY(-2px);
}

.lk:active {
  transform: scale(.97);
}

.av {
  width: clamp(30px, 7vw, 32px);
  height: clamp(30px, 7vw, 32px);
  border-radius: 11px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 字母头像使用 var(--app-font) 保持一致性 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(13px, 3vw, 14px);
  color: var(--on-pop);
  box-shadow: 0 4px 8px -4px rgba(0, 0, 0, .2);
}

.txt {
  flex: 1;
  min-width: 0;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.nm {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: clamp(12px, 2.8vw, 13.5px);
  font-weight: 600;
  color: var(--link-name, var(--ink));
  /* 1.1 太紧会裁掉黑体/宋体下 g 等字母的下伸部 */
  line-height: 1.35;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 名称文本：超长省略，为内联星标留出独立位置（不覆盖文本） */
.nm-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 常用书签星标：名称末尾内联小星（文本流内占位，不遮挡任何文字） */
.fav-star {
  flex: none;
  display: inline-flex;
  width: 13px;
  height: 13px;
  color: var(--link-fav);
}

.fav-star svg {
  width: 100%;
  height: 100%;
}

.dm {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: clamp(9.5px, 2.2vw, 11px);
  font-weight: 500;
  color: var(--link-domain, var(--soft));
  margin-top: 1px;
  /* 与 .nm 一致放宽行高，避免域名字母下伸部被裁切 */
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 闲置时钟角标：右上角小钟表图标（警示红），悬浮提示天数 */
.idle-clock {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--link-idle, var(--rose));
  background: color-mix(in oklab, var(--link-idle, var(--rose)) 16%, transparent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, .12);
  pointer-events: none;
}

.idle-clock svg {
  width: 12px;
  height: 12px;
}

/* 头像基础样式（字母头像与 FaviconImage 的 .favicon-img 视觉一致） */
.av {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(13px, 3vw, 14px);
  color: var(--on-pop);
  box-shadow: 0 4px 8px -4px rgba(0, 0, 0, .2);
  overflow: hidden;
}

/* 加密链接样式 */
.lk-locked {
  background: var(--link-lock-bg, var(--card-solid));
  border: 1px dashed var(--link-lock-border, var(--peach));
  opacity: .75;
}

.lk-locked:hover {
  border-color: var(--link-accent, var(--pop));
  opacity: 1;
  transform: translateY(-2px);
}

.av-locked {
  background: transparent !important;
  font-size: clamp(14px, 3.2vw, 16px);
  filter: grayscale(.3);
}

.nm-locked {
  color: var(--link-lock-text, var(--soft));
  font-style: italic;
}
</style>
