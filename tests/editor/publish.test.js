import { describe, it } from 'node:test'
import assert from 'node:assert'
import { extractImageReferences } from '../../packages/editor/js/imageReferenceExtractor.js'
import { collectTarget } from '../../packages/editor/server/publishTargetCollector.js'
import { reflect } from '../../packages/editor/server/changeReflector.js'
import { getPublicationStatus } from '../../packages/editor/server/publicationStatus.js'

// ルートテスト
describe('エディタは編集内容を公開・更新できる', () => {
  it('公開リクエストを受けると公開対象をリモートに反映してフィードバックを返す', async () => {
    const { handlePublish } = await import('../../packages/editor/server/publish.js')
    const reflected = []
    const mockPublishActions = {
      commit: async (files) => { reflected.push(...files); return true },
      push: async () => ({ success: true })
    }
    const result = await handlePublish(
      { filePath: 'post/article.md', fileContent: '記事本文\n![図1](/image/post/fig1.png)', srcDir: 'src' },
      mockPublishActions
    )
    assert.deepStrictEqual(reflected, ['src/pages/post/article.md', 'src/image/post/fig1.png'])
    assert.deepStrictEqual(result, { success: true })
  })

  describe('公開ボタンはリクエストを送信してフィードバックを表示できる', () => {
    it.skip('手動確認のみ: ブラウザAPI・DOM依存のためテスト不可')
  })

  describe('公開ハンドラーは保存と遷移を一括で処理できる', () => {
    it('ファイルパスと本文から公開対象を収集してリモートに反映し結果を返す', async () => {
      const { handlePublish } = await import('../../packages/editor/server/publish.js')
      const reflected = []
      const mockPublishActions = {
        commit: async (files) => { reflected.push(...files); return true },
        push: async () => ({ success: true })
      }
      const result = await handlePublish(
        { filePath: 'post/hello.md', fileContent: '本文\n![猫](/image/post/cat.jpg)', srcDir: 'src' },
        mockPublishActions
      )
      assert.deepStrictEqual(reflected, ['src/pages/post/hello.md', 'src/image/post/cat.jpg'])
      assert.deepStrictEqual(result, { success: true })
    })

    describe('公開対象コレクターは現ファイルと参照画像を収集できる', () => {
      it('現ファイルと参照画像をgit addできるパスで返す', () => {
        const target = collectTarget('post/hello.md', '本文\n![猫](/image/post/cat.jpg)', 'src')
        assert.deepStrictEqual(target, {
          markdownFile: 'src/pages/post/hello.md',
          imageFiles: ['src/image/post/cat.jpg']
        })
      })
      it('画像参照がない場合は imageFiles が空配列', () => {
        const target = collectTarget('post/hello.md', '画像なしの本文', 'src')
        assert.deepStrictEqual(target, { markdownFile: 'src/pages/post/hello.md', imageFiles: [] })
      })

      describe('画像参照抽出器はMarkdownから画像パスを抽出できる', () => {
        it('![](パス)形式の画像パスをすべて返す', () => {
          const md = '本文\n![猫](src/image/post/cat.jpg)\n![犬](src/image/post/dog.png)'
          assert.deepStrictEqual(
            extractImageReferences(md),
            ['src/image/post/cat.jpg', 'src/image/post/dog.png']
          )
        })
        it('画像参照がない場合は空配列を返す', () => {
          assert.deepStrictEqual(extractImageReferences('テキストのみの本文'), [])
        })
      })
    })

    describe('変更反映器は遷移実行体を介してリモートに反映できる', () => {
      it('ファイル群をコミットしてpushし結果を返す', async () => {
        const committed = []
        const mockPublishActions = {
          commit: async (files) => { committed.push(...files); return true },
          push: async () => ({ success: true })
        }
        const result = await reflect(
          ['post/hello.md', 'src/image/post/cat.jpg'],
          mockPublishActions
        )
        assert.deepStrictEqual(committed, ['post/hello.md', 'src/image/post/cat.jpg'])
        assert.deepStrictEqual(result, { success: true })
      })
      it('push失敗時はエラー情報を返す', async () => {
        const mockPublishActions = {
          commit: async () => true,
          push: async () => ({ success: false, error: 'authentication failed' })
        }
        const result = await reflect(['post/hello.md'], mockPublishActions)
        assert.deepStrictEqual(result, { success: false, error: 'authentication failed' })
      })
    })

    describe('公開ステータス判定器は公開済み状態からステータスを導出できる', () => {
      it('ファイルがリモートに存在しない場合は「new」を返す', async () => {
        const mockPublishedState = {
          existsInRemote: async () => false,
          diffFromRemote: async () => ''
        }
        const result = await getPublicationStatus('post/hello.md', mockPublishedState)
        assert.strictEqual(result, 'new')
      })
      it('ファイルがリモートに存在して差分がある場合は「modified」を返す', async () => {
        const mockPublishedState = {
          existsInRemote: async () => true,
          diffFromRemote: async () => 'diff --git ...'
        }
        const result = await getPublicationStatus('post/hello.md', mockPublishedState)
        assert.strictEqual(result, 'modified')
      })
      it('ファイルがリモートに存在して差分がない場合は「published」を返す', async () => {
        const mockPublishedState = {
          existsInRemote: async () => true,
          diffFromRemote: async () => ''
        }
        const result = await getPublicationStatus('post/hello.md', mockPublishedState)
        assert.strictEqual(result, 'published')
      })
    })
  })
})
