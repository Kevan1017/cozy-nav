/**
 * 单元测试：导入文件大小校验（选择文件时超过 2MB 的拦截逻辑）
 */
import { describe, it, expect } from 'vitest';
import { MAX_IMPORT_SIZE, validateImportFile } from '../composables/importFileValidation.js';

describe('validateImportFile 导入文件大小校验', () => {
  it('恰好等于 2MB 时放行（后端 limit 判断是严格大于）', () => {
    const file = { name: 'bookmarks.json', size: MAX_IMPORT_SIZE };
    expect(validateImportFile(file)).toBeNull();
  });

  it('小于 2MB 时放行', () => {
    const file = { name: 'bookmarks.json', size: MAX_IMPORT_SIZE - 1 };
    expect(validateImportFile(file)).toBeNull();
  });

  it('小文件（1KB）放行', () => {
    const file = { name: 'small.json', size: 1024 };
    expect(validateImportFile(file)).toBeNull();
  });

  it('超过 2MB 时拦截并返回提示文案', () => {
    const file = { name: 'big.html', size: MAX_IMPORT_SIZE + 1 };
    expect(validateImportFile(file)).toBe('文件大小不能超过 2MB');
  });

  it('远大于 2MB（10MB）时拦截', () => {
    const file = { name: 'huge.html', size: 10 * 1024 * 1024 };
    expect(validateImportFile(file)).toBe('文件大小不能超过 2MB');
  });

  it('空文件（未选择）不报错', () => {
    expect(validateImportFile(null)).toBeNull();
    expect(validateImportFile(undefined)).toBeNull();
  });

  it('缺少 size 字段时放行（大小未知不拦截）', () => {
    expect(validateImportFile({ name: 'a.json' })).toBeNull();
  });
});
