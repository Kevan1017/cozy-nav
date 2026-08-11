<script setup>
/**
 * 底部栏：版权 + 手写签名
 * 版权文案固定模板：Copyright ©{当前年份} {网站标题}. All Rights Reserved.
 * 网站标题可在后台「基本配置」中修改，标题带链接跳转首页
 */
import { computed } from 'vue';
import { usePrefsStore } from '../../stores/prefs.js';

const prefsStore = usePrefsStore();

/** 当前年份（自动跟随时间变化） */
const currentYear = new Date().getFullYear();

/** 版权链接文本：固定使用网站标题 */
const copyrightText = computed(() => prefsStore.siteTitle || '悦行');
</script>

<template>
  <div class="foot">
    <div class="l">
      <span class="copyright">
        Copyright ©{{ currentYear }}
        <a href="/" class="copy-link">{{ copyrightText }}</a>
        . All Rights Reserved.
      </span>
    </div>
    <span class="sig"> 一个 <span class="h">软乎乎</span> 的小角落 ♡</span>
  </div>
</template>

<style scoped>
.foot {
  margin-top: clamp(28px, 5vw, 44px);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: clamp(11px, 2.4vw, 13px);
  font-weight: 600;
  color: var(--foot-text, var(--soft));
  border-top: 1px dashed var(--foot-line, var(--rule));
  padding-top: 20px;
  opacity: 0;
  animation: bob .6s ease .85s forwards;
  /* 稳定容器 */
  contain: layout style;
}

.foot .sig {
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Caveat */
  font-family: 'Caveat', var(--app-font, cursive);
  font-weight: 600;
  color: var(--foot-sig, var(--ink));
  font-size: clamp(17px, 3vw, 20px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.foot .sig .h {
  color: var(--foot-accent, var(--pop));
}

.foot .l {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  white-space: nowrap;
}

/* 版权链接：继承默认文字色，悬停显示主题色 */
.copy-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  transition: color .2s ease;
}

.copy-link:hover {
  color: var(--foot-accent, var(--pop));
}

.foot .sep {
  opacity: .6;
}
</style>
