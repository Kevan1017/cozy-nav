<script setup>
/**
 * 节日装饰层：按节日分组渲染对应装饰
 * - spring（春节族）：灯笼 + 红绸
 * - christmas（圣诞族）：雪花飘落 + 圣诞树
 * - midautumn（中秋族）：发光月亮 + 云
 * - halloween（万圣族）：蝙蝠 + 南瓜
 * - generic（通用族）：节日 emoji 粒子漂浮
 * 纯装饰层，pointer-events: none，不影响任何交互；动画遵循 prefers-reduced-motion
 */
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  festival: { type: Object, default: null },
});

const isMobile = window.innerWidth < 600;

/** 雪花配置（移动端减半） */
const flakes = ref([]);
onMounted(() => {
  const count = isMobile ? 14 : 28;
  flakes.value = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 4 + Math.random() * 6,
    delay: Math.random() * 12,
    duration: 7 + Math.random() * 8,
    sway: Math.random() * 60 - 30,
    opacity: 0.3 + Math.random() * 0.6,
  }));
});

/** 通用族 emoji 粒子 */
const particles = computed(() => {
  if (!props.festival || props.festival.group !== 'generic') return [];
  const count = isMobile ? 6 : 10;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 5 + Math.random() * 90,
    size: 16 + Math.random() * 14,
    delay: Math.random() * 10,
    duration: 9 + Math.random() * 8,
  }));
});

/** 万圣族蝙蝠 */
const bats = computed(() => {
  if (!props.festival || props.festival.group !== 'halloween') return [];
  return Array.from({ length: 3 }, (_, i) => ({
    id: i,
    top: 12 + i * 18,
    delay: i * 6,
    duration: 16 + i * 4,
  }));
});

/** 圣诞树 emoji 显示与否 */
const showTree = computed(() => props.festival?.group === 'christmas');
</script>

<template>
  <div v-if="festival" class="festival-layer" :class="festival.group" aria-hidden="true">
    <!-- 春节族：顶部红绸 + 悬挂灯笼 -->
    <template v-if="festival.group === 'spring'">
      <div class="red-sash" />
      <div class="lantern l1" />
      <div class="lantern l2" />
    </template>

    <!-- 圣诞族：雪花飘落 + 圣诞树 -->
    <template v-if="festival.group === 'christmas'">
      <i
        v-for="fl in flakes"
        :key="fl.id"
        class="flake"
        :style="{
          left: fl.left + '%',
          width: fl.size + 'px',
          height: fl.size + 'px',
          opacity: fl.opacity,
          '--sway': fl.sway + 'px',
          animationDelay: fl.delay + 's',
          animationDuration: fl.duration + 's',
        }"
      />
      <div v-if="showTree" class="tree">🎄</div>
    </template>

    <!-- 中秋族：发光月亮 + 云 -->
    <template v-if="festival.group === 'midautumn'">
      <div class="moon" />
      <div class="cloud c1" />
      <div class="cloud c2" />
    </template>

    <!-- 万圣族：蝙蝠 + 南瓜 -->
    <template v-if="festival.group === 'halloween'">
      <span
        v-for="b in bats"
        :key="b.id"
        class="bat"
        :style="{
          top: b.top + '%',
          animationDelay: b.delay + 's',
          animationDuration: b.duration + 's',
        }"
      >🦇</span>
      <div class="pumpkin">🎃</div>
    </template>

    <!-- 通用族：节日 emoji 粒子漂浮 -->
    <template v-if="festival.group === 'generic'">
      <span
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          left: p.left + '%',
          fontSize: p.size + 'px',
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's',
        }"
      >{{ festival.emoji }}</span>
    </template>
  </div>
</template>

<style scoped>
/* ===== 公共：装饰层不阻挡交互 ===== */
.festival-layer {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 20;
  overflow: hidden;
}

/* ===== 春节族：红绸 + 灯笼 ===== */
.red-sash {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, rgba(198, 61, 42, 0) 0%, rgba(198, 61, 42, 0.55) 18%, rgba(255, 176, 59, 0.7) 50%, rgba(198, 61, 42, 0.55) 82%, rgba(198, 61, 42, 0) 100%);
}

.lantern {
  position: absolute;
  top: 10px;
  width: 34px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(180deg, #e5572e, #c63d2a);
  box-shadow: 0 6px 20px rgba(198, 61, 42, 0.45);
  transform-origin: top center;
  animation: lantern-swing 3.2s ease-in-out infinite;
}

/* 提线 */
.lantern::before {
  content: "";
  position: absolute;
  top: -38px;
  left: 50%;
  width: 2px;
  height: 38px;
  background: rgba(198, 61, 42, 0.7);
  transform: translateX(-50%);
}

/* 底部灯穗 */
.lantern::after {
  content: "";
  position: absolute;
  bottom: -12px;
  left: 50%;
  width: 10px;
  height: 12px;
  background: #f2a85a;
  border-radius: 0 0 5px 5px;
  transform: translateX(-50%);
}

.lantern.l1 { left: 26px; }
.lantern.l2 { right: 26px; animation-delay: 0.8s; }

@keyframes lantern-swing {
  0%, 100% { transform: rotate(-7deg); }
  50% { transform: rotate(7deg); }
}

/* ===== 圣诞族：雪花 + 圣诞树 ===== */
.flake {
  position: absolute;
  top: -12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  filter: blur(1px);
  animation: snow-fall linear infinite;
}

@keyframes snow-fall {
  0% { transform: translateY(0) translateX(0); }
  100% { transform: translateY(108vh) translateX(var(--sway, 0)); }
}

.tree {
  position: absolute;
  right: 30px;
  bottom: 18px;
  font-size: 84px;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.18));
  animation: tree-bob 4s ease-in-out infinite;
}

@keyframes tree-bob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-8px) rotate(2deg); }
}

/* ===== 中秋族：月亮 + 云 ===== */
.moon {
  position: absolute;
  top: 84px;
  right: 44px;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 35%, #fff7d6, #ffd76a 72%);
  box-shadow:
    0 0 40px 14px rgba(255, 214, 120, 0.5),
    0 0 90px 32px rgba(255, 214, 120, 0.18);
  animation: moon-glow 6s ease-in-out infinite;
}

@keyframes moon-glow {
  0%, 100% { box-shadow: 0 0 40px 14px rgba(255, 214, 120, 0.5), 0 0 90px 32px rgba(255, 214, 120, 0.18); }
  50% { box-shadow: 0 0 52px 20px rgba(255, 214, 120, 0.62), 0 0 110px 40px rgba(255, 214, 120, 0.24); }
}

.cloud {
  position: absolute;
  width: 110px;
  height: 34px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.55);
  filter: blur(2px);
  animation: cloud-drift 22s linear infinite;
}

.cloud::before,
.cloud::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: inherit;
}

.cloud::before {
  width: 46px;
  height: 46px;
  top: -20px;
  left: 16px;
}

.cloud::after {
  width: 34px;
  height: 34px;
  top: -12px;
  right: 18px;
}

.cloud.c1 { top: 120px; right: 90px; opacity: 0.7; }
.cloud.c2 { top: 170px; right: 40px; opacity: 0.5; animation-duration: 30s; animation-delay: 6s; }

@keyframes cloud-drift {
  from { transform: translateX(0); }
  to { transform: translateX(140px); }
}

/* ===== 万圣族：蝙蝠 + 南瓜 ===== */
.bat {
  position: absolute;
  right: -40px;
  font-size: 26px;
  animation: bat-fly linear infinite;
}

@keyframes bat-fly {
  from { transform: translateX(0) translateY(0) rotate(0deg); }
  to { transform: translateX(-110vw) translateY(40px) rotate(-8deg); }
}

.pumpkin {
  position: absolute;
  right: 36px;
  bottom: 22px;
  font-size: 72px;
  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.2));
  animation: tree-bob 3.4s ease-in-out infinite;
}

/* ===== 通用族：emoji 粒子 ===== */
.particle {
  position: absolute;
  bottom: -12%;
  opacity: 0.75;
  animation: particle-rise linear infinite;
}

@keyframes particle-rise {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  12% { opacity: 0.75; }
  100% { transform: translateY(-118vh) rotate(18deg); opacity: 0; }
}

/* ===== 无障碍：用户偏好减弱动效时关闭动画 ===== */
@media (prefers-reduced-motion: reduce) {
  .lantern,
  .flake,
  .tree,
  .moon,
  .cloud,
  .bat,
  .particle {
    animation: none !important;
  }
}
</style>
