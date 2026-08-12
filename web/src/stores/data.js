/**
 * 分类 + 书签数据管理
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { categoryApi } from '../api/category.js';
import { linkApi } from '../api/link.js';

export const useDataStore = defineStore('data', () => {
  const categories = ref([]);
  const isLoading = ref(false);
  const allLinksList = ref([]);

  function rebuildAllLinks() {
    const links = [];
    for (const cat of categories.value) {
      for (const link of cat.links || []) {
        links.push({ ...link, categoryName: cat.name });
      }
    }
    allLinksList.value = links;
  }

  watch(categories, () => rebuildAllLinks(), { deep: true });

  /** 置顶书签列表 */
  const pinnedLinks = computed(() => {
    return allLinksList.value
      .filter(l => l.is_pinned)
      .sort((a, b) => a.pin_order - b.pin_order);
  });

  /** 所有书签（扁平化） */
  const allLinks = computed(() => allLinksList.value);

  /** 进行中的请求缓存（按 admin/public 分键），避免并行触发时重复请求 */
  const pendingFetches = new Map();
  /** 最近一次成功加载的模式（null=未加载 / public=前台公开 / admin=后台管理），用于前台首页跳过重复请求 */
  const loadedMode = ref(null);

  /**
   * 获取所有分类（含书签）
   * @param {boolean} forAdmin - true=管理后台（带登录token看完整数据），false=前台公开访问
   */
  async function fetchCategories(forAdmin = true) {
    // 相同类型的请求已在途时直接复用，防止首页预取与组件挂载重复发起
    const key = forAdmin ? 'admin' : 'public';
    if (pendingFetches.has(key)) return pendingFetches.get(key);

    isLoading.value = true;
    const p = (async () => {
      try {
        const res = await categoryApi.getAll(!forAdmin);
        categories.value = res.data;
        loadedMode.value = key;
        return res;
      } finally {
        isLoading.value = false;
        pendingFetches.delete(key);
      }
    })();
    pendingFetches.set(key, p);
    return p;
  }

  /**
   * 前台首页专用：公开数据已加载时直接复用，避免懒加载路由晚挂载导致的重复请求
   * （重复请求会让 isLoading 重新置 true，把置顶板块推迟数百毫秒）
   */
  async function ensurePublicLoaded() {
    // 已在途的公开请求直接复用（main.js 预取可能仍在进行）
    if (pendingFetches.has('public')) return pendingFetches.get('public');
    // 公开数据已加载过则不再请求（后台增删改会走 fetchCategories 主动刷新）
    if (loadedMode.value === 'public') return;
    return fetchCategories(false);
  }

  /** 新建分类 */
  async function createCategory(data) {
    const res = await categoryApi.create(data);
    await fetchCategories();
    return res;
  }

  /** 编辑分类 */
  async function updateCategory(id, data) {
    const res = await categoryApi.update(id, data);
    await fetchCategories();
    return res;
  }

  /** 删除分类 */
  async function deleteCategory(id) {
    const res = await categoryApi.remove(id);
    await fetchCategories();
    return res;
  }

  /** 新建书签 */
  async function createLink(data) {
    const res = await linkApi.create(data);
    await fetchCategories();
    return res;
  }

  /** 编辑书签 */
  async function updateLink(id, data) {
    const res = await linkApi.update(id, data);
    await fetchCategories();
    return res;
  }

  /** 删除书签 */
  async function deleteLink(id) {
    const res = await linkApi.remove(id);
    await fetchCategories();
    return res;
  }

  /** 置顶/取消置顶书签 */
  async function togglePin(id, pinned, order) {
    const res = await linkApi.togglePin(id, pinned, order);
    await fetchCategories();
    return res;
  }

  /** 切换分类锁定状态 */
  async function toggleCategoryLock(id, locked) {
    const res = await categoryApi.toggleLock(id, locked);
    await fetchCategories();
    return res;
  }

  /** 切换书签锁定状态 */
  async function toggleLinkLock(id, locked) {
    const res = await linkApi.toggleLock(id, locked);
    await fetchCategories();
    return res;
  }

  /** 批量移动书签到目标分类（ids 为书签 ID 数组） */
  async function batchMoveLinks(ids, categoryId) {
    const res = await linkApi.batchMove(ids, categoryId);
    await fetchCategories();
    return res;
  }

  /** 同步分类排序结果（后端已落库，仅更新本地 sort_order，避免全量刷新） */
  function updateCategoriesOrder(orders) {
    // orders: [{ id, sort_order }]，按 id 映射新排序权重
    const orderMap = new Map(orders.map((o) => [o.id, o.sort_order]));
    categories.value = categories.value.map((c) => {
      const so = orderMap.get(c.id);
      return so ? { ...c, sort_order: so } : c;
    });
  }

  return {
    categories, isLoading, pinnedLinks, allLinks,
    fetchCategories, ensurePublicLoaded, createCategory, updateCategory, deleteCategory,
    updateCategoriesOrder,
    createLink, updateLink, deleteLink, togglePin,
    toggleCategoryLock, toggleLinkLock, batchMoveLinks,
  };
});
