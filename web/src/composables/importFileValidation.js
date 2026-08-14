/**
 * 导入文件校验：限制文件选择大小，与后端 express.json limit 保持一致（2MB）
 */
/** 导入文件大小上限（字节） */
export const MAX_IMPORT_SIZE = 2 * 1024 * 1024;

/**
 * 校验导入文件大小：超限返回提示文案，合法返回 null
 * @param {{ name?: string, size?: number } | null} file 选择的文件对象
 * @returns {string | null} 超限时返回提示，否则返回 null
 */
export function validateImportFile(file) {
  if (!file) return null;
  if (file.size > MAX_IMPORT_SIZE) {
    return '文件大小不能超过 2MB';
  }
  return null;
}
