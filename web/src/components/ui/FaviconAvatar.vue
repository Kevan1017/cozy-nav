<script setup>
/**
 * 后台列表名称前缀图标组件（PC 表格 / 移动端列表通用）
 * 有 favicon_path 显示 favicon 图片；图片加载失败或无则回退字母头像
 * 用法：
 *  <FaviconAvatar
 *    :favicon-path="link.favicon_path"
 *    :avatar-text="link.avatar_text"
 *    :avatar-color="link.avatar_color" />
 */
import { ref, computed, watch } from 'vue';
import { resolveColor } from '../../composables/useColor.js';

const props = defineProps({
  /** 后端已存储的 favicon 文件名（如 'abc123.png'） */
  faviconPath: { type: String, default: '' },
  /** 字母头像文字（回退用） */
  avatarText: { type: String, default: '' },
  /** 字母头像背景色（回退用，支持 CSS 变量名或颜色值） */
  avatarColor: { type: String, default: '' },
});

/** 是否显示 favicon 图片（加载失败时置 false 自动回退字母头像） */
const showFavicon = ref(!!props.faviconPath);
const src = computed(() => (showFavicon.value && props.faviconPath ? `/favicons/${props.faviconPath}` : ''));

function onImgError() {
  showFavicon.value = false;
}

// favicon 异步获取成功后 faviconPath 由空变为有值，需立即切换到图片显示（无需刷新页面）
watch(() => props.faviconPath, (val) => {
  showFavicon.value = !!val;
});
</script>

<template>
  <span class="av-wrap">
    <img
      v-if="showFavicon"
      :src="src"
      class="av-fav"
      alt=""
      loading="lazy"
      @error="onImgError"
    >
    <span
      v-else
      class="av"
      :style="{ '--avatar-color': resolveColor(avatarColor) }"
    >{{ avatarText || '?' }}</span>
  </span>
</template>

<style scoped>
.av-wrap {
  position: relative;
  width: 34px;
  height: 34px;
  flex: none;
}
.av {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -.5px;
  background: var(--avatar-color, var(--admin-accent));
  color: var(--admin-on-accent);
  box-shadow: 0 2px 6px -2px var(--admin-shadow);
  flex: none;
}
.av-fav {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  object-fit: contain;
  padding: 3px;
  box-sizing: border-box;
  background: var(--fav-bg, transparent);
  flex: none;
}
</style>
