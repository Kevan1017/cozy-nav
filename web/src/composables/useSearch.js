/**
 * 搜索逻辑
 * 本地过滤 + 搜索引擎跳转 + 键盘导航
 * 引擎数据从后端动态加载
 */
import { ref, computed, onMounted, watch } from 'vue';
import { enginesApi } from '../api/engines.js';
import { prefsApi } from '../api/prefs.js';

/** 引擎数据（从后端加载） */
const engineList = ref([]);
const displayCount = ref(3);
const enginesLoaded = ref(false);

/** 加载引擎数据 */
async function loadEngines() {
  try {
    const [engRes, prefsRes] = await Promise.all([
      enginesApi.list(),
      prefsApi.get(),
    ]);
    engineList.value = engRes.data;
    displayCount.value = prefsRes.data.engine_display_count || 3;
    enginesLoaded.value = true;
  } catch {
    // 降级：保留一个默认引擎避免搜索完全不可用
    engineList.value = [
      { id: 1, name: 'Google', label: 'G', key: 'google', url_template: 'https://www.google.com/search?q={q}', color: 'sky' },
      { id: 2, name: 'Bing', label: 'B', key: 'bing', url_template: 'https://www.bing.com/search?q={q}', color: 'mint' },
      { id: 3, name: 'AI', label: 'AI', key: 'ai', url_template: 'https://www.perplexity.ai/search?q={q}', color: 'lav' },
    ];
    enginesLoaded.value = true;
  }
}

export function useSearch(getLinks) {
  // 显示的引擎列表（按 display_count 截取）
  const displayedEngines = computed(() => {
    return engineList.value.slice(0, displayCount.value);
  });

  const query = ref('');
  const engineKey = ref(localStorage.getItem('searchEngine') || 'google');
  const activeIndex = ref(-1);

  /** 当前选中引擎 */
  const currentEngine = computed(() => {
    return engineList.value.find((e) => e.key === engineKey.value) || displayedEngines.value[0];
  });

  /** 当前搜索引擎 label */
  const engineLabel = computed(() => currentEngine.value?.label || 'G');

  /** 当前搜索引擎名称 */
  const engineName = computed(() => currentEngine.value?.name || 'Google');

  /** 当前搜索引擎颜色 */
  const engineColor = computed(() => currentEngine.value?.color || 'sky');

  /** 本地搜索结果 */
  const results = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return [];
    const links = typeof getLinks === 'function' ? getLinks() : (getLinks?.value ?? getLinks ?? []);
    if (!Array.isArray(links)) return [];
    return links.filter((link) => {
      return link.name?.toLowerCase().includes(q) ||
             link.domain?.toLowerCase().includes(q);
    });
  });

  /** 切换搜索引擎并持久化 */
  function setEngine(key) {
    if (engineList.value.some((e) => e.key === key)) {
      engineKey.value = key;
      localStorage.setItem('searchEngine', key);
    }
  }

  /**
   * 校验 URL 是否为安全的 http/https 协议
   * 防止 javascript:/data:/vbscript: 等危险协议被注入执行
   * @param {string} url - 待校验的 URL
   * @returns {boolean} 是否安全
   */
  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      // URL 解析失败：可能是不完整的相对路径，不安全
      return false;
    }
  }

  /** 执行搜索（跳转搜索引擎） */
  function search() {
    const q = query.value.trim();
    if (!q) return;
    const engine = currentEngine.value;
    if (engine) {
      const url = engine.url_template.replace('{q}', encodeURIComponent(q));
      if (isSafeUrl(url)) {
        window.open(url, '_blank');
      }
    }
  }

  /** 打开书签链接 */
  function openLink(url) {
    if (!url) return;
    if (!isSafeUrl(url)) {
      return;
    }
    window.open(url, '_blank');
  }

  /** 键盘导航：下移 */
  function moveDown() {
    if (results.value.length === 0) return;
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1);
  }

  /** 键盘导航：上移 */
  function moveUp() {
    if (results.value.length === 0) return;
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  }

  /** 确认选中 */
  function confirm() {
    if (activeIndex.value >= 0 && results.value[activeIndex.value]) {
      openLink(results.value[activeIndex.value].url);
      clear();
    } else if (results.value.length > 0) {
      openLink(results.value[0].url);
      clear();
    } else {
      search();
    }
  }

  /** 清空搜索 */
  function clear() {
    query.value = '';
    activeIndex.value = -1;
  }

  // 组件挂载时加载引擎数据
  onMounted(() => {
    if (!enginesLoaded.value) {
      loadEngines();
    }
  });

  // 监听引擎变化，如当前选中引擎不在列表中，切换到第一个
  watch(displayedEngines, (engs) => {
    if (engs.length > 0 && !engs.some((e) => e.key === engineKey.value)) {
      engineKey.value = engs[0].key;
      localStorage.setItem('searchEngine', engineKey.value);
    }
  }, { immediate: true });

  return {
    query,
    engineKey,
    engineLabel,
    engineName,
    engineColor,
    displayedEngines,
    engines: engineList,
    results,
    activeIndex,
    setEngine,
    search,
    openLink,
    moveDown,
    moveUp,
    confirm,
    clear,
  };
}
