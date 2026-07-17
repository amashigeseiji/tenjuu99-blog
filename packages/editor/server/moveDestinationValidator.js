import { isImageFileName } from './imageScanner.js'

/**
 * @vocab 移動先検証器
 * @test tests/editor/image-library.test.js
 * 移動先の配置パス（image/ 相対・階層可）が画像ライブラリの管理下にとどまるかを判定する。
 * 画像として扱える名前でない、または管理領域（image/ 配下）の外へ出る配置パスは受け付けない。
 * @param {string} destPath - image/ 相対の配置パス（例: `photos/2026/b.jpg`）
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDestination(destPath) {
  if (!destPath || typeof destPath !== 'string') {
    return { valid: false, error: '移動先の配置パスを入力してください' }
  }
  if (destPath.startsWith('/') || destPath.includes('\\')) {
    return { valid: false, error: '不正な配置パスです' }
  }
  const segments = destPath.split('/')
  if (segments.some(s => s === '' || s === '.' || s === '..')) {
    return { valid: false, error: '不正な配置パスです' }
  }
  if (!isImageFileName(segments[segments.length - 1])) {
    return { valid: false, error: '画像として扱えない名前です（拡張子を確認してください）' }
  }
  return { valid: true }
}
