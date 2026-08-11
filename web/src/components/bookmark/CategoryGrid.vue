<script setup>
/**
 * 分类网格容器
 * 内部按偏好排序模式对分类与书签排序（分类顺序 + 每个分类下书签顺序独立可控）
 */
import { computed } from 'vue';
import CategoryCard from './CategoryCard.vue';
import { usePrefsStore } from '../../stores/prefs.js';
import { sortByMode } from '../../composables/useSort.js';

const props = defineProps({
  categories: { type: Array, default: () => [] },
  /** 视图模式：card / list / compact */
  viewMode: { type: String, default: 'card' },
});

const emit = defineEmits(['open', 'unlock']);

const prefsStore = usePrefsStore();

/** 按偏好排序：先排每个分类下的书签，再排分类整体（返回新数组，不影响共享 store） */
const sortedCategories = computed(() => {
  const list = (props.categories || []).map((cat) => ({
    ...cat,
    links: sortByMode(cat.links, prefsStore.linkSortMode),
  }));
  return sortByMode(list, prefsStore.categorySortMode);
});
</script>

<template>
  <div class="grid" :class="`grid-${viewMode}`">
    <CategoryCard
      v-for="(cat, index) in sortedCategories"
      :id="'cat-' + cat.id"
      :key="cat.id"
      :category="cat"
      :index="index"
      :view-mode="viewMode"
      @open="emit('open', $event)"
      @unlock="emit('unlock', $event)"
    />
  </div>
</template>

<style scoped>
/* ========== 按视图模式区分分类卡片密度 ========== */
/* card（默认）：每行 3 个大卡片 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(14px, 2.5vw, 20px);
}

/* list：分类卡单列通栏（每行一个分类），靠链接多列密排区分 */
.grid-list {
  grid-template-columns: 1fr;
}

/* compact：分类卡同样 3 列，靠卡片头部紧凑化 + 链接 3 列高密度区分 */
.grid-compact {
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(12px, 2vw, 16px);
}

/* 移动端所有视图一律单列 */
@media (max-width: 768px) {
  .grid,
  .grid-card,
  .grid-list,
  .grid-compact {
    grid-template-columns: 1fr;
  }
}
</style>
