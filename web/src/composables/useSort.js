/**
 * 通用排序工具：按偏好模式对分类/书签列表排序
 * 模式格式：sort_order:asc（默认）/ created_at:asc|desc / name:asc|desc
 * 名称排序使用中文 locale 比较，避免按 Unicode 码点导致拼音乱序
 */
const SORT_KEYS = ['sort_order', 'created_at', 'name'];

/** 解析排序模式为 { key, dir }，非法输入回退默认自定义顺序 */
export function parseSortMode(mode) {
  const [key = 'sort_order', dir = 'asc'] = String(mode || 'sort_order:asc').split(':');
  return {
    key: SORT_KEYS.includes(key) ? key : 'sort_order',
    dir: dir === 'desc' ? 'desc' : 'asc',
  };
}

/** 单个列表按模式排序（返回新数组，不修改入参） */
export function sortByMode(list, mode) {
  const { key, dir } = parseSortMode(mode);
  const arr = Array.isArray(list) ? [...list] : [];
  arr.sort((a, b) => {
    let r = 0;
    if (key === 'name') {
      // 中文按拼音/笔画 locale 排序，英文数字自然序
      r = String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN', { numeric: true });
    } else if (key === 'created_at') {
      // ISO 时间字符串可直接字典序比较
      r = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    } else {
      r = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    }
    return dir === 'desc' ? -r : r;
  });
  return arr;
}
