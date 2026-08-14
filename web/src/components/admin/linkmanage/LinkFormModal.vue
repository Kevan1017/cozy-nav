<script setup>
/**
 * 书签管理 - 新建/编辑表单（从 LinkManage.vue 拆出）
 * - URL / 名称 / 分类 / 备注 / 域名 / 头像文字 / 头像颜色 / 排序权重
 * - 手动获取 favicon / 网页标题（不自动获取，点击按钮才请求，自动补全协议）
 * - 保存时处理重复链接（业务码 409）二次确认
 */
import { ref, computed, watch, nextTick, h } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NCheckbox,
  useMessage,
  useDialog,
} from 'naive-ui';
import { useDataStore } from '../../../stores/data.js';
import { linkApi } from '../../../api/link.js';
import { resolveColor, displayHex } from '../../../composables/useColor.js';
import { normalizeUrl } from '../../../utils/urlNormalize.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: 'create' }, // 'create' | 'edit'
  link: { type: Object, default: null },     // 编辑时传入的书签行
  catOptions: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:show']);

const dataStore = useDataStore();
const message = useMessage();
const dialog = useDialog();

/* ---------- 常量：头像颜色（与 tokens.css 对齐） ---------- */
const BG_COLORS = [
  'peach', 'mint', 'lav', 'sky', 'rose', 'butter',
  'coral', 'aqua', 'sage', 'lilac', 'sand', 'foam',
  'cherry', 'lemon', 'teal', 'mauve', 'fog', 'apricot',
  'seafoam', 'blush', 'mist', 'citrus', 'perwinkle', 'tangerine',
  'sage2', 'berry', 'dove', 'amber', 'turquoise', 'violet',
  'vermilion', 'emerald', 'saffron', 'mauve2', 'olive', 'magenta', 'jade'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- 弹窗显示（computed 包装 props.show，支持 v-model） ---------- */
const modalShow = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
});
const modalMode = computed(() => props.mode);

/* ---------- 表单 ---------- */
const submitting = ref(false);
const formRef = ref(null);

function emptyForm() {
  const firstCat = dataStore.categories[0];
  return {
    id: null,
    category_id: firstCat?.id || 0,
    name: '',
    url: '',
    domain: '',
    avatar_text: '',
    avatar_color: 'peach',
    sort_order: 0,
    note: '',
    is_favorite: false,
  };
}
const form = ref(emptyForm());

const rules = {
  category_id: { type: 'number', required: true, message: '请选择分类', trigger: ['change', 'submit'] },
  name: { required: true, message: '请输入书签名称', trigger: ['input', 'submit'] },
  url: [
    { required: true, message: '请输入 URL', trigger: ['input', 'submit'] },
    {
      // 严格校验：必须以 http:// 或 https:// 开头，且 new URL() 能解析
      validator: (_r, value) => {
        if (!value) return true;
        const v = value.trim();
        if (!/^https?:\/\//i.test(v)) {
          return new Error('URL 必须以 http:// 或 https:// 开头');
        }
        try {
          const parsed = new URL(v);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return new Error('URL 协议不合法');
          }
          if (!parsed.hostname || !parsed.hostname.includes('.')) {
            return new Error('URL 域名不完整');
          }
          return true;
        } catch {
          return new Error('URL 格式不合法');
        }
      },
      trigger: ['input', 'blur', 'submit'],
    },
  ],
};

function randomAvatarColor() { form.value.avatar_color = pickRandom(BG_COLORS); }

/* ---------- 手动获取 favicon / 标题 ---------- */
const faviconFetching = ref(false);
const titleFetching = ref(false);
const faviconUploading = ref(false);
const formFaviconPath = ref('');
/** 创建模式下暂存的自定义图标 data URL（无书签 ID，保存时随表单提交） */
const faviconDataUrl = ref('');
/** 隐藏的文件选择框 */
const faviconFileInput = ref(null);

/* 打开时按模式初始化表单（create → 空表单；edit → 回填行数据）
 * 注意：必须声明在 formFaviconPath / faviconDataUrl 之后，否则 immediate 回调触发 TDZ 错误 */
watch(
  () => [props.show, props.mode, props.link],
  ([show, mode, link]) => {
    if (!show) return;
    if (mode === 'edit' && link) {
      form.value = {
        id: link.id,
        category_id: link.category_id,
        name: link.name,
        url: link.url,
        domain: link.domain || '',
        avatar_text: link.avatar_text || '',
        avatar_color: link.avatar_color || 'peach',
        sort_order: link.sort_order ?? null,
        note: link.note || '',
        is_favorite: !!link.is_favorite,
      };
      formFaviconPath.value = link.favicon_path || '';
      faviconDataUrl.value = '';
    } else {
      form.value = emptyForm();
      formFaviconPath.value = '';
      faviconDataUrl.value = '';
    }
    nextTick(() => formRef.value?.restoreValidation());
  },
  { immediate: true }
);

/** 触发隐藏文件选择框 */
function triggerFaviconUpload() {
  faviconFileInput.value?.click();
}

/**
 * 读取图片文件并用 canvas 压缩为 64x64 PNG（透明背景填充白色，避免深色图标看不清）
 * 优先使用 createImageBitmap 在解码阶段就缩放到目标尺寸，避免解码超大原图导致卡顿
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
async function compressToPng(file) {
  const size = 64;
  const toDataUrl = (source) => new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // 白底，保证深色图标在小尺寸下依然清晰
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    // 等比缩放居中绘制（contain），不拉伸变形
    const scale = Math.min(size / source.width, size / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
    try {
      resolve(canvas.toDataURL('image/png'));
    } catch (err) {
      reject(err);
    }
  });

  // ① createImageBitmap：解码时按 64px 缩放，大图也快（不支持时回退 Image）
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high',
        imageOrientation: 'from-image',
      });
      try {
        return await toDataUrl(bmp);
      } finally {
        bmp.close();
      }
    } catch { /* 回退到 Image 方式 */ }
  }

  // ② 回退方案：Image 解码后绘制
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片解析失败'));
    };
    img.src = objectUrl;
  });
}

/** 文件选择后：压缩 → 上传 → 即时预览 */
async function handleFaviconFileChange(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // 允许重复选择同一文件
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return;
  }
  if (file.size > 512 * 1024) {
    message.warning('图片大小不能超过 512KB');
    return;
  }
  faviconUploading.value = true;
  try {
    const dataUrl = await compressToPng(file);
    if (modalMode.value === 'edit' && form.value.id) {
      // 编辑模式：直接上传到当前书签
      const res = await linkApi.uploadFavicon(form.value.id, dataUrl);
      formFaviconPath.value = res.data?.favicon_path || '';
      faviconDataUrl.value = '';
    } else {
      // 创建模式：暂存 data URL，保存时随表单提交
      faviconDataUrl.value = dataUrl;
      formFaviconPath.value = '';
    }
    message.success('图标已上传');
  } catch (err) {
    message.warning(err?.message || '图标上传失败');
  } finally {
    faviconUploading.value = false;
  }
}

/** 移除图标：编辑模式调接口清空，创建模式直接清空暂存 */
async function handleRemoveFavicon() {
  if (modalMode.value === 'edit' && form.value.id && formFaviconPath.value) {
    try {
      await linkApi.removeFavicon(form.value.id);
    } catch { /* 忽略失败 */ }
  }
  formFaviconPath.value = '';
  faviconDataUrl.value = '';
  message.success('已移除图标');
}

/** 表单中手动获取图标（创建/编辑均可用） */
async function handleFetchFavicon() {
  const target = ensureProtocol(form.value.url);
  if (!target) {
    message.warning('请先填写 URL');
    return;
  }
  faviconFetching.value = true;
  // 即时反馈：抓取通常需要几秒，先提示用户任务已启动
  const loadingMsg = message.loading('正在获取图标，请稍候…', { duration: 0 });
  try {
    // 统一用 URL 接口，创建和编辑都能用
    const res = await linkApi.fetchFaviconByUrl(target);
    formFaviconPath.value = res.data.favicon_path || '';
    if (res.data.favicon_path) {
      message.success('图标获取成功');
    } else {
      message.warning('未获取到图标，将使用字母头像');
    }
  } catch (e) {
    formFaviconPath.value = '';
    message.warning(e?.message || '图标获取失败');
  } finally {
    loadingMsg.destroy();
    faviconFetching.value = false;
  }
}

/** 手动获取网页标题 */
async function handleFetchTitle() {
  const target = ensureProtocol(form.value.url);
  if (!target) {
    message.warning('请先填写 URL');
    return;
  }
  titleFetching.value = true;
  try {
    const res = await linkApi.fetchTitle(target);
    if (res.data?.title) {
      form.value.name = res.data.title;
      // 同步更新头像文字
      if (!form.value.avatar_text) {
        form.value.avatar_text = res.data.title.slice(0, 1).toUpperCase();
      }
      message.success('名称获取成功');
    } else {
      message.warning('未获取到名称');
    }
  } catch (e) {
    message.warning(e?.message || '获取名称失败');
  } finally { titleFetching.value = false; }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

/** URL 判重指纹预览：输入合法 http/https URL 时实时展示规范化结果，帮助理解判重逻辑 */
const normalizedPreview = computed(() => {
  const v = form.value.url.trim();
  if (!/^https?:\/\//i.test(v)) return '';
  return normalizeUrl(v) || '';
});

/* ---------- 保存（含重复链接 409 二次确认） ---------- */
async function saveLink() {
  try {
    await formRef.value?.validate();
  } catch {
    message.warning('请检查表单填写是否正确');
    return;
  }
  const f = form.value;
  submitting.value = true;
  try {
    const payload = {
      category_id: f.category_id,
      name: f.name.trim(),
      url: f.url.trim(),
      domain: (f.domain.trim() || extractDomain(f.url)),
      avatar_text: f.avatar_text.trim() || f.name.trim().slice(0, 1).toUpperCase(),
      avatar_color: f.avatar_color,
      sort_order: f.sort_order ?? null,
      note: f.note?.trim() || '',
      is_favorite: !!f.is_favorite,
      // 弹窗内新获取到的图标写回（URL 未变时后端不会自动重抓，需显式提交）
      favicon_path: formFaviconPath.value || undefined,
      // 创建模式下上传的自定义图标（data URL），后端保存为文件并写入 favicon_path
      favicon_data_url: faviconDataUrl.value || undefined,
    };
    // 提交（新建/编辑），重复链接检测命中时返回 HTTP 200 + 业务码 409
    const res = modalMode.value === 'create'
      ? await dataStore.createLink(payload)
      : await dataStore.updateLink(f.id, payload);
    if (res && res.code === 409) {
      const dup = res.data?.duplicate;
      // 弹确认框：用户确认后带 force: true 强制保存
      const confirmed = await new Promise((resolve) => {
        dialog.warning({
          title: '存在相同地址的书签',
          content: () => h('div', null, [
            h('div', { style: 'font-weight:600;margin-bottom:4px' }, dup?.name || '未知书签'),
            h('div', { style: 'font-size:12px;opacity:.7;word-break:break-all' }, dup?.url || ''),
            h('div', { style: 'margin-top:10px;color:#888' }, '仍要保存吗？'),
          ]),
          positiveText: '仍然保存',
          negativeText: '取消',
          onPositiveClick: () => resolve(true),
          onNegativeClick: () => resolve(false),
          onClose: () => resolve(false),
        });
      });
      if (confirmed) {
        if (modalMode.value === 'create') {
          await dataStore.createLink({ ...payload, force: true });
        } else {
          await dataStore.updateLink(f.id, { ...payload, force: true });
        }
        message.success('书签已保存');
      }
      return;
    }
    message.success(modalMode.value === 'create' ? '书签已创建' : '书签已更新');
    modalShow.value = false;
  } catch (e) {
    // 后端校验失败或网络错误时，把错误消息显示给用户
    const msg = e?.message || '保存失败，请稍后重试';
    message.error(msg);
  } finally { submitting.value = false; }
}

/* ---------- URL 预处理：手动获取时自动补全协议（避免"必须以 http:// 开头" 400） ---------- */
function ensureProtocol(url) {
  const v = (url || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
</script>

<template>
  <!-- ====== 新建/编辑弹窗 ====== -->
  <n-modal
    v-model:show="modalShow"
    :mask-closable="true"
    preset="card"
    :title="modalMode === 'create' ? '新建书签' : '编辑书签'"
    style="width: clamp(320px, 92vw, 540px);"
    :segmented="{ content: true, action: true }"
    :bordered="false"
    class="link-modal"
  >
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      label-align="left"
      size="medium"
    >
      <n-form-item label="URL" path="url">
        <div class="url-wrap">
          <div class="url-field">
            <n-input v-model:value="form.url" placeholder="https://github.com" clearable />
            <n-button
              size="medium"
              quaternary
              :loading="faviconFetching"
              :disabled="!form.url"
              @click="handleFetchFavicon"
            >获取图标</n-button>
            <!-- 上传图标：触发隐藏文件选择框，canvas 压缩 64x64 后上传 -->
            <n-button
              size="medium"
              quaternary
              :loading="faviconUploading"
              @click="triggerFaviconUpload"
            >上传图标</n-button>
            <input
              ref="faviconFileInput"
              type="file"
              accept="image/*"
              class="favicon-file-input"
              @change="handleFaviconFileChange"
            >
          </div>
          <p v-if="normalizedPreview" class="url-preview">
            判重指纹：<code>{{ normalizedPreview }}</code>（保存时按此判定是否重复）
          </p>
        </div>
      </n-form-item>

      <n-form-item v-if="formFaviconPath || faviconDataUrl" label="图标预览">
        <div class="favicon-preview">
          <img
            :src="formFaviconPath ? `/favicons/${formFaviconPath}` : faviconDataUrl"
            class="fav-preview-img"
            alt=""
          >
          <span class="fav-preview-text">已获取</span>
          <n-button size="small" quaternary type="error" @click="handleRemoveFavicon">移除</n-button>
        </div>
      </n-form-item>

      <n-form-item label="名称" path="name">
        <div class="url-field">
          <n-input v-model:value="form.name" placeholder="如：GitHub" clearable />
          <n-button
            size="medium"
            quaternary
            :loading="titleFetching"
            :disabled="!form.url"
            @click="handleFetchTitle"
          >获取名称</n-button>
        </div>
      </n-form-item>

      <n-form-item label="分类" path="category_id">
        <n-select
          v-model:value="form.category_id"
          :options="catOptions.filter(o => o.value !== 0)"
          placeholder="请选择分类"
        />
      </n-form-item>

      <n-form-item label="备注（仅管理员可见）" path="note">
        <n-input
          v-model:value="form.note"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="为什么收藏？怎么用？（仅自己在后台可见）"
          maxlength="200"
          show-count
        />
      </n-form-item>

      <div class="inline-field-row">
        <div class="inline-field">
          <n-form-item label="域名（留空自动提取）" path="domain">
            <n-input v-model:value="form.domain" placeholder="github.com" clearable />
          </n-form-item>
        </div>
        <div class="inline-field">
          <n-form-item label="头像文字（留空自动取首字母）" path="avatar_text">
            <n-input
              v-model:value="form.avatar_text"
              placeholder="G"
              maxlength="2"
              style="max-width: 180px;"
            />
          </n-form-item>
        </div>
      </div>

      <n-form-item label="头像颜色" path="avatar_color">
        <div class="color-field">
          <div class="color-row">
            <button
              v-for="c in BG_COLORS"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ on: form.avatar_color === c }"
              :style="{ background: `var(--${c})` }"
              :title="c"
              @click="form.avatar_color = c"
            />
          </div>
          <div class="hex-row">
            <span class="color-preview" :style="{ background: resolveColor(form.avatar_color) }" />
            <n-input
              :value="displayHex(form.avatar_color)"
              placeholder="或输入 HEX 值，如 #FF5500"
              size="small"
              class="hex-input"
              @update:value="form.avatar_color = $event"
            />
            <n-button size="small" quaternary @click="randomAvatarColor">🎲 随机</n-button>
          </div>
        </div>
      </n-form-item>

      <div class="inline-field-row row-end">
        <div class="inline-field col-sort">
          <n-form-item label="排序权重" path="sort_order">
            <n-input-number
              v-model:value="form.sort_order"
              :min="0"
              placeholder="留空自动排末尾"
              style="width: 100%"
            />
          </n-form-item>
        </div>
        <div class="inline-field col-fav">
          <n-form-item label="常用标记">
            <n-checkbox v-model:checked="form.is_favorite" class="fav-checkbox">标记为常用书签（前台条目左侧显示金色竖条）</n-checkbox>
          </n-form-item>
        </div>
      </div>
    </n-form>

    <template #footer>
      <div class="modal-footer">
        <n-button quaternary @click="modalShow = false">取消</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          class="save-btn"
          @click="saveLink"
        >{{ submitting ? '保存中...' : '保存' }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
/* Modal 内 */
.link-modal :deep(.n-card-header__main) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
}
.inline-field-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.inline-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
/* 尾部行：排序权重仅一个数字，缩窄列宽；常用标记占满剩余并保证文本不换行 */
.inline-field-row.row-end .col-sort {
  flex: 0 0 150px;
}
.inline-field-row.row-end .col-fav {
  flex: 1 1 auto;
}
.inline-field-row.row-end .fav-checkbox {
  white-space: nowrap;
}
@media (max-width: 1023px) {
  /* 移动端窄屏：两列换行为整行，避免 checkbox 文本溢出 */
  .inline-field-row.row-end {
    flex-wrap: wrap;
  }
  .inline-field-row.row-end .col-sort,
  .inline-field-row.row-end .col-fav {
    flex: 1 1 100%;
  }
}
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.color-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-preview {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--admin-shadow);
}
.hex-input {
  flex: 1;
  max-width: 220px;
}
.random-btn {
  flex-shrink: 0;
}
.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
  padding: 0;
  flex-shrink: 0;
}
.color-dot:hover { transform: scale(1.12); }
.color-dot.on {
  border-color: var(--admin-text);
  transform: scale(1.08);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* URL 输入区容器：块级占满整行，预览在输入框下方另起一行 */
.url-wrap {
  width: 100%;
  display: block;
}

/* URL 输入框 + 获取图标按钮 */
.url-field {
  display: flex;
  gap: 8px;
  width: 100%;
}
.url-field .n-input {
  flex: 1;
}

/* URL 判重指纹预览：小字独立一行 */
.url-preview {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--admin-muted);
  word-break: break-all;
}
.url-preview code {
  font-family: Consolas, Monaco, monospace;
  background: rgba(120, 100, 90, .08);
  border-radius: 6px;
  padding: 1px 6px;
}

/* 隐藏的原生文件选择框（点击"上传图标"按钮触发） */
.favicon-file-input {
  display: none;
}

/* 图标预览 */
.favicon-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fav-preview-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
  padding: 3px;
  box-sizing: border-box;
  background: var(--fav-bg, transparent);
}
.fav-preview-text {
  font-size: 13px;
  color: var(--success, #18a058);
  font-weight: 600;
}

.save-btn {
  background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-2)) !important;
  border: 0 !important;
  color: var(--admin-on-accent) !important;
}
</style>
