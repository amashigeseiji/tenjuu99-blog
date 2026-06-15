/**
 * @typedef {{ path_prefix: string, fields: Object.<string, string> }} FrontmatterTemplateConfig
 */

/**
 * ファイルパスにマッチするフロントマターテンプレート設定を選択する。
 * 複数マッチする場合は最も長いプレフィックスを優先する。
 *
 * @vocab: テンプレートマッチャー (docs/dictionary.md#テンプレートマッチャー)
 * @test: tests/editor/editor-frontmatter-template.test.js
 *
 * @param {string} filePath - 新規ファイルのパス（例: "book/my-book.md"）
 * @param {FrontmatterTemplateConfig[]} templates - テンプレート設定の配列
 * @returns {FrontmatterTemplateConfig|null} マッチした設定、またはnull
 */
export function matchTemplate(filePath, templates) {
  if (!filePath || !templates || templates.length === 0) {
    return null
  }
  let best = null
  for (const tmpl of templates) {
    if (filePath.startsWith(tmpl.path_prefix)) {
      if (!best || tmpl.path_prefix.length > best.path_prefix.length) {
        best = tmpl
      }
    }
  }
  return best
}

/**
 * フロントマターテンプレート設定をフロントマター文字列に変換する。
 * title はファイル名から自動生成する（fields に title がある場合でもファイル名を優先）。
 *
 * @vocab: テンプレートインジェクター (docs/dictionary.md#テンプレートインジェクター)
 * @test: tests/editor/editor-frontmatter-template.test.js
 *
 * @param {FrontmatterTemplateConfig} template - マッチしたテンプレート設定
 * @param {string} baseName - ファイル名（拡張子・ディレクトリなし、例: "my-book"）
 * @returns {string} `---\n...\n---\n` 形式のフロントマター文字列
 */
export function buildFrontmatterString(template, baseName) {
  const fields = { ...template.fields }
  // title はファイル名から自動生成
  fields.title = baseName

  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`)
  return `---\n${lines.join('\n')}\n---\n`
}

/**
 * ファイルパスとテンプレート設定一覧からフロントマター文字列を生成する。
 * マッチするテンプレートがない場合は null を返す。
 *
 * @vocab: フロントマターテンプレートローダー (docs/dictionary.md#フロントマターテンプレートローダー)
 * @test: tests/editor/editor-frontmatter-template.test.js
 *
 * @param {string} filePath - 新規ファイルのパス（例: "book/my-book.md"）
 * @param {FrontmatterTemplateConfig[]} templates - テンプレート設定の配列
 * @returns {string|null} フロントマター文字列、またはマッチしない場合は null
 */
export function loadFrontmatterTemplate(filePath, templates) {
  const matched = matchTemplate(filePath, templates)
  if (!matched) return null
  const baseName = filePath.split('.')[0].split('/').pop()
  return buildFrontmatterString(matched, baseName)
}
