import { loadFrontmatterTemplate } from './frontmatter_template.js'

/**
 * @vocab 記事読み込み器
 * @test tests/editor/articleLoader.test.js
 * 記事の内容を取得する。未存在の記事にはフロントマターテンプレートから初期内容を用意し、
 * exists: false として返す（テンプレートがなければ既定の雛形を使う）。
 * @param {string} target 記事のパス
 * @param {Array<object>} templates フロントマターテンプレート設定
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ exists: boolean, filename: string, content: string }>}
 */
export const loadArticle = async (target, templates, fetchFn = (...a) => fetch(...a)) => {
  const res = await fetchFn(`/get_editor_target?md=${encodeURIComponent(target)}`)
  if (!res.ok) {
    const baseName = target.split('/').pop().replace(/\.[^.]+$/, '')
    const content = loadFrontmatterTemplate(target, templates)
      ?? `---\ntitle: ${baseName}\n---\n${baseName} についての記事を作成しましょう`
    return { exists: false, filename: target, content }
  }
  const json = await res.json()
  return { exists: true, filename: json.filename, content: json.content }
}
