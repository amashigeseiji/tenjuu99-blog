import config from '@tenjuu99/blog/lib/config.js'

export const path = '/get_frontmatter_templates'

/**
 * `blog.json` の `frontmatter_templates` キーからテンプレート設定の配列を取り出す。
 *
 * @vocab: テンプレートレゾルバー
 * @vocab: テンプレート設定
 * @test: tests/editor/editor-frontmatter-template.test.js
 */
export const getTemplates = (cfg) => cfg.frontmatter_templates || []

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const get = async (req, res) => {
  const templates = getTemplates(config)
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ templates }),
  }
}
