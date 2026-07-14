import { describe, it } from 'node:test'
import assert from 'node:assert'
import { collectTarget } from '../../packages/editor/server/publishTargetCollector.js'
import { extractImageReferences } from '../../packages/editor/js/imageReferenceExtractor.js'
import { extractFrontmatterImageReferences } from '../../packages/editor/js/frontmatterImageReferenceExtractor.js'
import { isImagePath } from '../../packages/editor/js/imagePathDetector.js'

describe('公開対象コレクターは記事由来のすべての画像参照から公開対象を収集できる', () => {
  it('本文（Markdown記法・imgタグ）と frontmatter の画像参照がすべて公開対象に含まれる', () => {
    const content = [
      '---',
      'title: テスト記事',
      'og_image: /image/post/ogp.png',
      '---',
      '本文',
      '![猫](/image/post/cat.jpg)',
      '<img src="/image/post/dog.png" alt="犬">',
    ].join('\n')
    const target = collectTarget('post/hello.md', content, 'src')
    assert.strictEqual(target.markdownFile, 'src/pages/post/hello.md')
    assert.deepStrictEqual(
      [...target.imageFiles].sort(),
      ['src/image/post/cat.jpg', 'src/image/post/dog.png', 'src/image/post/ogp.png']
    )
  })

  describe('画像参照抽出器は本文から画像参照を抽出できる', () => {
    describe('画像参照抽出器は Markdown 画像記法の参照を抽出できる', () => {
      it('ローカル画像のパスを抽出し、外部URLは除く', () => {
        const content = '![猫](/image/post/cat.jpg)\n![外部](https://example.com/a.png)'
        assert.deepStrictEqual(extractImageReferences(content), ['/image/post/cat.jpg'])
      })
    })
    describe('画像参照抽出器は本文に埋め込まれた img タグの参照を抽出できる', () => {
      it('img タグの src のローカルパスを抽出する', () => {
        const content = '本文\n<img src="/image/post/dog.png" alt="犬">\n<img class="wide" src=\'/image/post/bird.png\'>'
        assert.deepStrictEqual(
          extractImageReferences(content),
          ['/image/post/dog.png', '/image/post/bird.png']
        )
      })
      it('外部URLの src は抽出しない', () => {
        const content = '<img src="https://example.com/a.png">\n<img src="//cdn.example.com/b.png">'
        assert.deepStrictEqual(extractImageReferences(content), [])
      })
      it('data:/blob:/javascript: などスキーム付きの src は抽出しない', () => {
        const content = [
          '<img src="data:image/png;base64,AAAA">',
          '<img src="blob:https://example.com/uuid">',
          '<img src="javascript:alert(1)">',
        ].join('\n')
        assert.deepStrictEqual(extractImageReferences(content), [])
      })
    })
  })

  describe('フロントマター画像参照抽出器は frontmatter から画像参照を抽出できる', () => {
    it('frontmatter の値のうち画像パスの形のものを抽出する', () => {
      const content = '---\ntitle: テスト記事\nog_image: /image/post/ogp.png\ntemplate: default.html\n---\n# 本文'
      assert.deepStrictEqual(extractFrontmatterImageReferences(content), ['/image/post/ogp.png'])
    })
    it('画像パスの形の値がなければ何も抽出しない', () => {
      const content = '---\ntitle: テスト記事\npublished: 2026-07-15\n---\n# 本文'
      assert.deepStrictEqual(extractFrontmatterImageReferences(content), [])
    })
    it('frontmatter がない記事からは何も抽出しない', () => {
      assert.deepStrictEqual(extractFrontmatterImageReferences('# 本文だけ'), [])
    })
    it('配列値の中の画像パスも抽出する', () => {
      const content = '---\nimages: ["/image/post/a.png", "/image/post/b.png", "not-image"]\n---\n# 本文'
      assert.deepStrictEqual(
        extractFrontmatterImageReferences(content),
        ['/image/post/a.png', '/image/post/b.png']
      )
    })

    // 子ノード「フロントマター解析器は記事の文字列から frontmatter の値を取り出せる [ssg-core]」
    // は tests/ssg-core/pageData.test.js に配置

    describe('画像パス判定器は値が画像パスの形かどうか判定できる', () => {
      it('画像拡張子をもつローカルパスは画像パスとみなす', () => {
        assert.strictEqual(isImagePath('/image/post/ogp.png'), true)
        assert.strictEqual(isImagePath('image/post/photo.jpg'), true)
        assert.strictEqual(isImagePath('/image/a.PNG'), true)
      })
      it('外部URLは画像パスとみなさない', () => {
        assert.strictEqual(isImagePath('https://example.com/a.png'), false)
        assert.strictEqual(isImagePath('http://example.com/a.png'), false)
        assert.strictEqual(isImagePath('//cdn.example.com/a.png'), false)
      })
      it('data:/blob: などスキーム付きの値は画像パスとみなさない', () => {
        assert.strictEqual(isImagePath('data:image/png;base64,AAAA.png'), false)
        assert.strictEqual(isImagePath('blob:https://example.com/uuid.png'), false)
      })
      it('画像拡張子をもたない値は画像パスとみなさない', () => {
        assert.strictEqual(isImagePath('テスト記事'), false)
        assert.strictEqual(isImagePath('default.html'), false)
        assert.strictEqual(isImagePath('2026-07-15'), false)
      })
      it('文字列でない値は画像パスとみなさない', () => {
        assert.strictEqual(isImagePath(true), false)
        assert.strictEqual(isImagePath(42), false)
        assert.strictEqual(isImagePath(null), false)
        assert.strictEqual(isImagePath(['/image/a.png']), false)
      })
    })
  })
})
