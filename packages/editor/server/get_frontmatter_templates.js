import { IncomingMessage, ServerResponse } from 'http'
import config from '@tenjuu99/blog/lib/config.js'

export const path = '/get_frontmatter_templates'

/**
 * テンプレート設定をクライアントに返すエンドポイント。
 * blog.json の frontmatter_templates キーから設定を読み取る。
 *
 * @vocab: テンプレートレゾルバー (plans/editor-frontmatter-template/dictionary.md#テンプレートレゾルバー)
 * @test: tests/editor/editor-frontmatter-template.test.js
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export const get = async (req, res) => {
  const templates = config.frontmatter_templates || []
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ templates }),
  }
}
