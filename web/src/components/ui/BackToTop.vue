<script setup>
/**
 * 返回顶部按钮：滚动超过阈值后右下角固定悬浮显示，点击平滑回到顶部
 * 位置固定，不做动态上移；遮挡问题由页脚底部留白解决（见 Footer.vue）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

/** 滚动超过该像素后显示 */
const SHOW_AFTER = 420;

const visible = ref(false);
let ticking = false;

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    visible.value = window.scrollY > SHOW_AFTER;
    ticking = false;
  });
}

/** 平滑回到顶部 */
function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <transition name="btt-fade">
    <button
      v-show="visible"
      class="btt"
      title="回到顶部"
      aria-label="回到顶部"
      @click="scrollTop"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </transition>
</template>

<style scoped>
.btt {
  position: fixed;
  right: clamp(14px, 2.5vw, 24px);
  /* 底部抬高：让出页脚区域，页脚贴底显示、按钮悬浮其上方不遮挡 */
  bottom: clamp(72px, 12vw, 96px);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--topbar-pill-border, var(--rule, rgba(0, 0, 0, .08)));
  background: color-mix(in oklab, var(--card, #fff) 86%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: var(--pop, #d97706);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 60;
  padding: 0;
  box-shadow: 0 12px 28px -14px var(--shadow, rgba(0, 0, 0, .25));
  transition: transform .25s ease, box-shadow .25s ease;
}

.btt:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px -14px var(--pop, #d97706);
}

.btt svg {
  width: 22px;
  height: 22px;
}

/* 显隐过渡 */
.btt-fade-enter-active,
.btt-fade-leave-active {
  transition: opacity .25s ease, transform .25s ease;
}

.btt-fade-enter-from,
.btt-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 480px) {
  .btt {
    width: 42px;
    height: 42px;
  }
}
</style>
