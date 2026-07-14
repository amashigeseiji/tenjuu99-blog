
/**
 * @vocab 画像パス判定器
 * @test tests/editor/imageReference.test.js
 * @param {unknown} value - frontmatter のフィールド値
 * @returns {boolean} 値が画像パスの形（ローカルパスかつ画像拡張子）であれば true
 */
const IMAGE_EXTENSION_REGEXP = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/i

export function isImagePath(value) {
  if (typeof value !== 'string') return false
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) return false
  return IMAGE_EXTENSION_REGEXP.test(value)
}
