import config from '@tenjuu99/blog/lib/config.js'

export const path = '/get_frontmatter_templates'

/**
 * @vocab: テンプレートレゾルバー (docs/dictionary.md#テンプレートレゾルバー)
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
