<script setup>
/**
 * Hero 区域：时段问候 + 标题 + 统计卡片
 */
import { computed } from 'vue';
import { useClock } from '../../composables/useClock.js';
import { usePrefsStore } from '../../stores/prefs.js';
import { getNextFestival } from '../../composables/useFestival.js';

const props = defineProps({
  linkCount: { type: Number, default: 0 },
  categoryCount: { type: Number, default: 0 },
});

const { greeting } = useClock();
const prefsStore = usePrefsStore();

/** 书签总数格式化为两位数 */
const linkDisplay = computed(() => String(props.linkCount).padStart(2, '0'));
const categoryDisplay = computed(() => String(props.categoryCount).padStart(2, '0'));

/** Hero 副标语：有自定义则用自定义，否则用默认 */
const heroSubtitle = computed(() => prefsStore.heroTagline || '— 你的小角落，随时出发 ♡');

/* ---------- 节日倒计时 ---------- */
/** 距离最近的下一个节日 */
const nextFestival = getNextFestival();

/** 倒计时标签：今天 / 明天 / 距 N 天 */
const countdownLabel = computed(() => {
  if (!nextFestival) return '节日';
  if (nextFestival.diff === 0) return `就是${nextFestival.name}！`;
  if (nextFestival.diff === 1) return `明天 ${nextFestival.name}`;
  return `距 ${nextFestival.name}`;
});
</script>

<template>
  <div class="hero">
    <div class="hero-left">
      <div class="greet">
        <span class="emj">{{ greeting.emoji }}</span>
        {{ greeting.text }}
      </div>
      <h1>
        嘿，今天想去 <span>哪里</span> <span class="pop">逛逛</span>？
      </h1>
      <div class="handwrite">{{ heroSubtitle }}</div>
      <p>
        把 <b>{{ linkCount }}</b> 个常去的地方收进一个温暖的空间。
      </p>
    </div>

    <div class="card-mini" :class="{ 'has-countdown': prefsStore.festivalCountdownEnabled }">
      <div class="s s-peach">
        <b>{{ linkDisplay }}</b>
        <span>站点</span>
      </div>
      <div class="s s-mint">
        <b>{{ categoryDisplay }}</b>
        <span>分类</span>
      </div>
      <div v-if="prefsStore.festivalCountdownEnabled" class="s s-festival">
        <b>{{ nextFestival ? nextFestival.diff : '—' }}</b>
        <span>{{ countdownLabel }}</span>
      </div>
      <!-- 底部标语（可在后台设置） -->
      <div class="label">{{ prefsStore.statTagline }}</div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 36px;
  align-items: center;
  margin-bottom: clamp(18px, 3vw, 26px);
  opacity: 0;
  animation: bob .7s ease .15s forwards;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.greet {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Caveat */
  font-family: 'Caveat', var(--app-font, cursive);
  font-weight: 600;
  font-size: clamp(18px, 3vw, 24px);
  color: var(--hero-greet, var(--pop2));
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  /* 稳定容器，字体切换不传导 */
  contain: layout style;
}

.greet .emj {
  font-size: 24px;
  animation: bob 3s ease-in-out infinite;
  flex-shrink: 0;
}

h1 {
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Fredoka */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 700;
  font-style: normal;
  font-size: clamp(20px, 3.8vw, 38px);
  line-height: 1.02;
  letter-spacing: -.015em;
  color: var(--hero-title, var(--ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  /* 稳定容器，字体切换不传导 */
  contain: layout style;
}

h1 .pop { color: var(--hero-title-pop, var(--pop)); }

.handwrite {
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Caveat */
  font-family: 'Caveat', var(--app-font, cursive);
  font-weight: 600;
  font-size: clamp(16px, 2.8vw, 22px);
  color: var(--hero-handwrite, var(--pop2));
  margin-top: 6px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

p {
  font-size: clamp(13px, 2.4vw, 15px);
  line-height: 1.65;
  color: var(--hero-desc, var(--ink2));
  margin-top: 14px;
  max-width: 42ch;
  /* 防止字体切换时换行 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

p b {
  color: var(--hero-desc-strong, var(--ink));
  font-weight: 700;
}

/* 统计卡片 */
.card-mini {
  background: linear-gradient(150deg, var(--stat-card, var(--card-solid)) 0%, var(--stat-card2, var(--cream)) 100%);
  border-radius: 26px;
  padding: clamp(16px, 3vw, 22px);
  box-shadow: 0 22px 48px -28px var(--shadow);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  position: relative;
  overflow: hidden;
}

/* 开启节日倒计时时，统计卡变三列 */
.card-mini.has-countdown {
  grid-template-columns: repeat(3, 1fr);
}

.card-mini::before {
  content: "";
  position: absolute;
  top: -30px;
  right: -30px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: var(--stat-peach, var(--peach));
  opacity: .4;
  filter: blur(20px);
}

.s {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: clamp(10px, 2vw, 14px) 6px;
  border-radius: 18px;
  position: relative;
  z-index: 1;
}

.s b {
  /* 数字使用 var(--app-font) 保持一致性 */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: clamp(20px, 4vw, 32px);
  font-weight: 700;
  line-height: 1;
}

.s span {
  font-size: clamp(10px, 2vw, 11px);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.s-peach { background: var(--stat-peach, var(--peach)); }
.s-peach b { color: var(--stat-ink, var(--on-pop)); }
.s-peach span { color: var(--stat-site-text, var(--ink2)); }

.s-mint { background: var(--stat-mint, var(--mint)); }
.s-mint b { color: var(--stat-cat-ink, var(--on-pop)); }
.s-mint span { color: var(--stat-cat-text, var(--ink2)); }

.s-festival { background: var(--stat-festival, var(--pop)); }
.s-festival b {
  color: var(--stat-fest-ink, var(--stat-ink, var(--on-pop)));
}
.s-festival span {
  color: var(--stat-fest-text, var(--stat-site-text, var(--ink2)));
  opacity: .85;
}

.label {
  grid-column: 1 / -1;
  text-align: center;
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Caveat */
  font-family: 'Caveat', var(--app-font, cursive);
  font-size: clamp(13px, 2.4vw, 16px);
  color: var(--stat-label, var(--soft));
  margin-top: 2px;
  position: relative;
  z-index: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 移动端紧凑优化 */
@media (max-width: 680px) {
  .hero {
    display: none;
  }
}
</style>
