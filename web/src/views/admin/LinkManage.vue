<script setup>
/**
 * 书签管理页（Naive UI 版本）
 * - 筛选栏、批量检测、置顶、加密、批量删除
 * - PC 表格 + 移动端卡片列表
 * - 弹窗表单 / 回收站 已拆分为独立子组件：
 *   - LinkFormModal   新建/编辑弹窗表单
 *   - LinkTrashTable  回收站（恢复/彻底删除）
 */
import { ref, computed, onMounted, onBeforeUnmount, h, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useDataStore } from '../../stores/data.js';
import { usePrefsStore } from '../../stores/prefs.js';
import { useResponsive } from '../../composables/useResponsive.js';
import { usePagination } from '../../composables/usePagination.js';
import { useBatchOps } from '../../composables/useBatchOps.js';
import FaviconAvatar from '../../components/ui/FaviconAvatar.vue';
import { vaultApi } from '../../api/vault.js';
import { linkApi } from '../../api/link.js';
import {
  NPageHeader,
  NButton,
  NDataTable,
  NCard,
  NInput,
  NSelect,
  NSpace,
  NEmpty,
  NTag,
  NSwitch,
  NCheckbox,
  NPagination,
  NTooltip,
  NModal,
  NText,
  useDialog,
  useMessage,
} from 'naive-ui';
import LinkFormModal from '../../components/admin/linkmanage/LinkFormModal.vue';
import LinkTrashTable from '../../components/admin/linkmanage/LinkTrashTable.vue';
import BatchAddModal from '../../components/admin/linkmanage/BatchAddModal.vue';
import { renderAvatar } from '../../composables/useRenderCell.js';

const dataStore = useDataStore();
const prefsStore = usePrefsStore();
const { isMobileView } = useResponsive();
const dialog = useDialog();
const message = useMessage();
const route = useRoute();

/** 仪表盘「异常链接清单」跳转定位：待定位的书签 id（0 表示无） */
const pendingLinkId = ref(0);

/* ---------- 筛选 ---------- */
const filterCat = ref(0);
const searchQ = ref('');
const filterHealth = ref('');
const filterPin = ref('');

/** 置顶状态筛选选项（all 全部 / pinned 已置顶 / unpinned 未置顶） */
const pinOptions = [
  { label: '📌 全部置顶状态', value: '' },
  { label: '📌 已置顶', value: 'pinned' },
  { label: '已取消置顶', value: 'unpinned' },
];

/** 健康状态筛选选项（unknown 表示未检测） */
const healthOptions = [
  { label: '🩺 全部状态', value: '' },
  { label: '🟢 正常', value: 'ok' },
  { label: '🟡 需代理', value: 'blocked' },
  { label: '🔴 打不开', value: 'fail' },
  { label: '💀 死链', value: 'down' },
  { label: '⚪ 跳过', value: 'skip' },
  { label: '❔ 未检测', value: 'unknown' },
];

/* ---------- 分类选项（供 n-select 使用） ---------- */
const catOptions = computed(() => [
  { label: '📑 全部分类', value: 0 },
  ...dataStore.categories.map(c => ({
    label: `${c.emoji} ${c.name}`,
    value: c.id,
  })),
]);

/* ---------- 弹窗状态（表单逻辑已拆分到 LinkFormModal） ---------- */
const modalShow = ref(false);
const modalMode = ref('create');
const editingLink = ref(null);

function openCreate() {
  editingLink.value = null;
  modalMode.value = 'create';
  modalShow.value = true;
}
function openEdit(link) {
  editingLink.value = link;
  modalMode.value = 'edit';
  modalShow.value = true;
}

/* ---------- 批量添加弹窗 ---------- */
const batchShow = ref(false);

function openBatchCreate() {
  batchShow.value = true;
}

/** 批量添加成功后刷新书签列表 */
async function handleBatchSuccess() {
  await dataStore.fetchCategories();
}

const { pagination, syncItemCount, onPageSizeChange, onPageChange } = usePagination();

/* ---------- 业务操作：置顶 / 删除 ---------- */

// 置顶数量上限：8 个（一行显示正好适配当前网页布局）
const MAX_PIN_COUNT = 8;

function getPinnedCount() {
  return dataStore.allLinks.filter(l => l.is_pinned).length;
}

async function togglePin(link) {
  const willPin = !link.is_pinned;
  if (willPin) {
    const pinnedCount = getPinnedCount();
    if (pinnedCount >= MAX_PIN_COUNT) {
      message.warning(`置顶数量不能超过 ${MAX_PIN_COUNT} 个，请先取消其他置顶`);
      return;
    }
  }
  try {
    await dataStore.togglePin(link.id, willPin, null);
    message.success(willPin ? '已置顶' : '已取消置顶');
  } catch (e) {
    message.warning(e.message || '操作失败');
  }
}

/** 标记/取消标记常用书签（无数量上限，独立于置顶） */
async function toggleFavorite(link) {
  const willFav = !link.is_favorite;
  try {
    await dataStore.toggleFavorite(link.id, willFav);
    message.success(willFav ? '已标记为常用' : '已取消常用标记');
  } catch (e) {
    message.warning(e.message || '操作失败');
  }
}

function askDelete(link) {
  dialog.warning({
    title: '确认删除书签',
    content: `即将删除「${link.name}」，操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try { await dataStore.deleteLink(link.id); message.success('已删除'); }
      catch { /* noop */ }
    },
  });
}

/* ---------- 加密/解密 ---------- */
const vaultIsEnabled = ref(false);
const vaultIsSet = ref(false);

async function handleToggleLock(link) {
  if (!vaultIsEnabled.value) {
    message.warning('请先在网站设置中开启保险库功能');
    return;
  }
  if (!vaultIsSet.value) {
    message.warning('请先在网站设置中设置保险库密码');
    return;
  }
  const willLock = !link.is_locked;
  try {
    await dataStore.toggleLinkLock(link.id, willLock);
    message.success(willLock ? '已加密' : '已解密');
  } catch (e) {
    message.warning(e.message || '操作失败');
  }
}

/* ---------- 批量删除（useBatchOps 组合式函数） ---------- */
const { checkedRowKeys, batchDeleting, askBatchDelete } = useBatchOps({
  deleteItem: (id) => dataStore.deleteLink(id),
  emptyTip: '请先勾选要删除的书签',
  confirmContent: (count) => `将删除选中的 ${count} 个书签，操作不可恢复。`,
  successTip: (count) => `已删除 ${count} 个书签`,
});

/* ---------- 批量移动（移动到其他分类） ---------- */
const showMoveModal = ref(false);
const moveTargetCat = ref(null);
const batchMoving = ref(false);

/** 打开批量移动弹窗：校验已勾选 */
function openBatchMove() {
  if (!checkedRowKeys.value.length) {
    message.warning('请先勾选要移动的书签');
    return;
  }
  moveTargetCat.value = null;
  showMoveModal.value = true;
}

/** 确认批量移动：调用接口后清空勾选并刷新 */
async function confirmBatchMove() {
  if (!moveTargetCat.value) {
    message.warning('请选择目标分类');
    return;
  }
  batchMoving.value = true;
  try {
    const res = await dataStore.batchMoveLinks(checkedRowKeys.value, moveTargetCat.value);
    message.success(res?.message || `已移动 ${checkedRowKeys.value.length} 个书签`);
    showMoveModal.value = false;
    checkedRowKeys.value = [];
  } catch (e) {
    message.warning(e.message || '批量移动失败');
  } finally {
    batchMoving.value = false;
  }
}

/** 批量移动弹窗中的分类选项（排除「全部分类」占位项） */
const moveCatOptions = computed(() =>
  dataStore.categories.map(c => ({
    label: `${c.emoji} ${c.name}`,
    value: c.id,
  }))
);

/* ---------- 链接可用性检测 ---------- */

const checkingIds = ref(new Set());

/** 健康状态 → 圆点类名 + 文案 */
function healthTag(row) {
  switch (row.health_status) {
    case 'ok': return { text: '正常', cls: 'health-ok' };
    case 'blocked': return { text: '需代理', cls: 'health-blocked' };
    case 'fail': return { text: '打不开', cls: 'health-fail' };
    case 'down': return { text: '死链', cls: 'health-down' };
    case 'skip': return { text: '跳过', cls: 'health-skip' };
    default: return { text: '未检测', cls: 'health-none' };
  }
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(u || '');
}

/** 检测单个链接 */
async function handleCheckLink(link) {
  if (!isHttpUrl(link.url)) {
    message.warning('非 HTTP(S) 链接无法检测');
    return;
  }
  if (checkingIds.value.has(link.id)) return;
  checkingIds.value = new Set(checkingIds.value).add(link.id);
  try {
    const res = await linkApi.checkLink(link.id);
    link.health_status = res.data.status;
    link.last_check_at = res.data.checkedAt;
    link.health_note = res.data.note || '';
    if (res.data.status === 'ok') {
      message.success('检测正常');
    } else if (res.data.status === 'blocked') {
      message.warning(`疑似被墙：${res.data.note || '域名仍可解析但本地连接失败'}`);
    } else {
      message.error(`无法访问：${res.data.note || '链接打不开'}`);
    }
  } catch (e) {
    message.warning(e?.message || '检测失败');
  } finally {
    const s = new Set(checkingIds.value);
    s.delete(link.id);
    checkingIds.value = s;
  }
}

/** 批量检测已移除（2026-08-11）：功能与巡检页「立即巡检」重复，统一在 /admin/health 巡检页执行全量检测 */

/* ---------- 过滤后书签 ---------- */

/** 表格最小宽度 = 所有列固定宽度之和（作为 min-width 撑开表格，避免列被压缩） */
const tableScrollX = computed(() => {
  let sum = 28; // selection 列宽度
  for (const c of tableColumns.value) {
    if (typeof c.width === 'number') sum += c.width;
  }
  return sum;
});

const filteredLinks = computed(() => {
  const q = searchQ.value.trim().toLowerCase();
  return dataStore.allLinks.filter((link) => {
    if (filterCat.value && link.category_id !== filterCat.value) return false;
    if (filterHealth.value) {
      if (filterHealth.value === 'unknown') {
        if (link.health_status) return false;
      } else if (link.health_status !== filterHealth.value) return false;
    }
    if (filterPin.value === 'pinned' && !link.is_pinned) return false;
    if (filterPin.value === 'unpinned' && link.is_pinned) return false;
    if (!q) return true;
    return link.name.toLowerCase().includes(q) ||
      (link.domain || '').toLowerCase().includes(q);
  });
});

/** 分页切片：独立分页组件模式下，表格数据需手动按页码/页大小切片（原表格内 :pagination 自动切片已移除） */
const pagedLinks = computed(() => {
  const p = pagination.value;
  const start = (p.page - 1) * p.pageSize;
  return filteredLinks.value.slice(start, start + p.pageSize);
});

/* ---------- 移动端「加载更多」：按批渲染，避免一次性全量渲染几百张卡片 DOM ---------- */
/** 每批加载条数 */
const MOBILE_PAGE_STEP = 20;
const mobileVisibleCount = ref(MOBILE_PAGE_STEP);

/** 移动端可见列表：按已加载条数截取 */
const mobileVisibleLinks = computed(() =>
  filteredLinks.value.slice(0, mobileVisibleCount.value)
);

/** 是否还有更多可加载 */
const hasMoreMobile = computed(() =>
  mobileVisibleCount.value < filteredLinks.value.length
);

/** 加载下一批（滚动到底触发） */
function loadMoreMobile() {
  if (!hasMoreMobile.value) return;
  mobileVisibleCount.value = Math.min(
    mobileVisibleCount.value + MOBILE_PAGE_STEP,
    filteredLinks.value.length
  );
}

/** 过滤条件变化时重置为第一批（重新从头加载） */
watch([searchQ, filterCat, filterHealth, filterPin], () => {
  mobileVisibleCount.value = MOBILE_PAGE_STEP;
});

/* 滚动到底自动加载：IntersectionObserver 监听底部哨兵元素 */
let mobileSentinelObserver = null;
function setupMobileSentinel(el) {
  mobileSentinelObserver?.disconnect();
  if (!el) return;
  mobileSentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMoreMobile();
    },
    { rootMargin: '300px' }
  );
  mobileSentinelObserver.observe(el);
}
onBeforeUnmount(() => mobileSentinelObserver?.disconnect());

watch(
  () => filteredLinks.value.length,
  (len) => syncItemCount(len),
  { immediate: true }
);

/* ---------- 回收站（逻辑已拆分到 LinkTrashTable） ---------- */
const trashMode = ref(false);

function openTrash() {
  trashMode.value = true;
}
function closeTrash() {
  trashMode.value = false;
}

/* ---------- 表格列（PC 端） ---------- */

/* 名称列渲染（favicon + 名称）复用 useRenderCell.js 的 renderAvatar */

/* ---------- 图标列：favicon 获取状态 ---------- */

/** 正在重试获取图标的书签 id 集合 */
const faviconFetchingIds = ref(new Set());

/**
 * 写入书签图标状态到数据源行（触发 store 深层 watch 自动重建列表）
 * @param {Object} link 当前行数据（含 category_id）
 * @param {'ok'|'fail'|null} status - ok=成功 / fail=失败 / null=未获取
 * @param {string} faviconPath - 获取成功后的 favicon 文件名
 */
function applyFaviconStatus(link, status, faviconPath) {
  const src = dataStore.categories
    .find(c => c.id === link.category_id)
    ?.links?.find(l => l.id === link.id);
  const row = src || link;
  row.favicon_path = faviconPath || '';
  row.favicon_status = status;
}

/** 手动重试获取书签 favicon（点击"未获取"/"获取失败"触发，成功/失败都会更新状态） */
async function retryFetchFavicon(link) {
  if (faviconFetchingIds.value.has(link.id)) return;
  faviconFetchingIds.value = new Set([...faviconFetchingIds.value, link.id]);
  try {
    const res = await linkApi.fetchFavicon(link.id);
    const ok = !!(res?.data?.favicon_path);
    applyFaviconStatus(link, ok ? 'ok' : 'fail', res?.data?.favicon_path || '');
    if (ok) {
      message.success(`「${link.name}」图标获取成功`);
    } else {
      message.warning(`「${link.name}」图标获取失败，可再次点击重试`);
    }
  } catch (e) {
    applyFaviconStatus(link, 'fail', '');
    message.warning(e?.message || '图标获取失败，可再次点击重试');
  } finally {
    const next = new Set(faviconFetchingIds.value);
    next.delete(link.id);
    faviconFetchingIds.value = next;
  }
}

/** 图标状态文案（含获取中） */
function favStatusText(link) {
  if (faviconFetchingIds.value.has(link.id)) return '获取中…';
  if (link.favicon_path) return '获取成功';
  return link.favicon_status === 'fail' ? '获取失败' : '未获取';
}

/** 图标状态标签类型 */
function favStatusType(link) {
  if (link.favicon_path) return 'success';
  return link.favicon_status === 'fail' ? 'error' : 'default';
}

/** 图标列：仅状态标签，未获取/获取失败可点击重试（获取成功后名称列自动显示 favicon） */
function renderFaviconCell(link) {
  const fetching = faviconFetchingIds.value.has(link.id);
  const clickable = !fetching && !link.favicon_path;
  return h(NTag, {
    size: 'small', round: true, type: favStatusType(link), bordered: false,
    style: clickable ? 'cursor:pointer;' : '',
    onClick: clickable ? () => retryFetchFavicon(link) : undefined,
  }, () => favStatusText(link));
}

function renderPin(link) {
  // 未置顶且已达上限时禁用开关，避免无效点击
  const pinDisabled = !link.is_pinned && getPinnedCount() >= MAX_PIN_COUNT;
  const switchEl = h(NSwitch, {
    value: !!link.is_pinned,
    onClick: () => togglePin(link),
    size: 'small',
    disabled: pinDisabled,
    class: pinDisabled ? 'pin-switch-disabled' : '',
  });
  // 禁用态包 tooltip，说明置顶上限原因（灰色不可点击态 + 悬停提示）
  const pinCell = pinDisabled
    ? h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () => switchEl,
          default: () => `置顶数量已达上限（${MAX_PIN_COUNT} 个），请先取消其他置顶`,
        }
      )
    : switchEl;
  return h('div', { class: 'pin-cell' }, [
    pinCell,
    link.is_pinned
      ? h('span', { class: 'pin-order' }, `#${link.pin_order ?? 0}`)
      : null,
  ]);
}

/** 渲染常用列：星标切换按钮（无上限，独立于置顶） */
function renderFavorite(link) {
  return h(NButton, {
    size: 'tiny',
    quaternary: true,
    type: link.is_favorite ? 'warning' : 'default',
    onClick: () => toggleFavorite(link),
  }, () => link.is_favorite ? '★ 常用' : '☆ 标记');
}

/** 渲染健康状态列：颜色圆点 + 检测链接按钮；tooltip 汇总检测说明/连续失败/证书剩余天数 */
function renderHealth(link) {
  const hg = healthTag(link);
  const checking = checkingIds.value.has(link.id);
  const tips = [];
  if (link.health_note) tips.push(link.health_note);
  if (link.fail_streak > 0) tips.push(`连续失败 ${link.fail_streak} 次`);
  if (link.tls_expires_at) {
    const days = Math.ceil((new Date(link.tls_expires_at) - Date.now()) / 86400000);
    if (days <= 30) tips.push(days > 0 ? `证书 ${days} 天后过期` : '证书已过期');
  }
  const title = tips.join(' · ');
  return h('div', { class: 'health-cell', title: title || undefined }, [
    h('span', { class: ['health-dot', hg.cls] }),
    h(NButton, {
      size: 'tiny', quaternary: true, type: 'info',
      disabled: checking || !isHttpUrl(link.url),
      loading: checking,
      onClick: () => handleCheckLink(link),
    }, () => '检测'),
  ]);
}

/* ---------- 域名显示开关（全局，控制前台是否显示域名） ---------- */
function renderDomainTitle() {
  return h('div', { class: 'domain-th' }, [
    h('span', { class: 'domain-th-label' }, '域名'),
    h(NSwitch, {
      size: 'small',
      value: prefsStore.showDomain,
      'onUpdate:value': (val) => handleToggleShowDomain(val),
    }),
  ]);
}

async function handleToggleShowDomain(val) {
  try {
    await prefsStore.updateShowDomain(val);
    message.success(val ? '已开启前台域名显示' : '已关闭前台域名显示');
  } catch (e) {
    message.warning(e?.message || '更新失败');
  }
}

const tableColumns = computed(() => {
  const cols = [
    { type: 'selection', width: 28 },
    { title: 'ID', key: 'id', width: 64, align: 'center', ellipsis: { tooltip: true }, sorter: (a, b) => a.id - b.id },
    { title: '排序', key: 'sort_order', width: 76, align: 'center', sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0) },
    {
      title: '名称', key: 'name', width: 200, ellipsis: { tooltip: true },
      sorter: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'),
      render: (row) => renderAvatar(row),
    },
    {
      title: '图标', key: 'favicon', width: 90, align: 'center',
      render: (row) => renderFaviconCell(row),
    },
    {
      title: () => renderDomainTitle(),
      key: 'domain',
      width: 130,
      ellipsis: { tooltip: true },
      render: (row) => h('span', {
        title: row.domain || undefined,
        style: 'display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; color: var(--admin-muted); font-size: 13px;',
      }, row.domain || '—'),
    },
    {
      title: '健康状态', key: 'health', width: 100, align: 'center',
      render: (row) => renderHealth(row),
    },
    {
      title: '备注', key: 'note', ellipsis: { tooltip: true }, width: 180,
      render: (row) => h('span', {
        style: row.note
          ? 'color: var(--admin-text); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          : 'color: var(--admin-muted); font-size: 13px;',
      }, row.note || '—'),
    },
    {
      title: '分类', key: 'categoryName', width: 110,
      render: (row) => h(NTag, {
        size: 'small', round: true, type: 'info', bordered: false,
      }, () => h('span', {
        style: 'display: inline-block; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;',
      }, row.categoryName)),
    },
    {
      title: '置顶', key: 'pin', width: 96, align: 'center',
      render: (row) => renderPin(row),
    },
    {
      title: '常用', key: 'is_favorite', width: 86, align: 'center',
      render: (row) => renderFavorite(row),
    },
  ];

  // 保险库开启时才显示加密列
  if (vaultIsEnabled.value) {
    cols.push({
      title: '加密', key: 'is_locked', width: 72, align: 'center',
      render: (row) => h(NTag, {
        round: true, size: 'small',
        type: row.is_locked ? 'warning' : 'default',
      }, () => h('span', {
        style: 'display: inline-block; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;',
      }, row.is_locked ? '🔒 已加密' : '—')),
    });
  }

  cols.push({
    title: '操作', key: 'ops', width: vaultIsEnabled.value ? 210 : 150, align: 'left',
    render: (row) => h(NSpace, { size: 6, align: 'center' }, () => {
      const btns = [];
      if (vaultIsEnabled.value) {
        btns.push(h(NButton, {
          size: 'small', quaternary: true,
          type: row.is_locked ? 'warning' : 'info',
          onClick: () => handleToggleLock(row),
        }, () => row.is_locked ? '🔓 解密' : '🔒 加密'));
      }
      btns.push(h(NButton, {
        size: 'small', type: 'primary', quaternary: true,
        onClick: () => openEdit(row),
      }, () => '编辑'));
      btns.push(h(NButton, {
        size: 'small', type: 'error', tertiary: true,
        onClick: () => askDelete(row),
      }, () => '删除'));
      return btns;
    }),
  });

  return cols;
});

onMounted(() => {
  // 始终以管理员模式刷新数据：公开缓存不含 health_status 等后台字段，会导致状态筛选失效
  dataStore.fetchCategories();
  // 查询保险库是否已设置密码
  vaultApi.getStatus().then(res => {
    vaultIsEnabled.value = res.data.isEnabled;
    vaultIsSet.value = res.data.isSet;
  }).catch(() => {});

  // 从仪表盘「异常链接清单」跳转而来：自动应用健康状态筛选 + 定位目标链接
  const qHealth = Array.isArray(route.query.health) ? route.query.health[0] : route.query.health;
  if (qHealth && healthOptions.some((o) => o.value === qHealth)) {
    filterHealth.value = qHealth;
  }
  const qId = Number(route.query.linkId);
  if (Number.isInteger(qId) && qId > 0) {
    pendingLinkId.value = qId;
  }
});

/** 仪表盘跳转定位：数据就绪后按名称过滤 + 页码定位到目标链接 */
watch(
  () => dataStore.allLinks.length,
  (len) => {
    if (!pendingLinkId.value || !len) return;
    const link = dataStore.allLinks.find((l) => l.id === pendingLinkId.value);
    if (!link) return;
    pendingLinkId.value = 0;
    if (!searchQ.value) searchQ.value = link.name || '';
    nextTick(() => {
      const idx = filteredLinks.value.findIndex((l) => l.id === link.id);
      if (idx >= 0) {
        pagination.value.page = Math.floor(idx / pagination.value.pageSize) + 1;
      }
    });
  },
  { immediate: true }
);
</script>

<template>
  <div class="page">
    <n-page-header
      title="书签管理"
      class="page-header"
    >
      <template #extra>
        <n-space v-if="trashMode" align="center">
          <n-button secondary @click="closeTrash">← 返回列表</n-button>
        </n-space>
        <n-space v-else align="center">
          <n-button
            v-if="!isMobileView && checkedRowKeys.length"
            secondary
            :loading="batchMoving"
            @click="openBatchMove"
          >移动到分类 ({{ checkedRowKeys.length }})</n-button>
          <n-button
            v-if="!isMobileView && checkedRowKeys.length"
            type="error"
            tertiary
            :loading="batchDeleting"
            @click="askBatchDelete"
          >批量删除 ({{ checkedRowKeys.length }})</n-button>
          <n-button secondary @click="openTrash">🗑 回收站</n-button>
          <n-button secondary @click="openBatchCreate">📋 批量添加</n-button>
          <n-button type="primary" @click="openCreate">
            <template #icon>＋</template>
            新建书签
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <!-- 筛选栏 -->
    <n-card v-if="!trashMode" class="filter-card" embedded size="small">
      <div class="filter-row">
        <n-select
          v-model:value="filterCat"
          :options="catOptions"
          :clearable="false"
          size="medium"
          class="filter-cat"
        />
        <n-select
          v-model:value="filterHealth"
          :options="healthOptions"
          :clearable="false"
          size="medium"
          class="filter-health"
        />
        <n-select
          v-model:value="filterPin"
          :options="pinOptions"
          :clearable="false"
          size="medium"
          class="filter-pin"
        />
        <n-input
          v-model:value="searchQ"
          placeholder="搜索书签名称或域名..."
          clearable
          class="filter-search"
        >
          <template #prefix>🔍</template>
        </n-input>
      </div>
    </n-card>

    <!-- ============ PC 表格 ============ -->
    <n-card v-if="!trashMode && !isMobileView" class="table-card" content-style="padding:0" :bordered="false">
      <!-- 外层横向滚动容器：列宽总和超过容器宽度时出现滚动条，列不被压缩；分页在容器外，滚动条位于分页上方 -->
      <div class="table-scroll-wrap">
        <n-data-table
          :columns="tableColumns"
          :data="pagedLinks"
          :row-key="(r) => r.id"
          :checked-row-keys="checkedRowKeys"
          :style="{ minWidth: tableScrollX + 'px' }"
          @update:checked-row-keys="(keys) => checkedRowKeys = keys"
          :bordered="false"
          striped
          :max-height="640"
        >
          <template #empty>
            <n-empty description="这里空空的，点右上角「新建书签」加一个吧～" />
          </template>
        </n-data-table>
      </div>
      <!-- 独立分页：位于滚动容器之外，横向滚动条在表格底部、分页上方 -->
      <div v-if="filteredLinks.length" class="table-pagination">
        <n-pagination
          :page="pagination.page"
          :page-size="pagination.pageSize"
          :item-count="pagination.itemCount"
          :show-size-picker="true"
          :page-sizes="pagination.pageSizes"
          :prefix="pagination.prefix"
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </n-card>

    <!-- ============ 移动端卡片 ============ -->
    <div v-else-if="!trashMode" class="mobile-list">
      <!-- 移动端批量操作栏 -->
      <div v-if="filteredLinks.length" class="mob-batch-bar">
        <n-checkbox
          :checked="checkedRowKeys.length === mobileVisibleLinks.length && mobileVisibleLinks.length > 0"
          @update:checked="(val) => {
            checkedRowKeys = val ? mobileVisibleLinks.map(l => l.id) : [];
          }"
        >全选</n-checkbox>
        <n-button
          v-if="checkedRowKeys.length"
          size="small"
          secondary
          :loading="batchMoving"
          @click="openBatchMove"
        >移动到</n-button>
        <n-button
          v-if="checkedRowKeys.length"
          size="small"
          type="error"
          tertiary
          :loading="batchDeleting"
          @click="askBatchDelete"
        >删除选中 ({{ checkedRowKeys.length }})</n-button>
      </div>
      <template v-if="filteredLinks.length">
        <n-card
          v-for="link in mobileVisibleLinks"
          :key="link.id"
          class="mob-card"
          hoverable
        >
          <div class="mob-head">
            <FaviconAvatar
              :favicon-path="link.favicon_path || ''"
              :avatar-text="link.avatar_text || ''"
              :avatar-color="link.avatar_color || ''"
            />
            <div class="mob-titles">
              <a v-if="link.url" class="mob-name" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.name }}</a>
              <span v-else class="mob-name">{{ link.name }}</span>
              <div class="mob-domain">{{ link.domain || link.url }}</div>
            </div>
            <div class="mob-pin">
              <span class="mob-pin-label">置顶</span>
              <n-switch
                :value="!!link.is_pinned"
                @click="togglePin(link)"
                size="small"
                :disabled="!link.is_pinned && getPinnedCount() >= MAX_PIN_COUNT"
              />
            </div>
          </div>
          <div class="mob-meta">
            <n-tag size="small" round type="info" :bordered="false">
              {{ link.categoryName }}
            </n-tag>
            <n-tag
              v-if="!link.favicon_path"
              size="small"
              round
              :type="favStatusType(link)"
              :bordered="false"
              class="fav-retry"
              style="cursor:pointer;"
              @click="retryFetchFavicon(link)"
            >{{ favStatusText(link) }}</n-tag>
            <span class="health-mini" :title="link.health_note || ''">
              <span :class="['health-dot', healthTag(link).cls]" />
              <span :class="['mob-sort', healthTag(link).cls]">{{ healthTag(link).text }}</span>
            </span>
            <span class="mob-sort">排序 {{ link.sort_order }}</span>
            <n-tag v-if="vaultIsEnabled && link.is_locked" round size="small" type="warning">🔒</n-tag>
          </div>
          <div v-if="link.note" class="mob-note">{{ link.note }}</div>
          <div class="mob-ops">
            <n-checkbox
              :checked="checkedRowKeys.includes(link.id)"
              @update:checked="(val) => {
                if (val) {
                  checkedRowKeys = [...checkedRowKeys, link.id];
                } else {
                  checkedRowKeys = checkedRowKeys.filter(id => id !== link.id);
                }
              }"
            />
            <n-button
              size="small"
              quaternary
              :type="link.is_favorite ? 'warning' : 'default'"
              @click="toggleFavorite(link)"
            >{{ link.is_favorite ? '★ 常用' : '☆ 常用' }}</n-button>
            <n-button
              size="small"
              quaternary
              type="info"
              :loading="checkingIds.has(link.id)"
              :disabled="!isHttpUrl(link.url)"
              @click="handleCheckLink(link)"
            >检测</n-button>
            <n-button
              v-if="vaultIsEnabled"
              size="small"
              quaternary
              :type="link.is_locked ? 'warning' : 'info'"
              @click="handleToggleLock(link)"
            >{{ link.is_locked ? '🔓' : '🔒' }}</n-button>
            <n-button size="small" type="primary" quaternary @click="openEdit(link)">编辑</n-button>
            <n-button size="small" type="error" tertiary @click="askDelete(link)">删除</n-button>
          </div>
        </n-card>
        <!-- 移动端加载更多：底部哨兵进入视口时自动追加一批 -->
        <div v-if="hasMoreMobile" :ref="setupMobileSentinel" class="mob-loadmore">
          上滑加载更多…
        </div>
        <div v-else-if="filteredLinks.length > MOBILE_PAGE_STEP" class="mob-loadmore done">
          已全部加载
        </div>
      </template>
      <n-empty v-else description="这里还没有书签哦～" />
    </div>

    <!-- ============ 回收站（子组件） ============ -->
    <LinkTrashTable v-if="trashMode" @close="closeTrash" />

    <!-- ============ 新建/编辑弹窗（子组件） ============ -->
    <LinkFormModal
      v-model:show="modalShow"
      :mode="modalMode"
      :link="editingLink"
      :cat-options="catOptions"
    />

    <!-- ============ 批量添加弹窗（子组件） ============ -->
    <BatchAddModal
      v-model:show="batchShow"
      :cat-options="catOptions"
      @success="handleBatchSuccess"
    />

    <!-- ============ 批量移动到分类弹窗 ============ -->
    <n-modal
      v-model:show="showMoveModal"
      preset="card"
      title="移动到分类"
      style="width: min(420px, 90vw)"
      :mask-closable="false"
    >
      <div class="move-modal">
        <n-text depth="3">
          已选 <b>{{ checkedRowKeys.length }}</b> 个书签，请选择要移动到的目标分类：
        </n-text>
        <n-select
          v-model:value="moveTargetCat"
          :options="moveCatOptions"
          placeholder="选择目标分类"
          size="large"
          filterable
        />
        <div class="move-actions">
          <n-button @click="showMoveModal = false">取消</n-button>
          <n-button
            type="primary"
            :loading="batchMoving"
            @click="confirmBatchMove"
          >确认移动</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
/* ========== 移动端卡片长文本防溢出（与巡检页 IssueManage 处理一致） ========== */
/* 卡片兜底裁剪，避免长文本撑出横向滚动条 */
.mob-card {
  overflow: hidden;
  min-width: 0;
}
/* 头部 flex 保护：允许子项压缩 */
.mob-head {
  min-width: 0;
}
/* 链接标题为 <a> 内联元素，需转块级后单行省略才对长文本生效 */
.mob-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 移动端加载更多提示 */
.mob-loadmore {
  text-align: center;
  padding: 14px 0 6px;
  font-size: 12px;
  color: var(--admin-muted);
}
.mob-loadmore.done {
  color: var(--admin-muted);
}

.page-header {
  margin-bottom: 16px;
}

/* 域名列表头：文字 + 全局开关 */
:deep(.domain-th) {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.domain-th-label) {
  font-weight: 600;
}
:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
  white-space: nowrap;
}

/* 筛选栏 */
.filter-card {
  border-radius: 16px !important;
  margin-bottom: 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.filter-cat {
  width: 150px;
  flex-shrink: 0;
}
.filter-health {
  width: 140px;
  flex-shrink: 0;
}
.filter-pin {
  width: 140px;
  flex-shrink: 0;
}
.filter-search {
  flex: 1;
  min-width: 0;
}
/* 移动端筛选栏：3 个下拉等分一行换行排列 + 搜索框占满整行，避免横向溢出 */
@media (max-width: 1023px) {
  .filter-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-cat,
  .filter-health,
  .filter-pin {
    flex: 1 1 calc((100% - 16px) / 3);
    width: auto;
    min-width: 0;
  }
  .filter-search {
    flex: 1 1 100%;
  }
}

/* 头像 */
.pin-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* 置顶达上限的禁用开关：灰色不可点击态，视觉上更明显 */
.pin-cell .n-switch.n-switch--disabled {
  opacity: .4;
  filter: grayscale(1);
}
.pin-order {
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-accent);
}

/* 批量移动弹窗 */
.move-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.move-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
</style>

<style>
/* 健康状态（全局样式：PC 表格列 render 用 h() 创建的元素不带本组件 scopeId，scoped 选择器无法命中） */
.health-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.health-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
/* 背景色只作用于圆点（health-dot），避免文本被染成色块 */
.health-dot.health-ok { background: #18a058; box-shadow: 0 0 0 3px rgba(24, 160, 88, .15); }
.health-dot.health-blocked { background: #e6a23c; box-shadow: 0 0 0 3px rgba(230, 162, 60, .18); }
.health-dot.health-fail { background: #d03050; box-shadow: 0 0 0 3px rgba(208, 48, 80, .15); }
.health-dot.health-down { background: #a00000; box-shadow: 0 0 0 3px rgba(160, 0, 0, .15); }
.health-dot.health-skip { background: #909399; }
.health-dot.health-none { background: #c0c4cc; }
/* 红黄绿灰状态文字着色（移动端迷你状态用） */
.mob-sort.health-ok { color: #18a058; }
.mob-sort.health-blocked { color: #e6a23c; }
.mob-sort.health-fail { color: #d03050; }
.mob-sort.health-skip,
.mob-sort.health-none { color: var(--admin-muted); }
.health-mini {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
