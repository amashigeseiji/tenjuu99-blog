import { describe, it } from 'node:test'
import assert from 'node:assert'
import { loadArticle } from '../../packages/editor/js/articleLoader.js'

describe('記事読み込み器 は 記事の内容を取得してエディタへ反映でき、未存在の記事にはフロントマターテンプレートから初期内容を用意できる', () => {
  it('存在する記事は内容とファイル名を取得できる', async () => {
    const fetchFn = async (url) => {
      assert.strictEqual(url, '/get_editor_target?md=post%2Fa.md')
      return { ok: true, json: async () => ({ filename: 'post/a.md', content: '# hello' }) }
    }
    const result = await loadArticle('post/a.md', [], fetchFn)
    assert.deepStrictEqual(result, { exists: true, filename: 'post/a.md', content: '# hello' })
  })

  it('未存在の記事にはディレクトリにマッチするテンプレートから初期内容が用意される', async () => {
    const templates = [{ path_prefix: 'book/', fields: { title: '', price: '0' } }]
    const fetchFn = async () => ({ ok: false })
    const result = await loadArticle('book/new-book.md', templates, fetchFn)
    assert.strictEqual(result.exists, false)
    assert.strictEqual(result.filename, 'book/new-book.md')
    assert.match(result.content, /^---\n/)
    assert.match(result.content, /price: 0/)
  })

  it('テンプレートがないときは既定の雛形が用意される', async () => {
    const fetchFn = async () => ({ ok: false })
    const result = await loadArticle('note/memo.md', [], fetchFn)
    assert.strictEqual(result.exists, false)
    assert.match(result.content, /title: memo/)
    assert.match(result.content, /memo についての記事を作成しましょう/)
  })
})
