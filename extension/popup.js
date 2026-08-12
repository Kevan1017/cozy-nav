/* popup 一键收藏（#42）
 * 状态机：无服务器地址 → 设置区；有地址未登录 → 登录区；已登录 → 收藏区
 */
const $ = (id) => document.getElementById(id);

/** 当前等待分类下拉加载的 Promise（重复收藏时避免并发错乱） */
let categoryLoaded = false;

init();

async function init() {
  // 回填当前标签页信息（URL/标题）
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) $('linkUrl').value = tab.url;
  if (tab?.title) $('linkTitle').value = tab.title;

  const serverUrl = await CNAV.getServerUrl();
  if (!serverUrl) {
    // 未配置服务器 → 设置区
    show('sec-settings');
    return;
  }
  $('serverUrl').value = serverUrl;

  const token = await CNAV.getToken();
  if (!token) {
    // 已配置地址但未登录 → 登录区
    show('sec-login');
    return;
  }
  // 已登录 → 收藏区
  show('sec-save');
  $('loggedUser').textContent = '已登录';
  $('btnLogout').classList.remove('hidden');
  await loadCategories();
  // 校验链接地址是否可收藏
  checkUrlEditable();
}

/** 切换显示区块 */
function show(secId) {
  ['sec-settings', 'sec-login', 'sec-save'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== secId);
  });
}

/** 链接地址输入变化时重置重复提示 */
function checkUrlEditable() {
  $('dupBox').classList.add('hidden');
  $('saveTip').textContent = '';
}

/* ==================== 设置区 ==================== */
$('btnSaveServer').addEventListener('click', async () => {
  const url = $('serverUrl').value.trim();
  if (!/^https?:\/\/.+/.test(url)) {
    $('serverUrl').style.borderColor = '#e55';
    return;
  }
  $('serverUrl').style.borderColor = '';
  await CNAV.saveServerUrl(url);
  // 切换服务器后，旧环境的登录 Token 在新服务器上无效（各环境 JWT_SECRET 不同），
  // 必须清除并重新登录，否则会一直用旧 Token 请求新地址导致收藏失败
  await CNAV.clearToken();
  show('sec-login');
  $('loggedUser').textContent = '';
  $('btnLogout').classList.add('hidden');
  $('loginTip').textContent = '已切换服务器，请使用该环境账号重新登录';
  $('username').focus();
});

/* 设置入口：已配置用户也能回到设置区修改地址 */
$('btnSettings').addEventListener('click', () => {
  show('sec-settings');
});

/* ==================== 登录区 ==================== */
$('btnLogin').addEventListener('click', async () => {
  const username = $('username').value.trim();
  const password = $('password').value;
  if (!username || !password) {
    $('loginTip').textContent = '请输入用户名和密码';
    return;
  }
  $('btnLogin').disabled = true;
  $('btnLogin').textContent = '登录中…';
  $('loginTip').textContent = '';
  const res = await CNAV.api('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  $('btnLogin').disabled = false;
  $('btnLogin').textContent = '登录';
  if (res.ok && res.data?.token) {
    await CNAV.saveToken(res.data.token);
    show('sec-save');
    $('loggedUser').textContent = `已登录：${res.data.username || username}`;
    $('btnLogout').classList.remove('hidden');
    await loadCategories();
  } else {
    $('loginTip').textContent = res.message || '登录失败';
  }
});

/* ==================== 收藏区 ==================== */
/** 加载分类下拉（GET /api/categories 公开接口，无需登录也能拿列表） */
async function loadCategories() {
  const sel = $('category');
  sel.innerHTML = '<option value="">加载中…</option>';
  const res = await CNAV.api('/api/categories');
  const list = res.ok ? (res.data || []) : [];
  if (!list.length) {
    sel.innerHTML = '<option value="">（暂无分类，请先在后台创建）</option>';
    return;
  }
  sel.innerHTML = '';
  list.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  // 回填最近使用的分类
  const lastId = await CNAV.getLastCategoryId();
  if (lastId && list.some((c) => c.id === lastId)) sel.value = String(lastId);
  categoryLoaded = true;
}

/** 收藏（force=true 时允许重复） */
async function doSave(force) {
  const url = $('linkUrl').value.trim();
  const name = $('linkTitle').value.trim();
  const categoryId = Number($('category').value);
  const note = $('note').value.trim();

  if (!/^https?:\/\//.test(url)) {
    $('saveTip').textContent = '链接地址必须以 http:// 或 https:// 开头';
    return;
  }
  if (!name) {
    $('saveTip').textContent = '请填写名称';
    return;
  }
  if (!categoryId) {
    $('saveTip').textContent = '请选择分类（可在后台先创建分类）';
    return;
  }

  $('btnSave').disabled = true;
  $('btnSave').textContent = '收藏中…';
  $('saveTip').textContent = '';
  const res = await CNAV.api('/api/links', {
    method: 'POST',
    body: { category_id: categoryId, name, url, note, force },
  });
  $('btnSave').disabled = false;
  $('btnSave').textContent = '收藏';

  if (res.ok) {
    await CNAV.saveLastCategoryId(categoryId);
    $('saveTip').textContent = '✅ 收藏成功';
    $('saveTip').style.color = '#1e7a4a';
    // 收藏成功后允许连续收藏，仅提示
    setTimeout(() => {
      $('saveTip').textContent = '';
      $('saveTip').style.color = '';
    }, 2500);
  } else if (res.code === 409) {
    // 重复链接：提示并给出"仍要收藏"
    const dup = res.data?.duplicate;
    $('dupMsg').textContent = dup
      ? `该地址已收藏过（「${dup.name}」），是否仍要收藏？`
      : '该地址已收藏过，是否仍要收藏？';
    $('dupBox').classList.remove('hidden');
    $('saveTip').textContent = '';
  } else {
    $('saveTip').textContent = res.message || '收藏失败';
    $('saveTip').style.color = '#c0392b';
  }
}

$('btnSave').addEventListener('click', () => doSave(false));
$('btnForce').addEventListener('click', () => doSave(true));
$('linkUrl').addEventListener('input', checkUrlEditable);

/* ==================== 退出登录 ==================== */
$('btnLogout').addEventListener('click', async () => {
  await CNAV.clearToken();
  show('sec-login');
  $('loggedUser').textContent = '';
  $('btnLogout').classList.add('hidden');
  $('password').value = '';
});
