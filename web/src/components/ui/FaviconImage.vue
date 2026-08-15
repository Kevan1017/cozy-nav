<script setup>
/**
 * Favicon 图片组件
 *
 * 策略：
 *  1. 有 favicon_path → 直接加载静态文件（/favicons/xxx.png），极快
 *  2. 无 favicon_path → 立即显示字母头像（零阻塞，不发任何请求）
 *  3. 暗色模式自动加半透明背板（通过 --fav-bg CSS 变量）
 *
 * 用法：
 *  <FaviconImage
 *    :favicon-path="link.favicon_path"
 *    :avatar-text="link.avatar_text"
 *    :avatar-color="link.avatar_color"
 *    :size="32" />
 */
import { ref, computed } from 'vue';
import { resolveColor } from '../../composables/useColor.js';

const props = defineProps({
  /** 书签 URL（用于提取域名，当 domain 未提供时使用） */
  url: { type: String, default: '' },
  /** 域名（优先使用，无则从 url 提取） */
  domain: { type: String, default: '' },
  /** 后端已存储的 favicon 文件名（如 'abc123.png'），有值时直接加载静态文件 */
  faviconPath: { type: String, default: '' },
  /** 字母头像文字（回退用） */
  avatarText: { type: String, default: '' },
  /** 字母头像背景色（回退用，支持 CSS 变量名或颜色值） */
  avatarColor: { type: String, default: '' },
  /** 头像尺寸 px（默认 32） */
  size: { type: Number, default: 32 },
  /** 圆角 px（默认 11） */
  radius: { type: Number, default: 11 },
});

/** 是否显示 favicon 图片（而非字母头像） */
const showFavicon = ref(!!props.faviconPath);
/** favicon 图片是否加载完成（加载期间用字母头像打底，避免图标位空白） */
const imgLoaded = ref(false);

/** favicon 图片地址 */
const faviconSrc = computed(() => {
  if (!showFavicon.value || !props.faviconPath) return '';
  return `/favicons/${props.faviconPath}`;
});
</script>

<template>
  <div
    class="favicon-img"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${radius}px`,
      /* 加载完成用 --fav-plate 背板（图标平铺视图下由外层声明为浅色块，与磁贴底拉开层次；
         其余视图不声明该变量则回退透明，行为不变）；加载前用字母头像底色打底 */
      background: imgLoaded ? 'var(--fav-plate, transparent)' : resolveColor(avatarColor)
    }"
  >
    <img
      v-if="showFavicon"
      :src="faviconSrc"
      class="fav-icon"
      alt=""
      loading="lazy"
      decoding="async"
      @load="imgLoaded = true"
      @error="showFavicon = false"
    >
    <!-- 图片加载完成前用字母头像打底，避免图标位空白闪烁 -->
    <span v-if="!imgLoaded" class="fav-av">{{ avatarText }}</span>
  </div>
</template>

<style scoped>
.favicon-img {
  flex: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(13px, 3vw, 14px);
  color: var(--on-pop);
  box-shadow: 0 4px 8px -4px rgba(0, 0, 0, .2);
  overflow: hidden;
  transition: background .2s;
}

/* 图片绝对定位覆盖在字母打底之上，加载完成前字母可见、加载完成后被图片盖住 */
.fav-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 60%;
  height: 60%;
  object-fit: contain;
  border-radius: var(--fav-radius, 4px);
  background: var(--fav-bg, transparent);
  padding: 1px;
  box-sizing: border-box;
}
</style>