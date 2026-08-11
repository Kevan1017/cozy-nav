<script setup>
/**
 * 设置页可折叠卡片容器
 * 点击标题栏整行展开/收起，折叠状态记忆到 localStorage（按卡片标题唯一标识）
 * 保留原 n-card 外观与 header-extra 附加信息插槽
 */
import { ref } from 'vue';
import { NCard, NCollapseTransition } from 'naive-ui';

const props = defineProps({
  /** 卡片标题（同时作为 localStorage 记忆 key 的唯一标识） */
  title: { type: String, required: true },
  /** 是否默认展开（用户手动折叠过则记忆优先） */
  defaultExpanded: { type: Boolean, default: true },
});

const STORAGE_KEY = 'settings-card-collapsed';

/** 恢复折叠状态：默认展开，记忆优先 */
const expanded = ref(true);
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const map = JSON.parse(saved);
    expanded.value = map[props.title] ?? props.defaultExpanded;
  }
} catch { /* 解析失败保持默认展开 */ }

/** 切换展开/收起并持久化 */
function toggle() {
  expanded.value = !expanded.value;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const map = saved ? JSON.parse(saved) : {};
    map[props.title] = expanded.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* 写入失败忽略 */ }
}
</script>

<template>
  <n-card class="setting-card" hoverable>
    <template #header>
      <div class="collapsible-header" @click="toggle">
        <span class="collapse-title">
          <span class="card-title-text">{{ title }}</span>
          <!-- 展开：箭头朝上；收起：箭头朝下（旋转 180 过渡） -->
          <svg
            class="collapse-arrow"
            :class="{ collapsed: !expanded }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <!-- header-extra 附加信息（如主题模式预览标签），点击不触发展开/收起 -->
        <span v-if="$slots['header-extra']" class="collapse-extra" @click.stop>
          <slot name="header-extra" />
        </span>
      </div>
    </template>
    <n-collapse-transition :show="expanded">
      <div class="card-body">
        <slot />
      </div>
    </n-collapse-transition>
  </n-card>
</template>

<style scoped>
.setting-card {
  border-radius: 18px !important;
  margin-bottom: 16px;
}
/* 标题栏：整行可点击 */
.collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}
.collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.card-title-text {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-size: 16px;
  color: var(--admin-text);
}
.collapse-arrow {
  width: 18px;
  height: 18px;
  flex: none;
  color: var(--admin-muted);
  transition: transform .25s ease;
}
/* 收起时箭头旋转朝下 */
.collapse-arrow.collapsed {
  transform: rotate(180deg);
}
.collapse-extra {
  flex: none;
  margin-left: 12px;
}
</style>
