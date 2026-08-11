<script setup>
/**
 * 分类快捷导航条：sticky 横排分类胶囊
 * - 点击胶囊平滑滚动定位到对应分类
 * - 滚动时自动高亮当前所在分类
 * - 分类过多时支持左右箭头横向滚动（滚动条隐藏，箭头替代）
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

const props = defineProps({
  categories: { type: Array, default: () => [] },
});

/** 当前高亮的分类 id */
const activeId = ref(null);

/** 导航条滚动容器 */
const navEl = ref(null);
/** 是否到达左右边缘（用于禁用箭头） */
const atStart = ref(true);
const atEnd = ref(false);
/** 内容是否溢出（决定是否显示箭头与边缘渐变） */
const hasOverflow = ref(false);
/** 鼠标是否悬停在导航条上（悬停时暂停自动滚动，避免与手动横向滚动/箭头冲突） */
const navHovering = ref(false);

/** 分类卡片元素缓存（id → element），避免滚动高频遍历时反复 getElementById */
const catEls = new Map();

/** 滚动定位时吸顶偏移：导航条高度 + 留白（与卡片 scroll-margin-top 保持一致） */
const SCROLL_MARGIN = 96;

let ticking = false;

/** 滚动监听：取最后一个顶部已越过偏移线的分类作为当前分类 */
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    // 偏移线加 2px 容差，避免定位刚好落在卡片顶边时误清高亮
    const offset = window.scrollY + SCROLL_MARGIN + 2;
    let current = null;
    for (const cat of props.categories) {
      const el = catEls.get(cat.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top + window.scrollY <= offset) {
        current = cat.id;
      }
    }
    // 已滚动到底部时，末尾分类可能无法到达偏移线，直接高亮最后一个分类
    if (!current && props.categories.length) {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled >= total - 4) {
        current = props.categories[props.categories.length - 1].id;
      }
    }
    const prev = activeId.value;
    activeId.value = current;
    // 活动分类变化时，自动横向滚动导航条让当前分类胶囊可见（免点箭头）
    if (current && current !== prev) ensureActiveVisible(current);
    ticking = false;
  });
}

/** 当前活动胶囊是否完全在导航条可视范围内 */
function isChipVisible(chipEl) {
  const nav = navEl.value;
  if (!nav || !chipEl) return false;
  const navRect = nav.getBoundingClientRect();
  const chipRect = chipEl.getBoundingClientRect();
  return chipRect.left >= navRect.left && chipRect.right <= navRect.right;
}

/** 自动横向滚动导航条，使指定分类胶囊可见（页面滚动跟随，免点箭头）
 *  用 data-id 精确定位，不依赖 active class 的异步 DOM 更新时机
 *  inline: nearest 只做最小横向滚动露出胶囊；block: nearest 导航条在视口内不触发页面纵向跳动 */
function ensureActiveVisible(id) {
  const nav = navEl.value;
  if (!nav || navHovering.value || id == null) return;
  const chip = nav.querySelector(`.cat-chip[data-id="${id}"]`);
  if (!chip || isChipVisible(chip)) return;
  chip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

/** 点击分类胶囊 → 平滑滚动定位（导航条同步滚动到该胶囊可见） */
function scrollToCat(id) {
  activeId.value = id;
  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  ensureActiveVisible(id);
}

/* ---------- 横向滚动箭头 ---------- */

/** 更新左右边缘状态（是否可继续滚动） */
function updateArrowState() {
  const el = navEl.value;
  if (!el) return;
  hasOverflow.value = el.scrollWidth > el.clientWidth + 2;
  atStart.value = el.scrollLeft <= 2;
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
}

/** 箭头点击：横向滚动一段距离（到边缘时不滚动，避免穿透下方胶囊） */
function scrollNavBy(direction) {
  const el = navEl.value;
  if (!el) return;
  if ((direction < 0 && atStart.value) || (direction > 0 && atEnd.value)) return;
  el.scrollBy({ left: direction * 260, behavior: 'smooth' });
}

/** 重建分类元素缓存（分类卡片渲染完成后调用） */
function rebuildCatEls() {
  catEls.clear();
  for (const cat of props.categories) {
    const el = document.getElementById(`cat-${cat.id}`);
    if (el) catEls.set(cat.id, el);
  }
}

/** 悬停进入：暂停自动横向滚动，避免与手动滚动/箭头冲突 */
const onNavEnter = () => { navHovering.value = true; };
/** 悬停离开：恢复自动横向滚动 */
const onNavLeave = () => { navHovering.value = false; };

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  // 数据到位后组件才挂载，navEl 必然存在；初始化延迟到 DOM 稳定（双 rAF）再计算
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rebuildCatEls();
    onScroll();
    updateArrowState();
  }));
  const nav = navEl.value;
  nav?.addEventListener('scroll', updateArrowState, { passive: true });
  nav?.addEventListener('mouseenter', onNavEnter);
  nav?.addEventListener('mouseleave', onNavLeave);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  const nav = navEl.value;
  nav?.removeEventListener('scroll', updateArrowState);
  nav?.removeEventListener('mouseenter', onNavEnter);
  nav?.removeEventListener('mouseleave', onNavLeave);
});

// 分类数组变化（首次加载 / 增删）时重建元素缓存并重判箭头状态
// 用 nextTick：DOM 更新后、绘制前完成计算，保证箭头/遮罩与导航条同帧出现，无二次闪烁
watch(() => props.categories, () => {
  nextTick(() => {
    rebuildCatEls();
    updateArrowState();
    // 初始/变化后把当前高亮分类胶囊滚入导航条可见区
    if (activeId.value != null) ensureActiveVisible(activeId.value);
  });
});
</script>

<template>
  <div v-if="categories.length >= 4" class="cat-nav-shell" :class="{ 'has-overflow': hasOverflow }">
    <div class="cat-nav-anim">
      <button
        class="nav-arrow prev"
        :class="{ 'at-edge': atStart }"
        type="button"
        aria-label="查看前面的分类"
        @click="scrollNavBy(-1)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <nav class="cat-nav" ref="navEl" aria-label="分类导航">
        <button
          v-for="cat in categories"
          :key="cat.id"
          :data-id="cat.id"
          class="cat-chip"
          :class="{ active: activeId === cat.id }"
          @click="scrollToCat(cat.id)"
        >
          <span class="chip-emoji">{{ cat.emoji }}</span>
          <span class="chip-name">{{ cat.name }}</span>
        </button>
      </nav>
      <button
        class="nav-arrow next"
        :class="{ 'at-edge': atEnd }"
        type="button"
        aria-label="查看后面的分类"
        @click="scrollNavBy(1)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ========== 导航条外层（sticky 吸顶 + 相对定位给箭头让位） ========== */
.cat-nav-shell {
  position: sticky;
  top: 10px;
  z-index: 40;
  margin-bottom: clamp(14px, 2.5vw, 20px);
}

/* 入场动画：与分类卡片一致的 bob 动效
   both：挂载即保持首帧透明再淡入，避免"先显示→动画开始突然消失→再淡入"的闪烁
   （数据到位后组件才挂载，从空白直接 bob 淡入）
   延迟 .05s + 时长 .6s：与 TopBar/PinStrip/分类卡片保持同一节奏，避免导航条单独抢先出现 */
.cat-nav-anim {
  animation: bob .6s ease .05s both;
}

/* ========== 导航条滚动容器 ========== */
.cat-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: color-mix(in oklab, var(--card, #fff) 82%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--topbar-pill-border, var(--rule, rgba(0, 0, 0, .08)));
  border-radius: 999px;
  box-shadow: 0 10px 24px -18px var(--shadow, rgba(0, 0, 0, .25));
  /* 横向滚动，隐藏滚动条（箭头替代） */
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.cat-nav::-webkit-scrollbar {
  display: none;
}

/* 内容溢出时：两端渐变淡出，给箭头让出视觉空间 */
.cat-nav-shell.has-overflow .cat-nav {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%);
}

/* ========== 左右滚动箭头 ========== */
.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 41;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--topbar-pill-border, var(--rule, rgba(0, 0, 0, .08)));
  background: color-mix(in oklab, var(--card-solid, #fff) 88%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--ink2, #666);
  cursor: pointer;
  box-shadow: 0 6px 14px -8px var(--shadow, rgba(0, 0, 0, .25));
  transition: opacity .2s ease, color .2s ease, transform .2s ease;
}

.nav-arrow.prev { left: 4px; }
.nav-arrow.next { right: 4px; }

.nav-arrow:hover:not(:disabled) {
  color: var(--pop, #d97706);
  transform: translateY(-50%) scale(1.08);
}

/* 无溢出时两个箭头都不显示 */
.cat-nav-shell:not(.has-overflow) .nav-arrow {
  display: none;
}

/* 到边缘的箭头半透明置灰（仍可点击但不滚动，避免穿透下方胶囊） */
.nav-arrow.at-edge {
  opacity: .35;
}

.nav-arrow.at-edge:hover {
  color: var(--ink2, #666);
  transform: translateY(-50%);
}

/* ========== 分类胶囊 ========== */
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 7px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--app-font, sans-serif);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink2, #666);
  white-space: nowrap;
  transition: background .25s ease, color .25s ease, transform .25s ease, box-shadow .25s ease;
}

.cat-chip:hover {
  background: color-mix(in oklab, var(--pop, #d97706) 10%, transparent);
  color: var(--pop, #d97706);
  transform: translateY(-1px);
}

.cat-chip.active {
  background: linear-gradient(135deg, var(--pop, #d97706), var(--pop2, #ea580c));
  color: var(--on-pop, #fff);
  box-shadow: 0 8px 18px -8px var(--pop, #d97706);
}

.chip-emoji {
  font-size: 14px;
  line-height: 1;
}

.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 9em;
}

/* 移动端小屏缩小胶囊 */
@media (max-width: 480px) {
  .cat-chip {
    padding: 6px 11px;
    font-size: 12px;
  }
}

/* 移动端触摸可横滑，隐藏箭头与边缘渐变 */
@media (max-width: 768px) {
  .nav-arrow {
    display: none;
  }
  .cat-nav-shell.has-overflow .cat-nav {
    -webkit-mask-image: none;
    mask-image: none;
  }
}
</style>
