<script setup>
/**
 * 分类卡片：emoji + 标题 + 副标题 + 书签列表
 * 锁定呈现区分：
 *   分类加密（locked）→ 锁定占位"该分类已加密"，不显示书签列表
 *   所有链接加密（allLinksLocked）→ 显示书签列表（每个链接以锁定样式）+ 顶部提示"所有链接已加密"
 */
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import LinkItem from './LinkItem.vue';
import { resolveColor } from '../../composables/useColor.js';
import { useResponsive } from '../../composables/useResponsive.js';

const props = defineProps({
  category: { type: Object, required: true },
  index: { type: Number, default: 0 },
  /** 视图模式：card（卡片）/ list（列表）/ compact（紧凑）/ dial（图标平铺） */
  viewMode: { type: String, default: 'card' },
});

const emit = defineEmits(['open', 'unlock']);

/** 移动端检测（<768px，与 CategoryGrid 单列断点一致） */
const { isMobile } = useResponsive();

/** 紧凑视图窄屏断点（<480px 时链接为 2 列，对应 .links-compact 的媒体查询；其余宽度为 3 列） */
const isNarrow = ref(window.innerWidth < 480);
function onResize() {
  isNarrow.value = window.innerWidth < 480;
}
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

/** 分类背景色（兼容预设名称和 HEX 值） */
const bgColor = computed(() => resolveColor(props.category.bg_color));

/** 分类是否加密（独立的分类锁） */
const isCategoryLocked = computed(() => !!props.category.locked);

/** 保险库是否已解锁（已解锁时不显示锁定提示） */
const vaultUnlocked = computed(() => !!props.category.vaultUnlocked);

/** 是否所有链接都加密了（分类未加密但链接全加密，且未解锁时才显示提示） */
const isAllLinksLocked = computed(() => !!props.category.allLinksLocked && !vaultUnlocked.value);

/** 书签数量 */
const linkCount = computed(() => String(props.category.links?.length || 0).padStart(2, '0'));

/** 入场动画延迟 */
const animDelay = computed(() => `${0.36 + props.index * 0.08}s`);

/* ========== 分类折叠：card / compact 展示六排，dial 三排，list 按原阈值，超限点击展开 ========== */
/** list 视图折叠阈值：桌面 8 列 4 行 = 32 条；移动端单列 10 行 = 10 条（现状不变） */
const LIST_COLLAPSE_THRESHOLD_DESKTOP = 32;
const LIST_COLLAPSE_THRESHOLD_MOBILE = 10;
/** card / compact 视图默认展示行数（六排） */
const MAX_ROWS_CARD_COMPACT = 6;
/** dial（图标平铺）视图默认展示行数（大图标三排） */
const MAX_ROWS_DIAL = 3;

/** 每行列数：card 固定 2 列；dial 按 68px 方形网格估算（桌面 1216px 内容区约 15 列 / 窄屏 60px 方块 5 列）；compact ≤480px 为 2 列，其余 3 列 */
const columnsPerRow = computed(() => {
  if (props.viewMode === 'card') return 2;
  if (props.viewMode === 'dial') return isNarrow.value ? 5 : 15;
  return isNarrow.value ? 2 : 3;
});

/** 当前是否展开（list / card / compact 视图生效） */
const expanded = ref(false);

/** 切换视图模式时重置展开状态 */
watch(() => props.viewMode, () => {
  expanded.value = false;
});

/** 链接总数 */
const totalLinks = computed(() => props.category.links?.length || 0);

/** 折叠阈值（条数）：list 按原阈值；card / compact 按六排 × 每行列数；dial 按三排 × 每行列数 */
const collapseThreshold = computed(() => {
  if (props.viewMode === 'list') {
    return isMobile.value ? LIST_COLLAPSE_THRESHOLD_MOBILE : LIST_COLLAPSE_THRESHOLD_DESKTOP;
  }
  if (props.viewMode === 'dial') {
    return MAX_ROWS_DIAL * columnsPerRow.value;
  }
  return MAX_ROWS_CARD_COMPACT * columnsPerRow.value;
});

/** 是否需要折叠（链接数超过阈值） */
const needCollapse = computed(() => totalLinks.value > collapseThreshold.value);

/** 实际渲染的链接列表（折叠时只取前 N 个） */
const visibleLinks = computed(() => {
  const links = props.category.links || [];
  if (needCollapse.value && !expanded.value) {
    return links.slice(0, collapseThreshold.value);
  }
  return links;
});

/** 折叠时被隐藏的链接数量 */
const hiddenCount = computed(() =>
  needCollapse.value && !expanded.value
    ? totalLinks.value - collapseThreshold.value
    : 0
);

/** 切换展开/收起 */
function toggleExpand() {
  expanded.value = !expanded.value;
}
</script>

<template>
  <div class="cat" :class="`cat-${viewMode}`" :style="{ animationDelay: animDelay }">
    <div class="c-head">
      <span class="emoji" :style="{ background: bgColor }">{{ category.emoji }}</span>
      <div class="c-title">
        <h2>{{ category.name }}</h2>
        <div class="cn">{{ category.subtitle }}</div>
      </div>
      <span class="cnt">{{ isCategoryLocked ? '🔒' : linkCount }}</span>
    </div>

    <!-- 分类加密：锁定占位，不显示书签列表 -->
    <div v-if="isCategoryLocked" class="lock-placeholder" @click="emit('unlock')">
      <div class="lock-icon">🔒</div>
      <p class="lock-hint">该分类已加密</p>
      <p class="lock-action">点击解锁查看</p>
    </div>

    <!-- 非分类锁定：显示书签列表 -->
    <div v-else class="links-wrapper">
      <!-- 所有链接都加密了：顶部提示条 -->
      <div v-if="isAllLinksLocked" class="all-locked-hint" @click="emit('unlock')">
        <span class="all-locked-icon">🔒</span>
        <span class="all-locked-text">所有链接已加密</span>
        <span class="all-locked-action">点击解锁</span>
      </div>

      <!-- 书签列表（加密链接以锁定样式呈现） -->
      <div class="links" :class="`links-${viewMode}`">
        <LinkItem
          v-for="link in visibleLinks"
          :key="link.id"
          :link="link"
          :unlocked="vaultUnlocked"
          :view-mode="viewMode"
          @open="emit('open', $event)"
          @unlock="emit('unlock')"
        />
      </div>

      <!-- 分类折叠：展开/收起按钮（list / card / compact 视图共用） -->
      <button
        v-if="needCollapse"
        class="list-expand-btn"
        :class="{ 'is-expanded': expanded }"
        @click="toggleExpand"
      >
        <span v-if="!expanded">展开 +{{ hiddenCount }}</span>
        <span v-else>收起</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cat {
  background: var(--cat-card, var(--card));
  backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: clamp(16px, 3vw, 20px);
  box-shadow: 0 16px 34px -24px var(--cat-shadow, var(--shadow));
  /* 初始隐藏，bob 动画淡入；forwards 保持 to 状态（opacity 1 + translateZ(0)），
     不回落、不触发 transition 抖动，合成层稳定 */
  opacity: 0;
  /* 强制独立合成层：稳定 backdrop 采样，缓解滚动时毛玻璃卡片白屏 */
  transform: translateZ(0);
  /* forwards 结束在 translateZ(0)，与静态一致，动画后无回落 */
  animation: bob .6s ease forwards;
  transition: transform .25s, box-shadow .25s;
  position: relative;
  overflow: hidden;
  /* 分类导航条定位时预留吸顶空间 */
  scroll-margin-top: 96px;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.cat::before {
  content: "";
  position: absolute;
  top: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  opacity: .22;
  filter: blur(16px);
  transition: opacity .3s;
}

/* 根据 bg_color 设置 ::before 背景色 */
.cat:nth-child(1)::before { background: var(--peach); }
.cat:nth-child(2)::before { background: var(--mint); }
.cat:nth-child(3)::before { background: var(--lav); }
.cat:nth-child(4)::before { background: var(--sky); }
.cat:nth-child(5)::before { background: var(--rose); }
.cat:nth-child(6)::before { background: var(--butter); }

.cat:hover {
  /* 保留 translateZ(0)，hover 期间合成层不降级 */
  transform: translateY(-5px) translateZ(0);
  box-shadow: 0 26px 46px -24px var(--cat-shadow, var(--shadow));
}

.cat:hover::before {
  opacity: .4;
}

.c-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}

.emoji {
  width: clamp(36px, 8vw, 42px);
  height: clamp(36px, 8vw, 42px);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(17px, 4vw, 20px);
  box-shadow: 0 6px 12px -6px var(--cat-shadow, var(--shadow));
  transition: transform .25s;
  flex: none;
}

.cat:hover .emoji {
  transform: scale(1.1) rotate(-6deg);
}

.c-title h2 {
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Fredoka */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(15px, 3vw, 18px);
  line-height: 1.1;
  color: var(--cat-title, var(--ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  /* 稳定容器，字体切换不传导 */
  contain: layout style;
}

.cn {
  font-size: clamp(10px, 2.2vw, 12px);
  font-weight: 600;
  color: var(--cat-sub, var(--soft));
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cnt {
  margin-left: auto;
  /* 数字使用 var(--app-font) 保持一致性 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: clamp(11px, 2.4vw, 13px);
  font-weight: 600;
  color: var(--cat-count, var(--soft));
  background: var(--cat-count-bg, var(--card-solid));
  padding: 3px 11px;
  border-radius: 11px;
  flex: none;
}

.links-wrapper {
  position: relative;
  z-index: 1;
  /* 图标背板：favicon 加载完成后在链接块内呈卡片实色圆角块（块中块），
     与链接块底色拉开层次；所有视图统一生效，暗色主题为深卡其实色 */
  --fav-plate: var(--card-solid);
}

.links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* 所有视图统一：图标块（favicon 或字母头像）加卡片实色背板与独立阴影，
   从链接块底色中浮起，形成块中块层次；边框保持 1px 透明避免视图切换过渡闪烁 */
.links :deep(.favicon-img),
.links :deep(.av) {
  border: 1px solid transparent;
  box-shadow: 0 6px 12px -6px var(--shadow, rgba(42, 58, 74, .3));
}

/* 列表视图：链接多列密排（通栏卡片内 8 列，窄屏 2 列） */
.links-list {
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

/* 紧凑视图：3 列链接（移动端 2 列），隐藏域名，缩小间距 */
.links-compact {
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.links-compact :deep(.lk) {
  padding: 7px 8px;
  min-height: 40px;
  gap: 6px;
}

.links-compact :deep(.dm) {
  display: none;
}

/* 图标平铺视图：链接大图标墙（竖排居中，图标 34px + 名称小字）。
   块按最小 68px 自适应列数并保持正方形（aspect-ratio: 1），类似手机桌面网格 */
.links-dial {
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 10px;
}

.links-dial :deep(.lk) {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 4px 6px;
  aspect-ratio: 1;
  border-radius: 14px;
  text-align: center;
  /* 与默认主题风格一致：底色/阴影引用主题变量，自动适配 9 套预设的亮暗变体。
     边框保持 1px 透明与标准视图同一声明，避免视图切换时过渡闪烁；
     阴影加深形成磁贴浮起感，与卡片背景拉开层次 */
  background: var(--link-bg);
  border: 1px solid transparent;
  box-shadow: 0 10px 22px -10px var(--shadow, rgba(42, 58, 74, .3));
}

.links-dial :deep(.lk:hover) {
  background: var(--link-hover, var(--card-solid));
}

.links-dial :deep(.txt) {
  /* 关闭基础样式的 flex-grow 拉伸，否则竖排布局中名称区会被拉满剩余高度、图标偏上 */
  flex: none;
  width: 100%;
  text-align: center;
}

.links-dial :deep(.nm) {
  justify-content: center;
  font-size: clamp(9.5px, 2.1vw, 10.5px);
  line-height: 1.3;
}

.links-dial :deep(.dm) {
  display: none;
}

/* 图标平铺下常用竖条不适用（竖向居中布局），隐藏 */
.links-dial :deep(.fav-bar) {
  display: none;
}

/* 图标平铺下锁定条目保留"点击解锁查看"提示（.dm 默认被隐藏，此处恢复） */
.links-dial :deep(.lk-locked .dm) {
  display: block;
}

@media (max-width: 768px) {
  /* 移动端（与 CategoryGrid 单列断点一致）：列表视图链接单列，每行一个 */
  .links-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .links-compact {
    grid-template-columns: repeat(2, 1fr);
  }
  /* 图标平铺：窄屏缩小最小块宽，一行排 5 个方块（桌面仍 15 列） */
  .links-dial {
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  }
}

/* ========== compact 视图：小卡片头部紧凑化 ========== */
.cat-compact {
  padding: clamp(12px, 2vw, 14px);
  border-radius: 20px;
}

.cat-compact .c-head {
  gap: 8px;
  margin-bottom: 10px;
}

.cat-compact .emoji {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  font-size: 15px;
}

.cat-compact .c-title h2 {
  font-size: 14px;
}

.cat-compact .cn {
  font-size: 10px;
}

.cat-compact .cnt {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 9px;
}

/* 列表视图折叠按钮 */
.list-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  border: none;
  border-radius: 12px;
  background: var(--cat-count-bg, var(--card-solid));
  color: var(--cat-sub, var(--soft));
  font-family: var(--app-font, sans-serif);
  font-size: clamp(12px, 2.4vw, 13px);
  font-weight: 600;
  cursor: pointer;
  transition: background .2s, color .2s, transform .15s;
}

.list-expand-btn svg {
  width: 16px;
  height: 16px;
  transition: transform .3s cubic-bezier(.2,.8,.2,1);
}

.list-expand-btn:hover {
  background: color-mix(in oklab, var(--cat-accent, var(--pop)) 10%, var(--cat-count-bg, var(--card-solid)));
  color: var(--cat-accent, var(--pop));
  transform: translateY(-1px);
}

.list-expand-btn:active {
  transform: translateY(0);
}

/* 展开状态：箭头旋转 180° */
.list-expand-btn.is-expanded svg {
  transform: rotate(180deg);
}

/* 锁定占位（分类加密） */
.lock-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: clamp(20px, 4vw, 32px) 16px;
  cursor: pointer;
  border-radius: 16px;
  background: var(--cat-count-bg, var(--card-solid));
  border: 2px dashed var(--cat-lock-border, var(--peach));
  transition: border-color .25s, transform .25s;
  position: relative;
  z-index: 1;
}

.lock-placeholder:hover {
  border-color: var(--cat-accent, var(--pop));
  transform: translateY(-2px);
}

.lock-icon {
  font-size: clamp(28px, 6vw, 36px);
  line-height: 1;
  filter: grayscale(.3);
  transition: transform .25s;
}

.lock-placeholder:hover .lock-icon {
  transform: scale(1.15);
}

.lock-hint {
  font-size: clamp(12px, 2.6vw, 14px);
  font-weight: 600;
  color: var(--cat-sub, var(--soft));
  margin: 0;
}

.lock-action {
  font-size: clamp(11px, 2.4vw, 13px);
  color: var(--cat-accent, var(--pop));
  font-weight: 600;
  margin: 0;
}

/* 所有链接加密提示条 */
.all-locked-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--cat-count-bg, var(--card-solid));
  border: 1px dashed var(--cat-lock-border, var(--peach));
  cursor: pointer;
  transition: border-color .25s, transform .25s;
}

.all-locked-hint:hover {
  border-color: var(--cat-accent, var(--pop));
  transform: translateY(-1px);
}

.all-locked-icon {
  font-size: clamp(13px, 3vw, 15px);
  filter: grayscale(.3);
}

.all-locked-text {
  font-size: clamp(11px, 2.4vw, 13px);
  font-weight: 600;
  color: var(--cat-sub, var(--soft));
}

.all-locked-action {
  margin-left: auto;
  font-size: clamp(10px, 2.2vw, 12px);
  font-weight: 600;
  color: var(--cat-accent, var(--pop));
}
</style>
