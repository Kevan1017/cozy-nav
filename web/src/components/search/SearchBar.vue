<script setup>
/**
 * 搜索栏：输入框 + 引擎切换 + 出发按钮 + 键盘导航
 * 搜索结果通过 Teleport 渲染到 body，避免与页面其他元素层级冲突
 */
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  engineKey: { type: String, default: 'google' },
  engines: { type: Array, default: () => [] },
  results: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: -1 },
});

const emit = defineEmits([
  'update:modelValue',
  'update:engineKey',
  'search',
  'open',
  'navigate',
  'confirm',
]);

const inputRef = ref(null);
const boxRef = ref(null);
const dropPos = ref({ top: 0, left: 0, width: 0 });

/** 聚焦输入框（供快捷键 / 调用） */
function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus });

/** 更新下拉框位置 */
function updateDropPos() {
  if (!boxRef.value) return;
  const rect = boxRef.value.getBoundingClientRect();
  dropPos.value = {
    top: rect.bottom + 8,
    left: rect.left,
    width: rect.width,
  };
}

/** 键盘事件 */
function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    emit('navigate', 'down');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    emit('navigate', 'up');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    emit('confirm');
  } else if (e.key === 'Escape') {
    inputRef.value?.blur();
  }
}

/** 点击外部关闭 */
function onClickOutside(e) {
  if (e.target.closest('.search')) return;
  if (props.results.length > 0) emit('update:modelValue', '');
}

/**
 * 关键字高亮分段：把文本按查询词切分为 { text, hit } 片段
 * 纯文本处理，渲染层用 {{ }} 插值输出，无 HTML 注入风险
 * @param {string} text 原始文本
 * @param {string} q 查询词
 * @returns {Array<{text: string, hit: boolean}>}
 */
function splitHighlight(text, q) {
  const query = (q || '').trim();
  if (!query || !text) return [{ text: text || '', hit: false }];
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const parts = [];
  let idx = 0;
  while (idx < text.length) {
    const i = lowerText.indexOf(lowerQ, idx);
    if (i === -1) {
      parts.push({ text: text.slice(idx), hit: false });
      break;
    }
    if (i > idx) parts.push({ text: text.slice(idx, i), hit: false });
    parts.push({ text: text.slice(i, i + query.length), hit: true });
    idx = i + query.length;
  }
  return parts;
}

/** 结果变化时更新位置 */
watch(() => props.results.length, async () => {
  if (props.results.length > 0) {
    await nextTick();
    updateDropPos();
  }
});

let ro = null;
onMounted(async () => {
  await nextTick();
  updateDropPos();
  window.addEventListener('scroll', updateDropPos, true);
  window.addEventListener('resize', updateDropPos);
  document.addEventListener('click', onClickOutside);
  // 监听布局变化
  if (window.ResizeObserver) {
    ro = new ResizeObserver(updateDropPos);
    if (boxRef.value) ro.observe(boxRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateDropPos, true);
  window.removeEventListener('resize', updateDropPos);
  document.removeEventListener('click', onClickOutside);
  if (ro) ro.disconnect();
});

const showResults = computed(() => props.results.length > 0);
/** 有搜索词但无匹配结果时，显示「没有更多结果」提示 */
const hasQuery = computed(() => (props.modelValue || '').trim().length > 0);
const showNoResult = computed(() => hasQuery.value && !showResults.value);
</script>

<template>
  <div class="search">
    <div ref="boxRef" class="box">
      <input
        ref="inputRef"
        :value="modelValue"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown="onKeydown"
        placeholder="搜搜看，想找什么…"
      />

      <div class="engs">
        <span
          v-for="eng in props.engines"
          :key="eng.key"
          :class="{ on: engineKey === eng.key }"
          :style="engineKey === eng.key ? { background: `var(--${eng.color})` } : {}"
          @click="emit('update:engineKey', eng.key)"
        >
          {{ eng.label }}
        </span>
      </div>

      <span class="go" @click="emit('search')">出发 →</span>
    </div>

    <!-- Teleport 到 body，避免层级冲突 -->
    <Teleport to="body">
      <div
        v-if="showResults || showNoResult"
        class="results-floating"
        :style="{ top: dropPos.top + 'px', left: dropPos.left + 'px', width: dropPos.width + 'px' }"
      >
        <template v-if="showResults">
          <div
            v-for="(link, i) in results"
            :key="link.id"
            class="result-item"
            :class="{ active: i === activeIndex }"
            @click="emit('open', link)"
            @mouseenter="emit('navigate', i)"
          >
            <span class="r-name">
              <template v-for="(p, pi) in splitHighlight(link.name, modelValue)" :key="pi">
                <mark v-if="p.hit" class="r-mark">{{ p.text }}</mark><template v-else>{{ p.text }}</template>
              </template>
            </span>
            <span class="r-domain">
              <template v-for="(p, pi) in splitHighlight(link.domain, modelValue)" :key="pi">
                <mark v-if="p.hit" class="r-mark">{{ p.text }}</mark><template v-else>{{ p.text }}</template>
              </template>
            </span>
          </div>
        </template>
        <div v-else class="no-more">没有更多结果</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  margin-bottom: clamp(12px, 2vw, 30px);
  opacity: 0;
  animation: bob .7s ease .25s forwards;
  /* 字体切换时防止子元素位移传导 */
  contain: layout style;
}

.box {
  display: flex;
  align-items: center;
  gap: clamp(8px, 2vw, 14px);
  background: var(--search-bg, var(--card-solid));
  border-radius: 22px;
  padding: clamp(11px, 2.5vw, 14px) clamp(13px, 3vw, 18px);
  box-shadow: 0 16px 36px -22px var(--shadow);
  transition: box-shadow .3s;
  position: relative;
  border: 1px solid var(--search-border, var(--rule));
  /* 稳定容器 */
  contain: layout style;
}

.box:focus-within {
  box-shadow: 0 16px 36px -18px rgba(255, 138, 91, .45), 0 0 0 4px rgba(255, 138, 91, .15);
}


input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, 'Quicksand', sans-serif);
  font-size: clamp(14px, 3vw, 16px);
  font-weight: 500;
  color: var(--search-ink, var(--ink));
}

input::placeholder {
  color: var(--search-placeholder, var(--soft));
}

/* Teleport 到 body 的浮动下拉 */
.results-floating {
  position: fixed;
  background: var(--search-bg, var(--card-solid));
  border-radius: 18px;
  box-shadow: 0 16px 36px -18px var(--shadow);
  overflow: hidden;
  z-index: 9999;
  max-height: 480px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background .15s;
}

/* 无匹配结果提示 */
.no-more {
  padding: 16px 18px;
  text-align: center;
  font-size: 12px;
  color: var(--search-placeholder, var(--soft));
}

.result-item:hover,
.result-item.active {
  background: var(--cream);
}

.r-name {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-weight: 600;
  font-size: 13px;
  color: var(--search-ink, var(--ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-domain {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: 11px;
  color: var(--search-placeholder, var(--soft));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 搜索结果关键字高亮：背景/文字色用主题变量，随主题亮暗自动适配 */
.r-mark {
  background: var(--peach, #FFB800);
  color: var(--on-pop, #fff);
  border-radius: 4px;
  padding: 0 2px;
}

.engs {
  display: flex;
  gap: 0;
  flex: none;
}

.engs span {
  /* 使用 var(--app-font) 跟随全局字体切换 */
  font-family: var(--app-font, sans-serif);
  font-size: clamp(10px, 2.2vw, 11px);
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--search-placeholder, var(--soft));
  cursor: pointer;
  transition: all .2s;
}

.engs span.on {
  background: var(--search-eng-on, var(--peach));
  color: var(--search-eng-ink, var(--on-pop));
}

.go {
  /* 中文使用 var(--app-font) 跟随全局字体切换，英文保留 Fredoka */
  font-family: 'Fredoka', var(--app-font, sans-serif);
  font-weight: 600;
  font-size: clamp(12px, 2.6vw, 14px);
  color: var(--search-btn-ink, var(--on-pop));
  background: linear-gradient(135deg, var(--search-btn, var(--pop)), var(--search-btn2, var(--pop2)));
  padding: clamp(9px, 2vw, 11px) clamp(16px, 3vw, 24px);
  border-radius: 15px;
  cursor: pointer;
  box-shadow: 0 10px 24px -10px rgba(232, 146, 60, .65), 0 2px 4px rgba(0, 0, 0, .08);
  white-space: nowrap;
  flex: none;
  transition: transform .2s, box-shadow .2s;
  position: relative;
}

.go::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, .22), transparent 50%);
  pointer-events: none;
}

.go:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px -10px rgba(232, 146, 60, .75), 0 3px 6px rgba(0, 0, 0, .12);
}

.go:active {
  transform: translateY(0);
}
</style>
