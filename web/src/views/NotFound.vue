<script setup>
/**
 * 404 页面
 */
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <RouterLink to="/">返回首页</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 10px;
}

.not-found h1 {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 64px;
  color: var(--pop);
}

.not-found a {
  color: var(--pop2);
  text-decoration: none;
}
</style>
