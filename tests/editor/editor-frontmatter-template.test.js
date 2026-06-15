import { describe, it } from 'node:test'
import assert from 'node:assert'
import { matchTemplate, buildFrontmatterString } from '../../packages/editor/js/frontmatter_template.js'

// ルートテスト: ツリーが完成するまで green にしない
describe('フロントマターテンプレートローダー は ディレクトリに対応するフロントマターテンプレートをエディタに挿入できる', () => {
  it('book/ ディレクトリの新規ファイルにはフロントマターテンプレートが挿入される', () => {
    const templates = [
      {
        path_prefix: 'book/',
        fields: { title: '', price: '0', author: '', publisher: '', isbn: '', language: 'ja', in_stock: 'true' }
      }
    ]
    const matched = matchTemplate('book/my-book.md', templates)
    const frontmatter = buildFrontmatterString(matched, 'my-book')
    assert.ok(frontmatter.includes('price: 0'))
    assert.ok(frontmatter.includes('author: '))
    assert.ok(frontmatter.includes('title: my-book'))
    assert.match(frontmatter, /^---\n/)
    assert.match(frontmatter, /\n---\n?$/)
  })
})

// ─── テンプレートマッチャー ────────────────────────────────────────

describe('テンプレートマッチャー は ファイルパスにマッチするテンプレート設定を選択できる', () => {
  const bookTemplate = { path_prefix: 'book/', fields: { title: '', price: '0', author: '' } }
  const bookArtTemplate = { path_prefix: 'book/art/', fields: { title: '', medium: '' } }
  const postTemplate = { path_prefix: 'post/', fields: { title: '', tags: '' } }

  describe('ディレクトリプレフィックスが一致する設定を返せる', () => {
    it('book/my-book.md は book/ テンプレートにマッチする', () => {
      const result = matchTemplate('book/my-book.md', [bookTemplate, postTemplate])
      assert.strictEqual(result, bookTemplate)
    })

    it('post/hello.md は post/ テンプレートにマッチする', () => {
      const result = matchTemplate('post/hello.md', [bookTemplate, postTemplate])
      assert.strictEqual(result, postTemplate)
    })
  })

  describe('複数の設定がある場合、より長いプレフィックスを優先できる', () => {
    it('book/art/painting.md は book/art/ テンプレートを book/ より優先する', () => {
      const result = matchTemplate('book/art/painting.md', [bookTemplate, bookArtTemplate])
      assert.strictEqual(result, bookArtTemplate)
    })

    it('book/history.md は book/ テンプレートにマッチする（book/art/ はマッチしない）', () => {
      const result = matchTemplate('book/history.md', [bookTemplate, bookArtTemplate])
      assert.strictEqual(result, bookTemplate)
    })
  })

  describe('マッチする設定がない場合 null を返せる', () => {
    it('tech/article.md はどのテンプレートにもマッチしないとき null を返す', () => {
      const result = matchTemplate('tech/article.md', [bookTemplate, postTemplate])
      assert.strictEqual(result, null)
    })

    it('空のテンプレートリストでは null を返す', () => {
      const result = matchTemplate('book/my-book.md', [])
      assert.strictEqual(result, null)
    })

    it('空のファイルパスでは null を返す', () => {
      const result = matchTemplate('', [bookTemplate])
      assert.strictEqual(result, null)
    })
  })
})

// ─── テンプレートインジェクター ───────────────────────────────────

describe('テンプレートインジェクター は フロントマターテンプレートをフロントマター文字列に変換できる', () => {
  const template = {
    path_prefix: 'book/',
    fields: { title: '', price: '0', author: '', publisher: '', isbn: '', language: 'ja', in_stock: 'true' }
  }

  describe('キーとデフォルト値のペアを `key: value` 形式に変換できる', () => {
    it('各フィールドが key: value 形式の行として現れる', () => {
      const result = buildFrontmatterString(template, 'my-book')
      assert.ok(result.includes('price: 0'), 'price フィールドが含まれる')
      assert.ok(result.includes('author: '), 'author フィールドが含まれる')
      assert.ok(result.includes('language: ja'), 'language フィールドのデフォルト値が使われる')
      assert.ok(result.includes('in_stock: true'), 'in_stock フィールドのデフォルト値が使われる')
    })
  })

  describe('title はファイル名から自動生成できる', () => {
    it('title はベース名（拡張子・ディレクトリなし）になる', () => {
      const result = buildFrontmatterString(template, 'my-book')
      assert.ok(result.includes('title: my-book'), 'title にファイル名が使われる')
    })

    it('fields の title が空でもファイル名で上書きされる', () => {
      const tmpl = { path_prefix: 'book/', fields: { title: 'placeholder', price: '0' } }
      const result = buildFrontmatterString(tmpl, 'actual-title')
      assert.ok(result.includes('title: actual-title'))
      assert.ok(!result.includes('placeholder'))
    })
  })

  describe('`---` で囲んだフロントマター文字列を生成できる', () => {
    it('文字列は --- で始まる', () => {
      const result = buildFrontmatterString(template, 'my-book')
      assert.match(result, /^---\n/)
    })

    it('文字列は --- で終わる', () => {
      const result = buildFrontmatterString(template, 'my-book')
      assert.match(result, /\n---\n?$/)
    })
  })
})

// ─── テンプレートレゾルバー ───────────────────────────────────────

describe('テンプレートレゾルバー は テンプレート設定をサーバーから取得できる', () => {
  describe('/get_frontmatter_templates エンドポイントからJSON設定を取得できる', () => {
    // テンプレートレゾルバーはブラウザの fetch に依存するため、
    // サーバーエンドポイントの単体テストは get_frontmatter_templates.js で行う
    it('TODO', () => {})
  })
})
