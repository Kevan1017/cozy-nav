<script setup>
/**
 * 背景装饰：blob 模糊球 + 噪点纹理
 * 纯装饰性，pointer-events: none
 */
</script>

<template>
  <div class="blob b1" />
  <div class="blob b2" />
  <div class="blob b3" />
</template>

<style scoped>
.blob {
  position: fixed;
  border-radius: 50%;
  filter: blur(14px);
  z-index: 0;
  opacity: .5;
  pointer-events: none;
  animation: float 10s ease-in-out infinite;
}

.b1 {
  width: 160px;
  height: 160px;
  background: var(--peach);
  top: 8%;
  left: -40px;
}

.b2 {
  width: 120px;
  height: 120px;
  background: var(--mint);
  top: 55%;
  right: -30px;
  animation-delay: 2s;
}

.b3 {
  width: 90px;
  height: 90px;
  background: var(--lav);
  bottom: 6%;
  left: 22%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(10px, -16px) scale(1.05); }
  66% { transform: translate(-8px, 10px) scale(.97); }
}
</style>
