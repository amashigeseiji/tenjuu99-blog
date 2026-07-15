/**
 * @vocab 表示対象
 * URLによって特定される、エディタが表示すべき資源。
 * @typedef {{ type: 'article'|'image', path: string }} DisplayTarget
 */

/**
 * @vocab 表示対象解決器
 * @test tests/editor/image-library.test.js
 * URLがどの資源（記事か画像か）を特定しているかを表示対象として判別する。
 * @param {URL} url
 * @returns {DisplayTarget|null} どの資源も特定していなければ null
 */
export function resolveDisplayTarget(url) {
  const image = url.searchParams.get('image')
  if (image) return { type: 'image', path: image }
  const md = url.searchParams.get('md')
  if (md) return { type: 'article', path: md }
  return null
}
